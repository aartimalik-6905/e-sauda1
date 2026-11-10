import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await requestPasswordReset(email.trim())
    setLoading(false)
    // Show the same confirmation whether or not the email matched an account --
    // otherwise this form becomes a way to check which emails are registered.
    if (error) {
      setError(error)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="mx-auto flex max-w-sm flex-col px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-ink/60">
          If an account exists for <span className="font-medium text-ink">{email}</span>, we've sent a
          link to reset your password.
        </p>
        <Link to="/login" className="mt-6 text-sm font-medium text-clay hover:underline">
          Back to log in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink/60">We'll email you a link to set a new one.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link to="/login" className="mt-6 text-center text-sm text-ink/50 hover:text-ink">
        Back to log in
      </Link>
    </div>
  )
}
