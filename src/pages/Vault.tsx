import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck, AlertTriangle, X, Star, Truck, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchMyPurchases,
  fetchMySales,
  getHandoverOtp,
  confirmHandover,
  cancelVaultOrder,
} from "../lib/vault";
import { fetchMyRatingForOrder, submitRating } from "../lib/ratings";
import { arrangeDelivery, markDelivered, fetchDeliveryForOrder } from "../lib/delivery";
import MeetupPlanner from "../components/MeetupPlanner";
import { downloadOrderReceipt } from "../lib/receipt";
import { VaultOrder, Rating, Delivery } from "../types";

const tabs = ["Buying", "Selling"] as const;

export default function Vault() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Buying");
  const [purchases, setPurchases] = useState<VaultOrder[]>([]);
  const [sales, setSales] = useState<VaultOrder[]>([]);
  const [loading, setLoading] = useState(true);

  function loadOrders() {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchMyPurchases(user.id), fetchMySales(user.id)])
      .then(([p, s]) => {
        setPurchases(p);
        setSales(s);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const funded = (tab === "Buying" ? purchases : sales).filter((o) => o.status === "funded");
  const history = (tab === "Buying" ? purchases : sales).filter((o) => o.status !== "funded");
  const isEmpty = funded.length === 0 && history.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Sauda Vault</h1>
      <p className="mt-1 text-sm text-ink/60">
        Funds locked until handover. Never accept a screenshot as proof of payment —
        only trust what this page shows you.
      </p>

      <div className="mt-6 inline-flex rounded-full border border-line/10 bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-cream-dark text-ink" : "text-ink/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl2 bg-cream-dark" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line/15 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay">
            <Lock size={26} />
          </span>
          <h2 className="mt-6 font-display text-xl font-semibold">
            {tab === "Buying" ? "Your Sauda Vault is empty" : "Nothing in escrow yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink/60">
            {tab === "Buying"
              ? "When you tap Buy with Vault on a listing, it appears here — funds locked, OTP for handover, all in one place."
              : "When a buyer purchases one of your listings with the Vault, it'll show up here for you to confirm handover."}
          </p>
          <button
            onClick={() => navigate("/browse")}
            className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
          >
            {tab === "Buying" ? "Find something to buy" : "Browse the marketplace"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {funded.map((order) =>
            tab === "Buying" ? (
              <BuyingCard key={order.id} order={order} onChange={loadOrders} />
            ) : (
              <SellingCard key={order.id} order={order} onChange={loadOrders} />
            ),
          )}
          {history.length > 0 && (
            <>
              <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-ink/40">
                Past orders
              </p>
              {history.map((order) => (
                <HistoryRow key={order.id} order={order} currentUserId={user?.id} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OrderHeader({ order }: { order: VaultOrder }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-cream-dark text-xl">
        {order.listingPhotoUrl ? (
          <img src={order.listingPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          order.listingEmoji || "📦"
        )}
      </span>
      <div>
        <p className="font-medium text-ink">
          {order.listingTitle || "Listing removed"}
          {order.listingRemoved && order.listingTitle && (
            <span className="ml-1.5 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-ink/40">
              Removed
            </span>
          )}
        </p>
        <p className="text-sm text-ink/50">₹{order.amount.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}

function BuyingCard({ order, onChange }: { order: VaultOrder; onChange: () => void }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryChecked, setDeliveryChecked] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [confirmingDelivered, setConfirmingDelivered] = useState(false);

  useEffect(() => {
    fetchDeliveryForOrder(order.id)
      .then(setDelivery)
      .catch(() => setDelivery(null))
      .finally(() => setDeliveryChecked(true));
  }, [order.id]);

  async function handleArrangeDelivery() {
    setArranging(true);
    setError(null);
    try {
      const d = await arrangeDelivery(order.id);
      setDelivery(d);
    } catch (err: any) {
      setError(err.message || "Couldn't arrange delivery.");
    } finally {
      setArranging(false);
    }
  }

  async function handleMarkDelivered() {
    if (!delivery) return;
    setConfirmingDelivered(true);
    setError(null);
    try {
      const d = await markDelivered(delivery.id);
      setDelivery(d);
    } catch (err: any) {
      setError(err.message || "Couldn't confirm delivery.");
    } finally {
      setConfirmingDelivered(false);
    }
  }

  async function reveal() {
    setRevealing(true);
    setError(null);
    try {
      const value = await getHandoverOtp(order.id);
      setOtp(value);
    } catch (err: any) {
      setError(err.message || "Couldn't fetch the OTP.");
    } finally {
      setRevealing(false);
    }
  }

  async function submitCancel() {
    setCancelling(true);
    setError(null);
    try {
      const result = await cancelVaultOrder(order.id, reason || "Buyer cancelled");
      if (result.refundFailed) {
        // The order IS cancelled -- this isn't a failure to retry the whole action,
        // just a heads-up that the money side needs another pass. Calling
        // cancelVaultOrder again on the same order safely retries only the refund
        // step (see the Edge Function's "already cancelled" branch).
        setError('Order cancelled. The refund is still processing — try again in a moment if it doesn\'t show up.');
      }
      onChange();
    } catch (err: any) {
      setError(err.message || "Couldn't cancel this order.");
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-emerald-500/30 bg-emerald-500/10/60 p-5">
      <OrderHeader order={order} />
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-400">
        <ShieldCheck size={15} /> Funds secured — safe to meet the seller
      </p>

      <MeetupPlanner vaultOrderId={order.id} otherPartyLabel="the seller" />

      {otp ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-ink/50">Handover OTP</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-widest text-ink">{otp}</p>
          <p className="mt-1 text-xs text-ink/50">
            Share this only after inspecting the item in person.
          </p>
        </div>
      ) : (
        <button
          onClick={reveal}
          disabled={revealing}
          className="mt-3 rounded-full border border-emerald-500/40 bg-surface px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          {revealing ? "Loading…" : "Reveal handover OTP"}
        </button>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}

      {deliveryChecked && (
        <div className="mt-4 border-t border-emerald-500/20 pt-3">
          {delivery ? (
            <div className="rounded-lg bg-surface p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                <Truck size={13} className="text-clay" /> {delivery.partner} rider{" "}
                {delivery.status === "delivered" ? "delivered" : "assigned"}
              </p>
              <p className="mt-1 text-xs text-ink/50">
                ETA {delivery.etaMinutes} min · {delivery.distanceKm}km · ₹{delivery.fee} delivery fee
              </p>
              {delivery.status === "assigned" && (
                <button
                  onClick={handleMarkDelivered}
                  disabled={confirmingDelivered}
                  className="mt-2 rounded-full border border-emerald-500/40 bg-surface px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  {confirmingDelivered ? "Confirming…" : "Mark as delivered"}
                </button>
              )}
              {delivery.status === "delivered" && (
                <p className="mt-1 text-xs text-emerald-400">
                  Once you've inspected the item, reveal your OTP above and share it via the rider.
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleArrangeDelivery}
              disabled={arranging}
              className="flex items-center gap-2 rounded-full border border-line/10 bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
            >
              <Truck size={13} />
              {arranging ? "Arranging…" : "Arrange delivery instead of meeting up"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-emerald-500/20 pt-3">
        {showCancel ? (
          <div className="space-y-2">
            {delivery && delivery.status !== "cancelled" && (
              <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-400">
                A {delivery.partner} rider has already been arranged for this order.
                Cancelling now deducts the ₹{delivery.fee} delivery fee from your
                refund — you'll get back ₹{Math.max(order.amount - delivery.fee, 0)}{" "}
                instead of ₹{order.amount}.
              </p>
            )}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (e.g. item didn't match the listing)"
              className="bg-surface text-ink w-full rounded-lg border border-line/10 px-3 py-2 text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={submitCancel}
                disabled={cancelling}
                className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </button>
              <button
                onClick={() => setShowCancel(false)}
                className="rounded-full border border-line/10 px-4 py-1.5 text-xs font-semibold text-ink/60"
              >
                Never mind
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCancel(true)}
            className="text-xs font-medium text-red-400 hover:underline"
          >
            Cancel this order
          </button>
        )}
      </div>
    </div>
  );
}

function SellingCard({ order, onChange }: { order: VaultOrder; onChange: () => void }) {
  const [entered, setEntered] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    fetchDeliveryForOrder(order.id)
      .then(setDelivery)
      .catch(() => setDelivery(null));
  }, [order.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setConfirming(true);
    setError(null);
    try {
      await confirmHandover(order.id, entered.trim());
      onChange();
    } catch (err: any) {
      setError(err.message || "Couldn't confirm handover.");
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-line/5 bg-surface p-5">
      <OrderHeader order={order} />

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-400">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Never accept a screenshot or text message as proof of payment. Only hand over
          the item once you've confirmed the OTP below.
        </span>
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-400">
        <ShieldCheck size={15} /> Funds secured in the Vault
      </p>

      <MeetupPlanner vaultOrderId={order.id} otherPartyLabel="the buyer" />

      {delivery && (
        <div className="mt-3 rounded-lg bg-cream-dark p-3 text-xs text-ink/70">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Truck size={13} className="text-clay" /> Buyer arranged {delivery.partner} delivery
          </p>
          <p className="mt-1">
            {delivery.status === "delivered"
              ? "Marked as delivered — expect the buyer to share the OTP via the rider."
              : `ETA ${delivery.etaMinutes} min · rider assigned`}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={entered}
          onChange={(e) => setEntered(e.target.value)}
          placeholder="Enter buyer's OTP"
          className="bg-surface text-ink w-40 rounded-lg border border-line/10 px-3 py-2 text-sm tracking-widest"
        />
        <button
          type="submit"
          disabled={confirming || !entered.trim()}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {confirming ? "Confirming…" : "Confirm handover"}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function HistoryRow({ order, currentUserId }: { order: VaultOrder; currentUserId?: string }) {
  const isCompleted = order.status === "completed";
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [checked, setChecked] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  async function handleDownloadReceipt() {
    if (!currentUserId) return;
    setDownloadingReceipt(true);
    setReceiptError(null);
    try {
      await downloadOrderReceipt(order, currentUserId);
    } catch (err: any) {
      setReceiptError(err.message || "Couldn't generate the receipt.");
    } finally {
      setDownloadingReceipt(false);
    }
  }

  useEffect(() => {
    if (!isCompleted || !currentUserId) {
      setChecked(true);
      return;
    }
    fetchMyRatingForOrder(order.id, currentUserId)
      .then(setMyRating)
      .catch(() => setMyRating(null))
      .finally(() => setChecked(true));
  }, [order.id, currentUserId, isCompleted]);

  return (
    <div className="rounded-xl2 border border-line/5 bg-surface p-4">
      <div className="flex items-center justify-between">
        <OrderHeader order={order} />
        {isCompleted ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <ShieldCheck size={12} /> Completed
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/50">
            <X size={12} /> Cancelled
          </span>
        )}
      </div>

      {!isCompleted && order.refundAmount !== null && (
        <p className="mt-2 text-xs text-ink/50">
          {!order.razorpayPaymentId || order.refundProcessedAt ? 'Refunded' : 'Refund processing'} ₹
          {order.refundAmount.toLocaleString("en-IN")}
          {order.deductedFee > 0 && (
            <> (₹{order.deductedFee.toLocaleString("en-IN")} delivery fee deducted)</>
          )}
        </p>
      )}

      <button
        onClick={handleDownloadReceipt}
        disabled={downloadingReceipt}
        className="mt-2 flex items-center gap-1 text-xs font-semibold text-clay hover:underline disabled:opacity-50"
      >
        <Download size={13} />
        {downloadingReceipt ? 'Generating…' : 'Download receipt'}
      </button>
      {receiptError && <p className="mt-1 text-xs text-red-400">{receiptError}</p>}

      {isCompleted && checked && (
        <div className="mt-3 border-t border-line/5 pt-3">
          {myRating ? (
            <p className="flex items-center gap-1 text-xs text-ink/50">
              You rated this transaction
              <StarRow value={myRating.stars} />
            </p>
          ) : ratingOpen ? (
            <RatingForm
              orderId={order.id}
              onDone={(r) => {
                setMyRating(r);
                setRatingOpen(false);
              }}
            />
          ) : (
            <button
              onClick={() => setRatingOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-clay hover:underline"
            >
              <Star size={13} /> Rate this transaction
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= value ? "fill-clay text-clay" : "text-ink/15"} />
      ))}
    </span>
  );
}

function RatingForm({ orderId, onDone }: { orderId: string; onDone: (r: Rating) => void }) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (stars === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const rating = await submitRating(orderId, stars, comment.trim() || undefined);
      onDone(rating);
    } catch (err: any) {
      setError(err.message || "Couldn't submit your rating.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              size={20}
              className={n <= (hovered || stars) ? "fill-clay text-clay" : "text-ink/15"}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional: how did it go? (e.g. item as described, on time, easy handover)"
        className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2 text-xs"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || stars === 0}
        className="mt-2 rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit rating"}
      </button>
    </div>
  );
}
