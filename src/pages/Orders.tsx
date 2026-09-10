import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Trash2, ShieldCheck, X, Clock } from "lucide-react";
import Reveal from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { deleteListing, fetchUserListings } from "../lib/listings";
import { deleteListingPhotos } from "../lib/storage";
import { fetchMyPurchases, fetchMySales } from "../lib/vault";
import { Listing, VaultOrder } from "../types";

const tabs = ["Buying", "Selling", "My listings"] as const;

export default function Orders() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Buying");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<VaultOrder[]>([]);
  const [sales, setSales] = useState<VaultOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadMyListings() {
    if (!user) return;
    setLoading(true);
    fetchUserListings(user.id)
      .then(setMyListings)
      .catch(() => setMyListings([]))
      .finally(() => setLoading(false));
  }

  // Real purchase/sale history from the Vault system -- this used to be a static
  // "No purchases yet." / "Nothing sold yet." shown unconditionally regardless of
  // what the person had actually bought or sold, with `counts` literally hardcoded
  // to 0 for both. fetchMyPurchases/fetchMySales already existed (Vault.tsx uses
  // them for the live escrow view) -- this page now uses the same real data for a
  // plain order-history list. The live escrow actions (OTP, meetup, delivery,
  // rating, receipt download) stay on /vault, which each row links to.
  function loadOrders() {
    if (!user) return;
    setOrdersLoading(true);
    Promise.all([fetchMyPurchases(user.id), fetchMySales(user.id)])
      .then(([p, s]) => {
        setPurchases(p);
        setSales(s);
      })
      .catch(() => {
        setPurchases([]);
        setSales([]);
      })
      .finally(() => setOrdersLoading(false));
  }

  useEffect(() => {
    loadMyListings();
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleDelete(id: string) {
    if (!user) return;
    setDeletingId(id);
    try {
      // Best-effort — if photo cleanup fails, still remove the listing row rather
      // than leaving an orphaned, undeletable listing stuck in the UI.
      await deleteListingPhotos(user.id, id).catch(() => {});
      await deleteListing(id);
      setMyListings((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const activeMyListings = myListings.filter((l) => l.status === "active");
  const counts = {
    Buying: purchases.length,
    Selling: sales.length,
    "My listings": activeMyListings.length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Reveal><h1 className="font-display text-3xl font-semibold">My orders</h1></Reveal>

      <div className="mt-6 inline-flex rounded-full border border-line/10 bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-cream-dark text-ink" : "text-ink/50"
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {tab === "My listings" ? (
        loading ? (
          <div className="mt-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl2 bg-cream-dark"
              />
            ))}
          </div>
        ) : myListings.length > 0 ? (
          <div className="mt-6 space-y-3">
            {myListings.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl2 border border-line/5 bg-surface p-4"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream-dark text-2xl">
                    {l.emoji}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{l.title}</p>
                    <p className="text-sm text-ink/50">
                      ₹{l.price.toLocaleString("en-IN")} · {l.category}
                      {l.status !== "active" && (
                        <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs capitalize">
                          {l.status}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={deletingId === l.id}
                  className="flex items-center gap-1 rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-red-500/30 hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 size={13} />{" "}
                  {deletingId === l.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="You haven't posted anything yet."
            cta="Post a listing"
            onClick={() => navigate("/sell")}
          />
        )
      ) : (
        <OrdersList
          loading={ordersLoading}
          orders={tab === "Buying" ? purchases : sales}
          emptyMessage={tab === "Buying" ? "No purchases yet." : "Nothing sold yet."}
          onEmptyClick={() => navigate("/browse")}
          emptyCta="Explore marketplace"
        />
      )}
    </div>
  );
}

function OrdersList({
  loading,
  orders,
  emptyMessage,
  emptyCta,
  onEmptyClick,
}: {
  loading: boolean;
  orders: VaultOrder[];
  emptyMessage: string;
  emptyCta: string;
  onEmptyClick: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl2 bg-cream-dark" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState message={emptyMessage} cta={emptyCta} onClick={onEmptyClick} />;
  }

  return (
    <div className="mt-6 space-y-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          to="/vault"
          className="flex items-center justify-between rounded-xl2 border border-line/5 bg-surface p-4 transition-colors hover:bg-cream-dark"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-cream-dark text-2xl">
              {o.listingPhotoUrl ? (
                <img src={o.listingPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                o.listingEmoji || "📦"
              )}
            </span>
            <div>
              <p className="font-medium text-ink">{o.listingTitle || "Listing removed"}</p>
              <p className="text-sm text-ink/50">
                ₹{o.amount.toLocaleString("en-IN")} ·{" "}
                {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
          <OrderStatusBadge status={o.status} />
        </Link>
      ))}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: VaultOrder["status"] }) {
  if (status === "completed") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <ShieldCheck size={12} /> Completed
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/50">
        <X size={12} /> Cancelled
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-clay/15 px-2.5 py-1 text-xs font-medium text-clay">
      <Clock size={12} /> In escrow
    </span>
  );
}

function EmptyState({
  message,
  cta,
  onClick,
}: {
  message: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line/15 py-20 text-center">
      <Package size={36} className="text-ink/30" />
      <p className="mt-4 font-medium text-ink">{message}</p>
      <button
        onClick={onClick}
        className="mt-4 flex items-center gap-2 rounded-full border border-line/10 bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream-dark"
      >
        {cta}
      </button>
    </div>
  );
}
