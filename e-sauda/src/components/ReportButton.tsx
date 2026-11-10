import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { submitReport, reportReasonLabels, ReportReason } from '../lib/reports'

interface ReportButtonProps {
  listingId?: string
  reportedUserId?: string
  // Small label tweak so the button reads naturally in both contexts it's used in
  // ("Report listing" vs "Report user") without needing two separate components.
  label?: string
}

export default function ReportButton({ listingId, reportedUserId, label = 'Report' }: ReportButtonProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('scam_or_fraud')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    if (!user) {
      navigate('/login')
      return
    }
    setOpen(true)
  }

  async function handleSubmit() {
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      await submitReport({ reporterId: user.id, listingId, reportedUserId, reason, details })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Could not submit report. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    setOpen(false)
    // Reset after the close animation would run, so re-opening later starts fresh.
    setTimeout(() => {
      setSubmitted(false)
      setReason('scam_or_fraud')
      setDetails('')
      setError(null)
    }, 200)
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-4 py-2 text-xs font-semibold text-ink/60 hover:bg-cream-dark"
      >
        <Flag size={13} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-xl2 bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{label}</h3>
              <button onClick={close} className="text-ink/40 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              <div className="mt-4">
                <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
                  Thanks — we've received your report and it'll be reviewed.
                </p>
                <button
                  onClick={close}
                  className="mt-4 w-full rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink/60">
                  Your report is private -- only you can see that you filed it.
                </p>

                <div className="mt-4">
                  <label className="text-sm font-medium text-ink">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                    className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
                  >
                    {Object.entries(reportReasonLabels).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-ink">Details (optional)</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    placeholder="Anything that'll help us look into this"
                    className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
                  />
                </div>

                {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="mt-5 w-full rounded-full bg-clay px-5 py-2.5 text-sm font-semibold text-cream hover:bg-clay-light disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit report'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
