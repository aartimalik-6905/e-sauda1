import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error, sessionCreated } = await signUp(email, password, name)
    setLoading(false)

    if (error) {
      setError(error)
      return
    }

    if (sessionCreated) {
      // Email confirmation isn't required on this project (that's a Supabase Auth
      // dashboard setting, not something this code controls) -- signUp already
      // created a live session, so there's nowhere else to send them.
      navigate('/')
      return
    }

    // No session yet -- this project DOES require clicking an email confirmation
    // link first (supabase.auth.signUp() returns no session in that case). Only show
    // this screen when it's actually true, not unconditionally.
    setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <div className="mx-auto max-w-sm px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink/60">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and
          log in.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
        >
          Go to login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-ink/60">Takes under a minute. First listing is ₹1.</p>

      <p className="mt-4 rounded-lg bg-clay/10 p-3 text-xs text-ink/70">
        Prefer not to set a password? Head to{' '}
        <Link to="/login" className="font-semibold text-clay hover:underline">Log in</Link>{' '}
        instead — signing in with Google creates your account automatically the first time.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">Display name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What buyers/sellers will see"
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>
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
        <div>
          <label className="text-sm font-medium text-ink">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-clay px-6 py-3 text-sm font-semibold text-cream hover:bg-clay-light disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-clay hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}