import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageSquare, AlertTriangle, Ban, ShieldOff, IndianRupee, Check, X, Sparkles, ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
} from '../lib/chat'
import {
  fetchOffers,
  makeOffer,
  acceptOffer,
  declineOffer,
  withdrawOffer,
  counterOffer,
  subscribeToOffers,
} from '../lib/chatOffers'
import { scanMessage, describeFlags } from '../lib/moderation'
import { blockUser, unblockUser, amIBlocking, fetchMyBlockedUsers, BlockedUser } from '../lib/blocking'
import { ConversationSummary, Message, ChatOffer } from '../types'

export default function Messages() {
  const { id: activeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [offers, setOffers] = useState<ChatOffer[]>([])
  const [offerDraft, setOfferDraft] = useState('')
  const [sendingOffer, setSendingOffer] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [actingOfferId, setActingOfferId] = useState<string | null>(null)
  const [pendingWarning, setPendingWarning] = useState<{ body: string; reasons: string[] } | null>(
    null,
  )
  const [isBlocked, setIsBlocked] = useState(false) // have I blocked the other party in this thread
  const [blockActing, setBlockActing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showBlockedList, setShowBlockedList] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [counteringOfferId, setCounteringOfferId] = useState<string | null>(null)
  const [counterDraft, setCounterDraft] = useState('')
  const [counterSubmitting, setCounterSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load the inbox list once we know who's logged in.
  useEffect(() => {
    if (!user) return
    setLoadingList(true)
    fetchConversations(user.id)
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoadingList(false))
  }, [user])

  // Load the open thread + subscribe to new messages arriving live.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setOffers([])
      return
    }
    setLoadingThread(true)
    setPendingWarning(null)
    setOfferError(null)
    fetchMessages(activeId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingThread(false))
    fetchOffers(activeId)
      .then(setOffers)
      .catch(() => setOffers([]))

    const unsubscribeMessages = subscribeToMessages(activeId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
    })
    const unsubscribeOffers = subscribeToOffers(activeId, (offer) => {
      setOffers((prev) => {
        const exists = prev.some((o) => o.id === offer.id)
        return exists ? prev.map((o) => (o.id === offer.id ? offer : o)) : [...prev, offer]
      })
    })
    return () => {
      unsubscribeMessages()
      unsubscribeOffers()
    }
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, offers])

  // Re-check block status whenever the active thread changes -- otherPartyId comes
  // from the conversation list, which is why this depends on `conversations` too.
  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId)
    if (!user || !conv) {
      setIsBlocked(false)
      return
    }
    amIBlocking(user.id, conv.otherPartyId)
      .then(setIsBlocked)
      .catch(() => setIsBlocked(false))
  }, [activeId, conversations, user])

  function loadBlockedUsers() {
    if (!user) return
    fetchMyBlockedUsers(user.id)
      .then(setBlockedUsers)
      .catch(() => setBlockedUsers([]))
  }

  async function handleToggleBlock() {
    const conv = conversations.find((c) => c.id === activeId)
    if (!user || !conv) return
    setBlockActing(true)
    try {
      if (isBlocked) {
        await unblockUser(user.id, conv.otherPartyId)
        setIsBlocked(false)
      } else {
        if (!confirm(`Block this user? Neither of you will be able to message the other.`)) return
        await blockUser(user.id, conv.otherPartyId)
        setIsBlocked(true)
      }
    } catch (err: any) {
      setSendError(err.message || 'Could not update block status')
    } finally {
      setBlockActing(false)
    }
  }

  async function handleUnblockFromList(otherId: string) {
    if (!user) return
    try {
      await unblockUser(user.id, otherId)
      setBlockedUsers((prev) => prev.filter((b) => b.id !== otherId))
      if (conversations.find((c) => c.id === activeId)?.otherPartyId === otherId) setIsBlocked(false)
    } catch {
      // Non-critical -- the list just won't update; they can retry from the same panel.
    }
  }

  async function actuallySend(body: string) {
    if (!user || !activeId) return
    setSending(true)
    setSendError(null)
    try {
      await sendMessage(activeId, user.id, body)
      // No optimistic append needed — the Realtime subscription above delivers
      // our own message back within milliseconds, keeping a single source of truth.
    } catch (err: any) {
      setDraft(body) // put it back so the user doesn't lose what they typed
      // The blocking trigger (blocking_schema.sql) rejects the insert with this
      // message when either party has blocked the other -- most likely here because
      // the *other* person blocked *you*, since our own "isBlocked" state already
      // hides the send form when you're the one who blocked them.
      setSendError(
        err.message?.includes('blocked')
          ? "This message couldn't be delivered."
          : err.message || 'Could not send message',
      )
    } finally {
      setSending(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeId || !draft.trim()) return
    const body = draft.trim()

    // Scan before sending, not after — a warning is only useful if it can still
    // change the person's mind. If it's clean, send immediately as before.
    const { flagged, reasons } = scanMessage(body)
    if (flagged) {
      setPendingWarning({ body, reasons })
      return
    }

    setDraft('')
    await actuallySend(body)
  }

  async function sendAnyway() {
    if (!pendingWarning) return
    const { body } = pendingWarning
    setPendingWarning(null)
    setDraft('')
    await actuallySend(body)
  }

  const activeConversation = conversations.find((c) => c.id === activeId)
  const isBuyer = !!user && activeConversation?.buyerId === user.id
  const hasPendingOffer = offers.some((o) => o.status === 'pending')

  async function handleMakeOffer(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeId) return
    const amount = Number(offerDraft)
    if (!amount || amount <= 0) {
      setOfferError('Enter a valid amount.')
      return
    }
    setSendingOffer(true)
    setOfferError(null)
    try {
      const offer = await makeOffer(activeId, user.id, amount)
      setOffers((prev) => [...prev, offer])
      setOfferDraft('')
    } catch (err: any) {
      setOfferError(err.message || 'Could not send that offer. Try again.')
    } finally {
      setSendingOffer(false)
    }
  }

  async function handleAcceptOffer(offerId: string) {
    setActingOfferId(offerId)
    setOfferError(null)
    try {
      await acceptOffer(offerId)
      setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'accepted' } : o)))
    } catch (err: any) {
      setOfferError(err.message || 'Could not accept this offer.')
    } finally {
      setActingOfferId(null)
    }
  }

  async function handleDeclineOffer(offerId: string) {
    setActingOfferId(offerId)
    setOfferError(null)
    try {
      await declineOffer(offerId)
      setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'declined' } : o)))
    } catch (err: any) {
      setOfferError(err.message || 'Could not decline this offer.')
    } finally {
      setActingOfferId(null)
    }
  }

  async function handleWithdrawOffer(offerId: string) {
    setActingOfferId(offerId)
    setOfferError(null)
    try {
      await withdrawOffer(offerId)
      setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'withdrawn' } : o)))
    } catch (err: any) {
      setOfferError(err.message || 'Could not withdraw this offer.')
    } finally {
      setActingOfferId(null)
    }
  }

  // Lets whichever side didn't make the current pending offer propose a
  // different price instead of just accepting/declining it. Server-side this
  // atomically declines the old offer and inserts a fresh one from this side
  // (see counter_chat_offer in chat_offers_negotiation_schema.sql) — both
  // updates are reflected here optimistically, then corrected by whatever the
  // realtime subscription reports back.
  async function handleCounterOffer(offerId: string) {
    const amount = Number(counterDraft)
    if (!amount || amount <= 0) {
      setOfferError('Enter a valid counter amount.')
      return
    }
    setCounterSubmitting(true)
    setOfferError(null)
    try {
      const newOffer = await counterOffer(offerId, amount)
      setOffers((prev) => [
        ...prev.map((o) => (o.id === offerId ? { ...o, status: 'declined' as const, supersededBy: newOffer.id } : o)),
        newOffer,
      ])
      setCounteringOfferId(null)
      setCounterDraft('')
    } catch (err: any) {
      setOfferError(err.message || 'Could not send that counter-offer. Try again.')
    } finally {
      setCounterSubmitting(false)
    }
  }

  // Messages and offers are separate tables, sorted together into a single
  // timeline so an offer card appears right where it was actually sent,
  // relative to the surrounding conversation.
  type TimelineItem =
    | { kind: 'message'; at: string; message: Message }
    | { kind: 'offer'; at: string; offer: ChatOffer }
  const timeline: TimelineItem[] = [
    ...messages.map((message) => ({ kind: 'message' as const, at: message.createdAt, message })),
    ...offers.map((offer) => ({ kind: 'offer' as const, at: offer.createdAt, offer })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Messages</h1>
        <button
          onClick={() => {
            setShowBlockedList((v) => !v)
            if (!showBlockedList) loadBlockedUsers()
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-ink"
        >
          <ShieldOff size={13} /> Blocked users
        </button>
      </div>

      {showBlockedList && (
        <div className="mt-3 rounded-xl2 border border-line/5 bg-surface p-4">
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-ink/50">You haven't blocked anyone.</p>
          ) : (
            <ul className="space-y-2">
              {blockedUsers.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{b.displayName}</span>
                  <button
                    onClick={() => handleUnblockFromList(b.id)}
                    className="text-xs font-medium text-clay hover:underline"
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-0 overflow-hidden rounded-xl2 border border-line/5 bg-surface md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="border-b border-line/5 md:border-b-0 md:border-r">
          {loadingList ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-cream-dark" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay/10 text-clay"
              >
                <MessageSquare size={24} />
              </motion.span>
              <p className="mt-4 text-sm font-medium text-ink/70">No conversations yet.</p>
              <p className="mt-1 text-xs text-ink/40">Chat with a seller from any listing page.</p>
            </div>
          ) : (
            <ul className="relative max-h-[70vh] divide-y divide-line/5 overflow-y-auto">
              {conversations.map((c, idx) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.2) }}
                  className="relative"
                >
                  {c.id === activeId && (
                    <motion.span
                      layoutId="active-conversation"
                      className="absolute inset-y-0 left-0 w-0.5 bg-clay"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <button
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={`group flex w-full items-center gap-3 p-4 text-left transition-colors duration-150 hover:bg-cream-dark ${
                      c.id === activeId ? 'bg-cream-dark' : ''
                    }`}
                  >
                    <Link
                      to={`/listing/${c.listingId}`}
                      onClick={(e) => e.stopPropagation()}
                      title="Go to listing"
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-clay/25 to-forest/25 text-xl ring-clay/40 transition hover:ring-2"
                    >
                      {c.listingPhotoUrl ? (
                        <img src={c.listingPhotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        c.listingEmoji
                      )}
                    </Link>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.listingTitle}</span>
                        <span className="shrink-0 text-xs text-ink/40">
                          ₹{c.listingPrice.toLocaleString('en-IN')}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-ink/50">
                        {c.lastMessageBody || 'Say hello 👋'}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="flex h-[70vh] flex-col">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <motion.span
                animate={{ y: [0, -8, 0], rotate: [0, 3, 0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-clay/15 to-forest/15 text-clay"
              >
                <Sparkles size={26} strokeWidth={1.5} />
              </motion.span>
              <p className="text-sm text-ink/40">Select a conversation to start chatting.</p>
            </div>
          ) : (
            <>
              {activeConversation && (
                <div className="flex items-center justify-between gap-3 border-b border-line/5 p-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-clay/25 to-forest/25 text-lg">
                      {activeConversation.listingPhotoUrl ? (
                        <img
                          src={activeConversation.listingPhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        activeConversation.listingEmoji
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {activeConversation.listingTitle}
                      </span>
                      <span className="block text-xs text-ink/50">
                        ₹{activeConversation.listingPrice.toLocaleString('en-IN')}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Link
                      to={`/listing/${activeConversation.listingId}`}
                      className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark"
                    >
                      <ExternalLink size={13} /> View listing
                    </Link>
                    <button
                      onClick={handleToggleBlock}
                      disabled={blockActing}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                        isBlocked
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-line/10 bg-surface text-ink/60 hover:bg-cream-dark'
                      }`}
                    >
                      <Ban size={13} /> {isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </span>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingThread ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 w-2/3 animate-pulse rounded-lg bg-cream-dark" />
                    ))}
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="mt-10 text-center text-sm text-ink/40">
                    No messages yet — say hello to get things moving.
                  </p>
                ) : (
                  timeline.map((item) => {
                    if (item.kind === 'message') {
                      const m = item.message
                      const mine = m.senderId === user?.id
                      return (
                        <motion.div
                          key={`m-${m.id}`}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-xl2 px-4 py-2 text-sm ${
                              mine ? 'bg-forest text-cream' : 'bg-cream-dark text-ink'
                            }`}
                          >
                            {m.body}
                          </div>
                          {m.flagged && (
                            <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-400">
                              <AlertTriangle size={11} /> May contain sensitive info — never share OTPs
                              or pay outside the Vault
                            </span>
                          )}
                        </motion.div>
                      )
                    }

                    const o = item.offer
                    // Who made THIS offer, from the server-derived offered_by (not just
                    // "am I the buyer" — either side can now propose or counter a price,
                    // see chat_offers_negotiation_schema.sql).
                    const iMadeThisOffer = (o.offeredBy === 'buyer') === isBuyer
                    const canRespond = !iMadeThisOffer && o.status === 'pending' // whoever didn't make it
                    const canWithdraw = iMadeThisOffer && o.status === 'pending' // whoever made it
                    const isCountering = counteringOfferId === o.id
                    const acting = actingOfferId === o.id
                    const statusCopy: Record<ChatOffer['status'], string> = {
                      pending: iMadeThisOffer ? 'Waiting for a response' : 'Awaiting your response',
                      accepted: 'Offer accepted — buyer can now buy at this price',
                      declined: o.supersededBy ? 'Countered below' : 'Offer declined',
                      withdrawn: 'Offer withdrawn',
                      consumed: 'Purchased at this price',
                    }
                    return (
                      <motion.div
                        key={`o-${o.id}`}
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="flex justify-center"
                      >
                        <div className="w-full max-w-xs rounded-xl2 border border-clay/30 bg-clay/5 p-3 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-ink/40">
                            {o.offeredBy === 'seller' ? 'Seller offered' : 'Buyer offered'}
                          </p>
                          <p className="flex items-center justify-center gap-1 text-sm font-semibold text-ink">
                            <IndianRupee size={13} />
                            {o.amount.toLocaleString('en-IN')}
                          </p>
                          <p className="mt-0.5 text-xs text-ink/50">{statusCopy[o.status]}</p>
                          {(canRespond || canWithdraw) && !isCountering && (
                            <div className="mt-2 flex flex-wrap justify-center gap-2">
                              {canRespond && (
                                <>
                                  <button
                                    onClick={() => handleAcceptOffer(o.id)}
                                    disabled={acting}
                                    className="flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream disabled:opacity-50"
                                  >
                                    <Check size={12} /> Accept
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCounteringOfferId(o.id)
                                      setCounterDraft(String(o.amount))
                                      setOfferError(null)
                                    }}
                                    disabled={acting}
                                    className="flex items-center gap-1 rounded-full border border-clay/40 bg-surface px-3 py-1 text-xs font-semibold text-clay disabled:opacity-50"
                                  >
                                    Counter
                                  </button>
                                  <button
                                    onClick={() => handleDeclineOffer(o.id)}
                                    disabled={acting}
                                    className="flex items-center gap-1 rounded-full border border-line/10 bg-surface px-3 py-1 text-xs font-semibold text-ink/60 disabled:opacity-50"
                                  >
                                    <X size={12} /> Decline
                                  </button>
                                </>
                              )}
                              {canWithdraw && (
                                <button
                                  onClick={() => handleWithdrawOffer(o.id)}
                                  disabled={acting}
                                  className="rounded-full border border-line/10 bg-surface px-3 py-1 text-xs font-semibold text-ink/60 disabled:opacity-50"
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          )}
                          {isCountering && (
                            <div className="mt-2 flex items-center gap-2">
                              <IndianRupee size={12} className="shrink-0 text-ink/40" />
                              <input
                                type="number"
                                min="1"
                                autoFocus
                                value={counterDraft}
                                onChange={(e) => setCounterDraft(e.target.value)}
                                className="w-full rounded-full border border-line/10 bg-surface px-2.5 py-1 text-xs focus:outline-none"
                              />
                              <button
                                onClick={() => handleCounterOffer(o.id)}
                                disabled={counterSubmitting || !counterDraft}
                                className="shrink-0 rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-cream disabled:opacity-40"
                              >
                                {counterSubmitting ? '…' : 'Send'}
                              </button>
                              <button
                                onClick={() => setCounteringOfferId(null)}
                                className="shrink-0 rounded-full border border-line/10 bg-surface px-2 py-1 text-xs text-ink/50"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {profile?.suspended ? (
                <p className="border-t border-line/5 p-4 text-center text-sm text-red-400">
                  Your account is suspended and can't send messages.
                </p>
              ) : isBlocked ? (
                <p className="border-t border-line/5 p-4 text-center text-sm text-ink/50">
                  You've blocked this user.{' '}
                  <button onClick={handleToggleBlock} className="font-medium text-clay hover:underline">
                    Unblock
                  </button>{' '}
                  to message them again.
                </p>
              ) : (
                <>
                  {!hasPendingOffer && (
                    <form
                      onSubmit={handleMakeOffer}
                      className="flex items-center gap-2 border-t border-line/5 bg-clay/5 px-4 py-2.5"
                    >
                      <IndianRupee size={14} className="shrink-0 text-ink/40" />
                      <input
                        type="number"
                        min="1"
                        value={offerDraft}
                        onChange={(e) => setOfferDraft(e.target.value)}
                        placeholder={isBuyer ? 'Offer a different price' : 'Offer the buyer a price'}
                        disabled={sendingOffer}
                        className="flex-1 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={sendingOffer || !offerDraft}
                        className="rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
                      >
                        {sendingOffer ? 'Sending…' : 'Make offer'}
                      </button>
                    </form>
                  )}
                  {offerError && (
                    <p className="mx-4 mt-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{offerError}</p>
                  )}

                  {sendError && (
                    <p className="mx-4 mb-2 mt-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{sendError}</p>
                  )}
                  {pendingWarning && (
                    <div className="mx-4 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="flex items-start gap-2 text-xs text-amber-400">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        {describeFlags(pendingWarning.reasons)}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setPendingWarning(null)}
                          className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
                        >
                          Edit message
                        </button>
                        <button
                          onClick={sendAnyway}
                          disabled={sending}
                          className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          Send anyway
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line/5 p-4">
                    <input
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value)
                        if (pendingWarning) setPendingWarning(null)
                      }}
                      placeholder="Type a message…"
                      className="bg-surface text-ink flex-1 rounded-full border border-line/10 px-4 py-2.5 text-sm focus:outline-none"
                    />
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-cream transition-transform disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </motion.button>
                  </form>
                </>
              )}
              <p className="border-t border-line/5 px-4 py-2 text-center text-[11px] text-ink/40">
                Never share OTPs or accept payment outside the e-Sauda Vault.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
