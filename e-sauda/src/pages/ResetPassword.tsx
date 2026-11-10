import { useEffect, useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  // supabase-js's detectSessionInUrl reads the recovery token out of the URL on load
  // and fires a 'PASSWORD_RECOVERY' auth event once it's done -- we wait for that (with
  // a getSession() fallback in case the event already fired before this component
  // mounted) rather than assuming a session exists immediately, since parsing the URL
  // happens asynchronously.
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    const timeout = setTimeout(() => {
      setReady((r) => {
        if (!r) setInvalidLink(true)
        return r
      })
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/'), 1500)
  }

  if (invalidLink) {
    return (
      <div className="mx-auto flex max-w-sm flex-col px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Link expired</h1>
        <p className="mt-2 text-sm text-ink/60">
          This password reset link is invalid or has expired. Request a new one.
        </p>
        <Link to="/forgot-password" className="mt-6 text-sm font-medium text-clay hover:underline">
          Request a new link
        </Link>
      </div>
    )
  }

  if (!ready) {
    return <div className="px-6 py-24 text-center text-sm text-ink/50">Verifying your link…</div>
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-sm flex-col px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-ink/60">Taking you back to e-Sauda…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Set a new password</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">New password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink">Confirm password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
