import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categories } from "../data/listings";
import { countActiveListingsInCategory, createListing } from "../lib/listings";
import {
  uploadListingPhotos,
  validatePhotoFiles,
  uploadListingVideo,
  validateVideoFile,
  validateVideoDuration,
} from "../lib/storage";
import { payListingFee } from "../lib/listingFee";
import { suggestPrice, PriceSuggestion } from "../lib/pricing";
import { suggestListingDescription } from "../lib/descriptionSuggestion";
import { Category } from "../types";
import { useAuth } from "../context/AuthContext";
import { Upload, Video, Check, X, MapPin, Pencil, Sparkles } from "lucide-react";
import { categoryIcons } from "../lib/categoryIcons";
import { geocodeLocation, GeoPoint } from "../lib/geocoding";
import ListingMap from "../components/ListingMap";
import PhotoEditorModal from "../components/PhotoEditorModal";
import VideoEditorModal from "../components/VideoEditorModal";

const LISTING_CAP_PER_CATEGORY = 2; // matches the flat cap new users start with; grows with trust score later

export default function Sell() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [subCategory, setSubCategory] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("Good");
  const [city, setCity] = useState("");
  const [posted, setPosted] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [videoWarning, setVideoWarning] = useState<string | null>(null);
  const [activeInCategory, setActiveInCategory] = useState<number | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  // A video is mandatory before a new listing can be published — see the Media
  // step below. videoFile only gets set once size/type/duration all pass.
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [priceSuggestionLoading, setPriceSuggestionLoading] = useState(false);

  // A stable id generated up front (not server-assigned) so photos/video can be
  // uploaded to storage under their final listing folder *before* the listing row
  // itself exists -- see publish() below for why that ordering is the fix for
  // listings that used to end up live with missing media.
  const [pendingListingId] = useState(() => {
    const storageKey = "e-sauda-pending-listing-id";
    const existingId = sessionStorage.getItem(storageKey);
    if (existingId) return existingId;
    const newId = crypto.randomUUID();
    sessionStorage.setItem(storageKey, newId);
    return newId;
  });
  // Kept across a failed publish attempt so retrying doesn't charge the listing
  // fee a second time -- payListingFee's Cashfree order stays valid/unconsumed
  // until create_listing_with_fee actually runs.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const [descSuggestLoading, setDescSuggestLoading] = useState(false);
  const [descSuggestError, setDescSuggestError] = useState<string | null>(null);

  // Newly picked photos go through the crop/rotate editor one at a time before
  // landing in photoFiles -- pendingPhotoQueue holds the rest while editingNewPhoto
  // is the one currently open in the modal. editingExistingPhotoIndex lets someone
  // reopen the editor for a photo they already added, from its thumbnail.
  const [pendingPhotoQueue, setPendingPhotoQueue] = useState<File[]>([]);
  const [editingNewPhoto, setEditingNewPhoto] = useState<File | null>(null);
  const [editingExistingPhotoIndex, setEditingExistingPhotoIndex] = useState<number | null>(null);
  const [editingVideo, setEditingVideo] = useState(false);

  useEffect(() => {
    if (!editingNewPhoto && pendingPhotoQueue.length > 0) {
      setEditingNewPhoto(pendingPhotoQueue[0]);
      setPendingPhotoQueue((q) => q.slice(1));
    }
  }, [editingNewPhoto, pendingPhotoQueue]);

  function finishEditingNewPhoto(file: File) {
    setPhotoFiles((prev) => [...prev, file]);
    setEditingNewPhoto(null);
  }

  // Resolved from `city` (the free-text location field below) so the listing
  // can show a real map pin on ListingDetail. Debounced the same way the
  // price suggestion is, and never blocks publishing if it fails/is empty --
  // see geocodeLocation's own error handling.
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!city.trim()) {
      setGeo(null);
      return;
    }
    let cancelled = false;
    setGeocoding(true);
    const timer = setTimeout(() => {
      geocodeLocation(city)
        .then((point) => {
          if (!cancelled) setGeo(point);
        })
        .finally(() => {
          if (!cancelled) setGeocoding(false);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city]);

  // Object URLs for instant local previews before anything is uploaded.
  // Must be revoked when files change/unmount, or they leak memory.
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (chosen.length === 0) return;
    const combined = [...photoFiles, ...chosen];
    const error = validatePhotoFiles(combined);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotoError(null);
    // Queue the newly picked files for the crop/rotate editor, one at a time,
    // instead of adding them straight to photoFiles.
    setPendingPhotoQueue((q) => [...q, ...chosen]);
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  // Same object-URL preview pattern as photos above — created on selection,
  // revoked on change/unmount so it doesn't leak memory.
  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  async function onVideoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after removing it
    if (!file) return;
    setVideoError(null);
    const sizeError = validateVideoFile(file);
    if (sizeError) {
      setVideoError(sizeError);
      return;
    }
    setCheckingVideo(true);
    try {
      const durationError = await validateVideoDuration(file);
      if (durationError) {
        setVideoError(durationError);
        return;
      }
      setVideoFile(file);
      setEditingVideo(true); // offer trim/mute right away, before it's locked in
    } finally {
      setCheckingVideo(false);
    }
  }

  function removeVideo() {
    setVideoFile(null);
    setVideoError(null);
  }

  // Once a category is picked, check how many active listings this user already
  // has in it — that's what drives the real progressive-cap and listing fee.
  useEffect(() => {
    if (!category || !user) {
      setActiveInCategory(null);
      return;
    }
    let cancelled = false;
    countActiveListingsInCategory(user.id, category)
      .then((n) => {
        if (!cancelled) setActiveInCategory(n);
      })
      .catch(() => {
        if (!cancelled) setActiveInCategory(0);
      });
    return () => {
      cancelled = true;
    };
  }, [category, user]);

  // Debounced: subCategory is free text, so wait for a pause in typing rather than
  // querying on every keystroke. Re-fires whenever category or subCategory changes.
  useEffect(() => {
    if (!category) {
      setPriceSuggestion(null);
      return;
    }
    let cancelled = false;
    setPriceSuggestionLoading(true);
    const timer = setTimeout(() => {
      suggestPrice(category, subCategory.trim() || undefined)
        .then((s) => {
          if (!cancelled) setPriceSuggestion(s);
        })
        .catch(() => {
          if (!cancelled) setPriceSuggestion(null);
        })
        .finally(() => {
          if (!cancelled) setPriceSuggestionLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, subCategory]);

  const nextListingFee = !activeInCategory
    ? 1
    : activeInCategory === 1
      ? 10
      : 25;
  const atCap =
    activeInCategory !== null && activeInCategory >= LISTING_CAP_PER_CATEGORY;

  // Everything now lives on one screen (no more Category/Details/Media/Review
  // steps), so there's no per-step "Next" gate to lean on for validation
  // anymore -- this is what the single Publish button at the bottom checks,
  // and what it shows the seller as a plain-English reason it's disabled.
  const missingFields: string[] = [];
  if (!category) missingFields.push("a category");
  if (atCap) missingFields.push("free slot in this category");
  if (!title.trim()) missingFields.push("a title");
  if (!price) missingFields.push("a price");
  if (!city.trim()) missingFields.push("a location");
  if (!videoFile) missingFields.push("a video");
  const canPublish = missingFields.length === 0 && !checkingVideo;

  async function handleSuggestDescription() {
    setDescSuggestError(null);
    setDescSuggestLoading(true);
    try {
      const suggestion = await suggestListingDescription({
        photoFiles,
        videoFile,
        category: category ?? undefined,
        subCategory: subCategory || undefined,
        condition,
        title: title || undefined,
      });
      if (suggestion) setDescription(suggestion);
    } catch (err: any) {
      setDescSuggestError(
        err?.message || "Could not generate a description. Try again.",
      );
    } finally {
      setDescSuggestLoading(false);
    }
  }

  async function publish() {
    if (!user || !category) return;
    if (!videoFile) {
      // Belt-and-braces: the Next button already blocks getting here without a
      // video, but publish() is a separate code path so it checks again too.
      setPublishError("A video of the item is required before publishing.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      // Reuse an order from a previous failed attempt instead of charging the
      // listing fee again -- payListingFee's Cashfree order stays valid and
      // unconsumed until verify-and-publish-listing (below) actually runs.
      const cashfreeOrderId =
        pendingOrderId ??
        (
          await payListingFee(
            category,
            pendingListingId,
            profile?.display_name || "e-Sauda seller",
            user.email || "",
          )
        ).cashfreeOrderId;
      setPendingOrderId(cashfreeOrderId);

      // Upload media to storage BEFORE creating the listing row, using the id
      // generated up front (pendingListingId) as the storage folder. This is
      // the fix for listings that could previously go live with missing photos
      // or (worse, since it's meant to be mandatory) no video at all: if an
      // upload fails here, nothing has been published yet, so there's no
      // half-finished listing sitting active on Browse/Explore for a buyer to
      // find. The person just sees an error and can retry without repaying.
      setUploadingVideo(true);
      let videoUrl: string;
      try {
        videoUrl = await uploadListingVideo(user.id, pendingListingId, videoFile);
      } catch (videoErr: any) {
        setPublishError(
          videoErr?.message ||
            "Could not upload the video. Check your connection and try again — you won't be charged again.",
        );
        return;
      } finally {
        setUploadingVideo(false);
      }

      // Photos are optional (the listing can publish with none), so a failed
      // photo upload only warns rather than blocking the whole publish — but it
      // still happens before the listing exists, so there's no window where an
      // *active* listing is silently missing photos it was supposed to have.
      let photoUrls: string[] = [];
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          photoUrls = await uploadListingPhotos(user.id, pendingListingId, photoFiles);
        } catch (photoErr) {
          setPhotoWarning(
            "Photos failed to upload, so this listing published without them. Add them from My Listings → Edit.",
          );
        } finally {
          setUploadingPhotos(false);
        }
      }

      await createListing(
        {
          title: title || "Untitled listing",
          price: Number(price) || 0,
          category,
          subCategory: subCategory || undefined,
          condition,
          description: description || undefined,
          city: city.trim() || profile?.city || undefined,
          location: city.trim() || undefined,
          latitude: geo?.lat ?? null,
          longitude: geo?.lng ?? null,
        },
        cashfreeOrderId,
        { id: pendingListingId, photoUrls, videoUrl },
      );

      setPosted(true);
      sessionStorage.removeItem("e-sauda-pending-listing-id");
    } catch (err: any) {
      if (err.message !== "cancelled") {
        setPublishError(
          err.message || "Could not publish this listing. Try again.",
        );
      }
    } finally {
      setPublishing(false);
    }
  }

  if (profile?.suspended) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Account suspended</h1>
        <p className="mt-2 text-sm text-ink/60">
          Your account has been suspended and can't post new listings. If you think
          this is a mistake, contact support.
        </p>
      </div>
    );
  }

  if (posted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check size={28} />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold">
          Listing published
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          "{title || "Your item"}" is live in {category}. Listing fee of ₹
          {nextListingFee} applied.
        </p>
        {photoWarning && (
          <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-400">
            {photoWarning}
          </p>
        )}
        {videoWarning && (
          <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-400">
            {videoWarning}
          </p>
        )}
        <button
          onClick={() => navigate("/orders")}
          className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
        >
          Go to My listings
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Post a listing</h1>
      <p className="mt-1 text-sm text-ink/60">
        Everything on one page — fill it in, then publish at the bottom.
      </p>

      <div className="mt-6 rounded-xl2 border border-line/5 bg-surface p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldIcon />
          {category
            ? `Listing cap in ${category}: ${activeInCategory ?? "…"} / ${LISTING_CAP_PER_CATEGORY}`
            : `Listing cap: choose a category to see it`}
        </p>
        <p className="mt-1 text-xs text-ink/50">
          Verify with DigiLocker on your profile to raise the cap.
        </p>
      </div>

      {/* Section 1: Category. Sub-category and the fee/cap notice stay attached
          to it since they only make sense once a category is picked. */}
      <div className="mt-8 rounded-xl2 border border-line/5 bg-surface p-6">
        <h2 className="font-semibold text-ink">1. Category</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => {
            const Icon = categoryIcons[c.name];
            return (
              <button
                key={c.name}
                onClick={() => setCategory(c.name)}
                className={`flex flex-col items-center gap-2 rounded-xl2 border p-4 transition-colors duration-150 ${
                  category === c.name
                    ? "border-clay bg-clay/5"
                    : "border-line/10 hover:border-line/20"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    category === c.name ? "bg-clay/15 text-clay" : "bg-ink/5 text-ink/70"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="text-sm font-medium">{c.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5">
          <label className="text-sm font-medium text-ink">Sub-category</label>
          <input
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            placeholder="e.g. Motorbikes, Keyboards"
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>
        {category &&
          (atCap ? (
            <div className="mt-5 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
              You've hit your listing cap for <strong>{category}</strong>. Complete a
              sale or raise your trust score to free up a slot.
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
              Listing fee for your next listing in <strong>this category</strong>: ₹
              {nextListingFee}. Rises as you post more in the same sub-category —
              bulk resellers pay ₹500/listing.
            </div>
          ))}
      </div>

      {/* Section 2: Item details, including the single Description field. The AI
          suggestion button lives right under it (rather than off in a separate
          Media step) since that's the field it actually fills in. */}
      <div className="mt-6 rounded-xl2 border border-line/5 bg-surface p-6">
        <h2 className="font-semibold text-ink">2. Item details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Keychron Q1 Pro · Wireless Mechanical"
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink">Price (₹)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12500"
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
            {priceSuggestionLoading ? (
              <p className="mt-1 text-xs text-ink/40">Checking similar listings…</p>
            ) : priceSuggestion ? (
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-xs text-ink/60">
                  Similar {priceSuggestion.matchedSubCategory ? subCategory : category} listings
                  go for{" "}
                  <strong className="text-ink">
                    ₹{priceSuggestion.low.toLocaleString("en-IN")}–₹
                    {priceSuggestion.high.toLocaleString("en-IN")}
                  </strong>{" "}
                  ({priceSuggestion.sampleSize} active listings)
                </p>
                <button
                  type="button"
                  onClick={() => setPrice(String(Math.round(priceSuggestion.median)))}
                  className="shrink-0 rounded-full bg-clay/10 px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay/20"
                >
                  Use ₹{priceSuggestion.median.toLocaleString("en-IN")}
                </button>
              </div>
            ) : (
              category && (
                <p className="mt-1 text-xs text-ink/50">
                  Not enough similar listings yet to suggest a price range.
                </p>
              )
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-ink">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            >
              <option>New</option>
              <option>Like new</option>
              <option>Good</option>
              <option>Fair</option>
            </select>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-ink">Description</label>
              {/* Only worth offering once there's an actual photo/video to look at
                  -- see handleSuggestDescription and the Media section below. */}
              {(photoFiles.length > 0 || videoFile) && (
                <button
                  type="button"
                  onClick={handleSuggestDescription}
                  disabled={descSuggestLoading}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-cream hover:bg-clay-light disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {descSuggestLoading ? "Looking at your photos/video…" : "Suggest description"}
                </button>
              )}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Any dents, accessories included, reason for selling..."
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
            {!photoFiles.length && !videoFile && (
              <p className="mt-1.5 text-xs text-ink/40">
                Add a photo or video below and a "Suggest description" button will
                appear here to draft this for you.
              </p>
            )}
            {descSuggestError && (
              <p className="mt-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                {descSuggestError}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-ink">
              Location (city / area)
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Koramangala, Bengaluru"
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-ink/50">
              Shown on your listing and used for the City filter on Browse. Only your
              general area is shown to buyers — never your exact address.
            </p>
            {geocoding && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/40">
                <MapPin size={12} /> Locating area on the map…
              </p>
            )}
            {!geocoding && geo && (
              <div className="mt-3">
                <ListingMap lat={geo.lat} lng={geo.lng} label={city} />
              </div>
            )}
            {!geocoding && city.trim() && !geo && (
              <p className="mt-2 text-xs text-ink/40">
                Couldn't place that area on the map — the listing will still publish fine.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Photos + video, on the same screen as everything else above --
          this used to be a separate "Media" step you could only reach after
          Details, which was also where the second, duplicate description field
          used to live. */}
      <div className="mt-6 rounded-xl2 border border-line/5 bg-surface p-6">
        <h2 className="font-semibold text-ink">3. Photos &amp; video</h2>
        <p className="mt-1 text-sm text-ink/60">
          Up to 6 photos, 5MB each. Background cleanup and stock-photo
          detection aren't wired up yet — those are a later AI branch.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {previewUrls.map((url, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded-xl2 bg-cream-dark"
            >
              <img
                src={url}
                alt={`Upload ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setEditingExistingPhotoIndex(i)}
                className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Edit photo"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {photoFiles.length < 6 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-line/15 text-ink/40 hover:border-clay/40">
              <Upload size={20} />
              <span className="text-xs">Upload</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={onFilesSelected}
              />
            </label>
          )}
        </div>
        {photoError && (
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
            {photoError}
          </p>
        )}
        {photoFiles.length === 0 && (
          <p className="mt-3 text-xs text-ink/40">
            No photos yet — you can still publish without any, the listing
            will just show a category icon instead.
          </p>
        )}

        <h3 className="mt-8 text-sm font-semibold text-ink">Video (required)</h3>
        <p className="mt-1 text-sm text-ink/60">
          A short clip actually showing the item. Under 50MB and 60 seconds.
        </p>
        {videoPreviewUrl ? (
          <div className="group relative mt-4 aspect-video w-full max-w-sm overflow-hidden rounded-xl2 bg-black">
            <video src={videoPreviewUrl} controls className="h-full w-full" />
            <button
              type="button"
              onClick={() => setEditingVideo(true)}
              className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Edit video"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={removeVideo}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove video"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="mt-4 flex aspect-video w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl2 border-2 border-dashed border-line/15 text-ink/40 hover:border-clay/40">
            <Video size={20} />
            <span className="text-xs">
              {checkingVideo ? "Checking video…" : "Upload a video"}
            </span>
            <input
              type="file"
              className="hidden"
              accept="video/*"
              disabled={checkingVideo}
              onChange={onVideoSelected}
            />
          </label>
        )}
        {videoError && (
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
            {videoError}
          </p>
        )}
      </div>

      {/* Bottom action bar: fee due + the single Publish button, sticky so it's
          reachable without scrolling back up on a long page. */}
      <div className="glass-elevated sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl2 p-4">
        <div>
          <p className="text-sm font-medium text-ink">
            Listing fee due now: ₹{nextListingFee}
          </p>
          {missingFields.length > 0 && (
            <p className="mt-0.5 text-xs text-ink/50">
              Still need: {missingFields.join(", ")}.
            </p>
          )}
          {publishError && (
            <p className="mt-1.5 max-w-md rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
              {publishError}
            </p>
          )}
        </div>
        <button
          onClick={publish}
          disabled={!canPublish || publishing}
          className="shrink-0 rounded-full bg-clay px-6 py-2.5 text-sm font-semibold text-cream hover:bg-clay-light disabled:opacity-40"
        >
          {uploadingVideo
            ? "Uploading video…"
            : uploadingPhotos
              ? "Uploading photos…"
              : publishing
                ? "Publishing…"
                : `Pay ₹${nextListingFee} & publish`}
        </button>
      </div>

      {editingNewPhoto && (
        <PhotoEditorModal
          file={editingNewPhoto}
          onSave={finishEditingNewPhoto}
          onCancel={() => finishEditingNewPhoto(editingNewPhoto)}
        />
      )}
      {editingExistingPhotoIndex !== null && (
        <PhotoEditorModal
          file={photoFiles[editingExistingPhotoIndex]}
          onCancel={() => setEditingExistingPhotoIndex(null)}
          onSave={(edited) => {
            setPhotoFiles((prev) =>
              prev.map((f, i) => (i === editingExistingPhotoIndex ? edited : f)),
            );
            setEditingExistingPhotoIndex(null);
          }}
        />
      )}
      {editingVideo && videoFile && videoPreviewUrl && (
        <VideoEditorModal
          file={videoFile}
          videoUrl={videoPreviewUrl}
          onCancel={() => setEditingVideo(false)}
          onSave={(edited) => {
            setVideoFile(edited);
            setEditingVideo(false);
          }}
        />
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" />
    </svg>
  );
}
