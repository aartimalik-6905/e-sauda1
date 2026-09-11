import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, X } from "lucide-react";
import { categories } from "../data/listings";
import { INDIA_CITIES } from "../data/indiaCities";
import { Category, Listing } from "../types";
import { fetchListings } from "../lib/listings";
import { useSavedListings } from "../hooks/useSavedListings";
import { useUserLocation } from "../hooks/useUserLocation";
import { haversineKm } from "../lib/distance";
import ListingCard from "../components/ListingCard";

const tabs: ("All" | Category)[] = ["All", ...categories.map((c) => c.name)];

// A handful of major metros shown by default when the city box is focused but
// empty -- so clicking into it isn't a dead end before you've typed anything.
const POPULAR_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai",
  "Kolkata", "Pune", "Jaipur", "Lucknow", "Surat", "Chandigarh",
]

// Client-side, offline city search over the bundled INDIA_CITIES list -- see that
// file for why this isn't a live geocoder call: nominatim.openstreetmap.org (used
// elsewhere in this app for one-off lookups) is a shared demo service that rate-
// limits to 1 request/second and silently blocks anyone who exceeds that, which a
// "suggest as you type" box firing on every keystroke does almost immediately. This
// runs entirely in the browser instead -- instant, no network call, no rate limit,
// and it covers every one of the 3,375 bundled Indian cities/towns, not just
// whatever a geocoder happens to return for a given query.
function searchIndiaCities(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return POPULAR_CITIES;
  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const [name] of INDIA_CITIES) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) startsWith.push(name);
    else if (lower.includes(q)) contains.push(name);
    if (startsWith.length >= limit) break;
  }
  return [...startsWith, ...contains].slice(0, limit);
}

export default function Browse() {
  const { savedIds, toggleSaved } = useSavedListings();
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState<"All" | Category>(
    (params.get("category") as Category) || "All",
  );
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  // `city` is the applied filter (what actually gets sent to fetchListings, debounced
  // from cityInput below); empty string means no city filter ("All cities"). Free-text
  // instead of a fixed dropdown so any city/town/area works, not just a hardcoded
  // handful of metros -- the backend already does a partial (ilike) match against the
  // listing's location text, so this needed no backend changes, just a better input.
  const [city, setCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityBoxRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState("Relevance");
  const [searchInput, setSearchInput] = useState(params.get("q") || "");
  const [search, setSearch] = useState(params.get("q") || "");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing in the search box so we're not firing a query on every
  // keystroke — 350ms feels responsive without hammering the DB while typing.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Debounce typing so the *filter* (city -> fetchListings) doesn't fire on every
  // keystroke -- the suggestion list itself is instant/local (see searchIndiaCities
  // above) so it doesn't need this delay, but it's cheap enough to just piggyback
  // on the same effect rather than run two separate ones.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCity(cityInput.trim());
    }, 350);
    setCitySuggestions(searchIndiaCities(cityInput));
    return () => clearTimeout(timeout);
  }, [cityInput]);

  // Close the suggestions dropdown on an outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pickCity(value: string) {
    setCityInput(value);
    setCity(value);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
  }

  function clearCity() {
    setCityInput("");
    setCity("");
    setCitySuggestions([]);
  }

  // Keeps the URL bookmarkable/shareable (e.g. the navbar's search box links here
  // with ?q=...) without fighting the debounce above.
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        search ? next.set("q", search) : next.delete("q");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListings({
      category: active,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      search,
      city: city || undefined,
    })
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load listings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, min, max, search, city]);

  // Real distance from the buyer's live location, not the stored distance_km column
  // (which is never anything but its default 0 -- see lib/listings.ts). Without this,
  // "Nearest first" was sorting on a value that's identical for every listing and
  // doing nothing.
  const { coords: myCoords } = useUserLocation();

  const filtered = useMemo(() => {
    let result = listings;
    if (sort === "Price: Low to High")
      result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "Price: High to Low")
      result = [...result].sort((a, b) => b.price - a.price);
    if (sort === "Nearest first" && myCoords) {
      const distanceOf = (l: Listing) =>
        l.latitude != null && l.longitude != null
          ? haversineKm(myCoords, { lat: l.latitude, lng: l.longitude })
          : Infinity; // unknown location sorts last, not first
      result = [...result].sort((a, b) => distanceOf(a) - distanceOf(b));
    }
    return result;
  }, [listings, sort, myCoords]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === t
                ? "bg-forest text-cream"
                : "border border-line/10 bg-surface text-ink/80"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl2 border border-line/5 bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Filters</h3>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Search
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2">
              <Search size={16} className="shrink-0 text-ink/40" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search listings..."
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5" ref={cityBoxRef}>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              City
            </label>
            <div className="relative mt-2">
              <div className="flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2">
                <MapPin size={16} className="shrink-0 text-ink/40" />
                <input
                  value={cityInput}
                  onChange={(e) => {
                    setCityInput(e.target.value);
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  placeholder="Any city, town, or area"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
                />
                {cityInput && (
                  <button
                    onClick={clearCity}
                    aria-label="Clear city filter"
                    className="shrink-0 text-ink/40 hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showCitySuggestions && citySuggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line/10 bg-surface shadow-lg">
                  {citySuggestions.map((c) => (
                    <li key={c}>
                      <button
                        onClick={() => pickCity(c)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-cream-dark"
                      >
                        <MapPin size={13} className="shrink-0 text-ink/40" />
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ink/40">
              Type any city or town, or pick from the list. Leave blank to see listings from everywhere.
            </p>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Price (₹)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Min"
                className="bg-surface text-ink w-full rounded-lg border border-line/10 px-3 py-2 text-sm"
              />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Max"
                className="bg-surface text-ink w-full rounded-lg border border-line/10 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Sort by
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-sm"
            >
              <option>Relevance</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Nearest first</option>
            </select>
          </div>

          <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
            <strong>Trust filter is on.</strong> Only sellers within their
            listing cap. Bulk resellers are automatically hidden.
          </div>
        </aside>

        <div>
          <p className="mb-4 font-display text-xl font-semibold">
            {search ? `Results for "${search}"` : active === "All" ? "All listings" : active}{" "}
            <span className="text-base font-normal text-ink/50">
              · {loading ? "…" : filtered.length} results across India
            </span>
          </p>

          {error && (
            <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              Couldn't load listings: {error}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl2 bg-cream-dark"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onToggleSaved={toggleSaved}
                />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && !error && (
            <p className="mt-10 text-center text-sm text-ink/50">
              {search
                ? `No listings match "${search}". Try a different search term.`
                : "No listings match these filters yet."}
            </p>
          )}

          <div className="mt-10 rounded-xl2 bg-clay/10 p-8 text-center">
            <p className="font-display text-xl font-semibold">
              Have something to sell?
            </p>
            <p className="mt-1 text-sm text-ink/60">
              It only takes a few minutes to list an item.
            </p>
            <Link
              to="/sell"
              className="mt-4 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
            >
              Post a listing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
