import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { categories } from "../data/listings";
import {
  countActiveListingsInCategory,
  createListing,
  attachPhotos,
  updateListingVideo,
} from "../lib/listings";
import {
  uploadListingPhotos,
  validatePhotoFiles,
  uploadListingVideo,
  validateVideoFile,
  validateVideoDuration,
} from "../lib/storage";
import { payListingFee } from "../lib/listingFee";
import { suggestPrice, PriceSuggestion } from "../lib/pricing";
import { Category } from "../types";
import { useAuth } from "../context/AuthContext";
import { Upload, Video, Check, X, MapPin, Pencil } from "lucide-react";
import { categoryIcons } from "../lib/categoryIcons";
import { geocodeLocation, GeoPoint } from "../lib/geocoding";
import ListingMap from "../components/ListingMap";
import PhotoEditorModal from "../components/PhotoEditorModal";
import VideoEditorModal from "../components/VideoEditorModal";

const stepNames = ["Category", "Details", "Media", "Review"];
const LISTING_CAP_PER_CATEGORY = 2; // matches the flat cap new users start with; grows with trust score later

export default function Sell() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
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
  // has in it — that's what drives the real progressive-cap and anti-bot fee.
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

  function next() {
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
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
      const { razorpayOrderId } = await payListingFee(
        category,
        profile?.display_name || "e-Sauda seller",
        user.email || "",
      );

      const listing = await createListing(
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
        razorpayOrderId,
      );

      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          const urls = await uploadListingPhotos(user.id, listing.id, photoFiles);
          await attachPhotos(listing.id, urls);
        } catch (photoErr) {
          // The listing itself published fine — don't block on a photo failure,
          // just let the user know so they're not confused why photos are missing.
          setPhotoWarning(
            "Listing published, but photo upload failed. You can retry from My listings once photo editing is added.",
          );
        } finally {
          setUploadingPhotos(false);
        }
      }

      setUploadingVideo(true);
      try {
        const url = await uploadListingVideo(user.id, listing.id, videoFile);
        await updateListingVideo(listing.id, url);
      } catch (videoErr) {
        // Same reasoning as the photo failure above — the listing already exists,
        // so don't roll it back over a transient upload hiccup. Point to Edit
        // Listing, which has its own add/replace video section, as the recovery path.
        setVideoWarning(
          "Listing published, but the video upload failed. Add it from My Listings → Edit.",
        );
      } finally {
        setUploadingVideo(false);
      }

      setPosted(true);
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
          "{title || "Your item"}" is live in {category}. Anti-bot fee of ₹
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
        A quick, guided flow. Fair-price check baked in.
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

      <div className="mt-8 flex items-center gap-3">
        {stepNames.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i === step
                  ? "bg-forest text-cream"
                  : i < step
                    ? "bg-clay text-cream"
                    : "bg-cream-dark text-ink/50"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${i === step ? "font-semibold text-ink" : "text-ink/50"}`}
            >
              {s}
            </span>
            {i < stepNames.length - 1 && (
              <span className="h-px w-8 bg-line/10" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl2 border border-line/5 bg-surface p-6">
        {step === 0 && (
          <div>
            <h2 className="font-semibold text-ink">Choose a category</h2>
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
              <label className="text-sm font-medium text-ink">
                Sub-category
              </label>
              <input
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="e.g. Motorbikes, Keyboards"
                className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
              />
            </div>
            {atCap ? (
              <div className="mt-5 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                You've hit your listing cap for <strong>{category}</strong>.
                Complete a sale or raise your trust score to free up a slot.
              </div>
            ) : (
              <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
                Anti-bot fee for your next listing in{" "}
                <strong>this category</strong>: ₹{nextListingFee}. Rises as you
                post more in the same sub-category — bulk resellers pay
                ₹500/listing.
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-semibold text-ink">Tell us about the item</h2>
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
                <label className="text-sm font-medium text-ink">
                  Price (₹)
                </label>
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
                  <p className="mt-1 text-xs text-ink/50">
                    Not enough similar listings yet to suggest a price range.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-ink">
                  Condition
                </label>
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
                <label className="text-sm font-medium text-ink">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Any dents, accessories included, reason for selling..."
                  className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
                />
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
        )}

        {step === 2 && (
          <div>
            <h2 className="font-semibold text-ink">Add photos</h2>
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

            <h2 className="mt-8 font-semibold text-ink">Add a video</h2>
            <p className="mt-1 text-sm text-ink/60">
              Required — a short clip actually showing the item. Under 50MB and 60
              seconds.
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
        )}

        {step === 3 && (
          <div>
            <h2 className="font-semibold text-ink">Review your listing</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row
                label="Category"
                value={
                  category
                    ? `${category}${subCategory ? " · " + subCategory : ""}`
                    : "—"
                }
              />
              <Row label="Title" value={title || "—"} />
              <Row label="Location" value={city || "—"} />
              <Row label="Price" value={price ? `₹${price}` : "—"} />
              <Row label="Condition" value={condition} />
              <Row label="Description" value={description || "—"} />
              <Row
                label="Photos"
                value={
                  photoFiles.length > 0
                    ? `${photoFiles.length} attached`
                    : "None"
                }
              />
              <Row label="Video" value={videoFile ? videoFile.name : "—"} />
              <Row label="Anti-bot fee due now" value={`₹${nextListingFee}`} />
            </div>
            {publishError && (
              <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
                {publishError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="rounded-full border border-line/10 px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-30"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            onClick={next}
            disabled={
              (step === 0 && (!category || atCap)) ||
              (step === 1 && (!title || !price || !city.trim())) ||
              (step === 2 && (!videoFile || checkingVideo))
            }
            className="rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={publishing}
            className="rounded-full bg-clay px-6 py-2.5 text-sm font-semibold text-cream hover:bg-clay-light disabled:opacity-50"
          >
            {uploadingPhotos
              ? "Uploading photos…"
              : uploadingVideo
                ? "Uploading video…"
                : publishing
                  ? "Publishing…"
                  : `Pay ₹${nextListingFee} & publish`}
          </button>
        )}
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
      {editingVideo && videoFile && (
        <VideoEditorModal
          file={videoFile}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line/5 py-2">
      <span className="text-ink/50">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-ink">
        {value}
      </span>
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
