import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, ShieldCheck, Award, Star, TrendingUp, Pencil, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchUserListings } from "../lib/listings";
import { fetchSavedListingIds } from "../lib/savedItems";
import { updateDisplayName } from "../lib/profiles";
import Reveal from "../components/Reveal";
import { deleteAccount } from "../lib/account";

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [activeListingCount, setActiveListingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Active listings, completed saudas (the user's own listings marked as sold), and
  // saved items are all real, from the `listings` and `saved_items` tables. Rating and trust score are
  // real too, from `profiles` (fed by submit_rating() in supabase/ratings_schema.sql).
  useEffect(() => {
    if (!user) return;
    fetchUserListings(user.id)
      .then((listings) => {
        setActiveListingCount(
          listings.filter((l) => l.status === "active").length,
        );
        setCompletedCount(listings.filter((l) => l.status === "sold").length);
      })
      .catch(() => {
        setActiveListingCount(0);
        setCompletedCount(0);
      });

    fetchSavedListingIds(user.id)
      .then((ids) => setSavedCount(ids.size))
      .catch(() => setSavedCount(0));
  }, [user]);

  const displayName = profile?.display_name || user?.email || "You";

  function startEditingName() {
    setNameInput(profile?.display_name && profile.display_name !== "New user" ? profile.display_name : "");
    setNameError(null);
    setEditingName(true);
  }

  async function saveName() {
    if (!user) return;
    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(user.id, nameInput);
      await refreshProfile();
      setEditingName(false);
    } catch (err: any) {
      setNameError(err.message || "Could not save name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      navigate("/");
    } catch (err: any) {
      setDeleteError(err.message || "Could not delete your account. Try again.");
      setDeleting(false);
    }
  }

  // Trust score and verified status are real, from the `profiles` table.
  const trustScore = profile?.trust_score ?? 50;
  const verified = profile?.verified ?? false;
  const ratingAvg = profile?.rating_avg ?? null;
  const ratingCount = profile?.rating_count ?? 0;

  const badges = [
    { icon: ShieldCheck, label: "Verified identity", unlocked: verified },
    { icon: Award, label: "First sauda", unlocked: completedCount > 0 },
    { icon: Star, label: "5-star seller", unlocked: !!ratingAvg && ratingAvg >= 4.5 && ratingCount >= 3 },
    { icon: TrendingUp, label: "Trust 80+", unlocked: trustScore >= 80 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Reveal className="rounded-xl2 bg-gradient-to-br from-clay/15 to-cream-dark p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-2xl font-semibold text-cream">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    placeholder="Your name"
                    className="rounded-lg border border-line/10 bg-surface px-3 py-1.5 font-display text-xl font-semibold"
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="rounded-full bg-forest p-1.5 text-cream hover:bg-forest-light disabled:opacity-50"
                    aria-label="Save name"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="rounded-full border border-line/10 p-1.5 text-ink/60 hover:bg-ink/5"
                    aria-label="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
                  {displayName}
                  <button
                    onClick={startEditingName}
                    className="text-ink/30 hover:text-ink/60"
                    aria-label="Edit name"
                  >
                    <Pencil size={14} />
                  </button>
                </h1>
              )}
              {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
              <p className="text-sm text-ink/60">
                {profile?.city || "Location not set"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/50">
                <span>Logged in as {user?.email}</span>
                <span className="text-ink/30">·</span>
                <span className="font-mono">
                  ID: {user?.id ? `${user.id.slice(0, 8)}…` : "—"}
                </span>
                {user?.id && (
                  <button
                    onClick={() => navigator.clipboard.writeText(user.id)}
                    className="rounded border border-line/10 px-1.5 py-0.5 text-[10px] font-medium text-ink/50 hover:bg-ink/5"
                  >
                    Copy full ID
                  </button>
                )}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span
                  className={verified ? "text-emerald-400" : "text-amber-400"}
                >
                  {verified ? "Verified" : "Not verified"}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink/50">
              Trust score
            </p>
            <p className="font-display text-4xl font-semibold text-clay">
              {trustScore}
            </p>
            <p className="mt-1 flex items-center justify-end gap-1 text-xs text-ink/50">
              {ratingAvg ? (
                <>
                  <Star size={12} className="fill-clay text-clay" />
                  {ratingAvg.toFixed(1)} ({ratingCount} rating{ratingCount === 1 ? "" : "s"})
                </>
              ) : (
                "No ratings yet"
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-forest"
            style={{ width: `${trustScore}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Sell more items, get 5-star ratings and verify identity to grow.
        </p>
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Items sold" value={completedCount} />
        <Link to="/my-listings">
          <Stat
            label="Active listings"
            value={activeListingCount}
            suffix="per category cap: 2"
          />
        </Link>
        <Stat label="Saved items" value={savedCount} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border-2 border-dashed border-clay/40 bg-surface p-6">
        <div>
          <p className="font-semibold text-ink">Unlock full trust</p>
          <p className="mt-1 text-sm text-ink/60">
            Verify with DigiLocker → +20 trust, +5 listing cap, verified badge
            on all your ads.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            disabled
            title="DigiLocker verification is coming soon"
            className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream opacity-50 cursor-not-allowed"
          >
            <Lock size={15} /> Verify with DigiLocker
          </button>
          <span className="text-xs text-ink/40">Coming soon</span>
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Badges</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.label}
            className={`flex flex-col items-center gap-2 rounded-xl2 border p-6 text-center ${
              b.unlocked ? "border-clay bg-clay/5" : "border-line/10"
            }`}
          >
            <b.icon
              size={22}
              className={b.unlocked ? "text-clay" : "text-ink/30"}
            />
            <span className="text-sm font-medium">{b.label}</span>
            <span className="text-xs text-ink/40">
              {b.unlocked ? "✓" : "Locked"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={() => navigate("/my-listings")}
          className="rounded-full border border-line/10 bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-cream-dark"
        >
          My listings
        </button>
        <button
          onClick={() => navigate("/sell")}
          className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light"
        >
          Post new listing
        </button>
      </div>

      <div className="mt-10 rounded-xl2 border border-red-500/30 bg-red-500/10/50 p-6">
        <h2 className="font-display text-lg font-semibold text-red-400">Danger zone</h2>
        {!showDeleteConfirm ? (
          <>
            <p className="mt-1 text-sm text-ink/60">
              Permanently delete your account. Your name and personal details are
              removed everywhere; past chats and ratings the other party is involved in
              stay on their record, just showing "Deleted user" instead of your name.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-4 rounded-full border border-red-500/40 bg-surface px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10"
            >
              Delete my account
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink/60">
              This can't be undone. You'll be logged out immediately and won't be
              able to log back in. Your active listings will be taken down.
            </p>
            <label className="mt-4 block text-sm font-medium text-ink">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="bg-surface text-ink mt-2 w-full max-w-xs rounded-lg border border-red-500/30 px-3 py-2 text-sm"
            />
            {deleteError && <p className="mt-2 text-sm text-red-400">{deleteError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="rounded-full border border-line/10 bg-surface px-5 py-2.5 text-sm font-semibold text-ink/70 hover:bg-cream-dark"
              >
                Never mind
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl2 border border-line/5 bg-surface p-5">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="font-display text-3xl font-semibold text-ink">{value}</p>
      {suffix && <p className="text-xs text-ink/40">{suffix}</p>}
    </div>
  );
}
