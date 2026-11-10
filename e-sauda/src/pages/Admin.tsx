import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Check, X, Trash2, UserX, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchReports, updateReportStatus, removeListing, setUserSuspended, AdminReport } from '../lib/admin'
import { reportReasonLabels } from '../lib/reports'

const tabs: Array<'open' | 'reviewed' | 'dismissed' | 'all'> = ['open', 'reviewed', 'dismissed', 'all']

export default function Admin() {
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'open' | 'reviewed' | 'dismissed' | 'all'>('open')
  const [reports, setReports] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.is_admin) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchReports(tab)
      .then((data) => {
        if (!cancelled) setReports(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load reports')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, profile?.is_admin])

  async function act(id: string, status: 'reviewed' | 'dismissed') {
    setActingOn(id)
    try {
      await updateReportStatus(id, status)
      // The RLS-backed query for the current tab wouldn't include this row anymore if
      // we're on 'open', so just drop it from the list rather than re-fetching.
      setReports((prev) => (tab === 'all' ? prev.map((r) => (r.id === id ? { ...r, status } : r)) : prev.filter((r) => r.id !== id)))
    } catch (err: any) {
      setError(err.message || 'Could not update this report')
    } finally {
      setActingOn(null)
    }
  }

  async function handleRemoveListing(report: AdminReport) {
    if (!report.listingId) return
    if (!confirm(`Remove listing "${report.listingTitle}"? This takes it off the marketplace.`)) return
    setActingOn(report.id)
    try {
      await removeListing(report.listingId)
      setReports((prev) =>
        prev.map((r) => (r.listingId === report.listingId ? { ...r, listingStatus: 'removed' } : r)),
      )
    } catch (err: any) {
      setError(err.message || 'Could not remove this listing')
    } finally {
      setActingOn(null)
    }
  }

  async function handleToggleSuspend(report: AdminReport) {
    if (!report.reportedUserId) return
    const nextSuspended = !report.reportedUserSuspended
    if (
      !confirm(
        nextSuspended
          ? `Suspend ${report.reportedUserName}? They won't be able to post listings or send messages.`
          : `Lift the suspension on ${report.reportedUserName}?`,
      )
    )
      return
    setActingOn(report.id)
    try {
      await setUserSuspended(report.reportedUserId, nextSuspended)
      setReports((prev) =>
        prev.map((r) =>
          r.reportedUserId === report.reportedUserId ? { ...r, reportedUserSuspended: nextSuspended } : r,
        ),
      )
    } catch (err: any) {
      setError(err.message || 'Could not update suspension')
    } finally {
      setActingOn(null)
    }
  }

  if (authLoading) return null

  // Not an admin (or not logged in): don't even hint that this page does something --
  // same "just a 403" treatment as EditListing's ownership check.
  if (!user || !profile?.is_admin) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <ShieldAlert className="mx-auto text-ink/30" size={40} />
        <p className="mt-4 font-display text-2xl font-semibold">Not authorized</p>
        <p className="mt-2 text-sm text-ink/60">This page is only for admins.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream">
          Back home
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-ink/60">Trust & safety reports filed by users.</p>

      <div className="mt-6 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-forest text-cream' : 'border border-line/10 bg-surface text-ink/80'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl2 bg-cream-dark" />)
        ) : reports.length === 0 ? (
          <p className="rounded-xl2 border border-line/5 bg-surface p-8 text-center text-sm text-ink/50">
            No {tab === 'all' ? '' : tab} reports.
          </p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="rounded-xl2 border border-line/5 bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-medium text-clay">
                    {reportReasonLabels[r.reason]}
                  </span>
                  <span className="ml-2 text-xs text-ink/40">
                    {new Date(r.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium capitalize text-ink/60">
                  {r.status}
                </span>
              </div>

              {r.details && <p className="mt-3 text-sm text-ink/80">{r.details}</p>}

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <p className="text-ink/60">
                  Filed by <span className="font-medium text-ink">{r.reporterName}</span>
                </p>
                {r.reportedUserId && (
                  <p className="text-ink/60">
                    About user{' '}
                    <Link to={`/seller/${r.reportedUserId}`} className="font-medium text-clay hover:underline">
                      {r.reportedUserName}
                    </Link>
                  </p>
                )}
                {r.listingId && (
                  <p className="text-ink/60 sm:col-span-2">
                    About listing{' '}
                    <Link to={`/listing/${r.listingId}`} className="font-medium text-clay hover:underline">
                      {r.listingTitle ?? '(untitled)'}
                    </Link>{' '}
                    {r.listingStatus && r.listingStatus !== 'active' && (
                      <span className="text-xs text-ink/40">({r.listingStatus})</span>
                    )}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === 'open' && (
                  <>
                    <button
                      onClick={() => act(r.id, 'reviewed')}
                      disabled={actingOn === r.id}
                      className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
                    >
                      <Check size={13} /> Mark reviewed
                    </button>
                    <button
                      onClick={() => act(r.id, 'dismissed')}
                      disabled={actingOn === r.id}
                      className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-4 py-2 text-xs font-semibold text-ink/70 hover:bg-cream-dark disabled:opacity-50"
                    >
                      <X size={13} /> Dismiss
                    </button>
                  </>
                )}
                {r.listingId && r.listingStatus !== 'removed' && (
                  <button
                    onClick={() => handleRemoveListing(r)}
                    disabled={actingOn === r.id}
                    className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remove listing
                  </button>
                )}
                {r.reportedUserId && (
                  <button
                    onClick={() => handleToggleSuspend(r)}
                    disabled={actingOn === r.id}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-50 ${
                      r.reportedUserSuspended
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {r.reportedUserSuspended ? (
                      <>
                        <UserCheck size={13} /> Lift suspension
                      </>
                    ) : (
                      <>
                        <UserX size={13} /> Suspend user
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
