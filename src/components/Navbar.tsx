import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Search, Bell, Plus, User as UserIcon, MessageSquare, Wallet, ShoppingBag, LogOut, Inbox, Heart, ShieldAlert, Package, Clapperboard, PlayCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { timeAgo } from '../lib/time'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function handleNotificationClick(id: string, link: string | null) {
    await markRead(id)
    setNotifOpen(false)
    if (link) navigate(link)
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/browse${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  async function handleSignOut() {
    // Close the menu and navigate away from any auth-gated page *first* -- signOut()
    // now clears local state synchronously-ish (see AuthContext), but there's no
    // reason to make either of these wait on it regardless. Going straight to
    // /login (not '/') also skips an unnecessary extra redirect hop, since '/' itself
    // requires auth and would otherwise immediately bounce to /login anyway.
    setMenuOpen(false)
    try {
      await signOut()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const initial = (profile?.display_name || user?.email || 'Y').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b border-line/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-sm font-semibold text-cream">
            e
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">e-Sauda</span>
        </Link>

        <form
          onSubmit={onSearch}
          className="flex flex-1 items-center gap-2 rounded-full border border-line/10 bg-surface px-4 py-2 max-w-xl"
        >
          <MapPin size={16} className="shrink-0 text-ink/50" />
          <span className="shrink-0 text-sm text-ink/70">{profile?.city || 'Delhi'}</span>
          <span className="h-4 w-px shrink-0 bg-line/10" />
          <Search size={16} className="shrink-0 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try &quot;mechanical keyboard under 3k&quot;'
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 eyebrow rounded-full bg-clay/15 px-3 py-1.5 !text-clay"
          >
            Search
          </button>
        </form>

        <nav className="hidden shrink-0 items-center gap-6 eyebrow md:flex">
          <Link to="/browse" className="hover:text-ink">Browse</Link>
          {user && <Link to="/messages" className="hover:text-ink">Messages</Link>}
          {user && <Link to="/saved" className="hover:text-ink">Saved</Link>}
          <Link to="/vault" className="hover:text-ink">Vault</Link>
          <Link to="/orders" className="hover:text-ink">Orders</Link>
        </nav>

        {/* Standalone Reels/Explore button -- deliberately its own always-visible
            button (not just a text link inside the "hidden md:flex" nav above,
            and not buried in the account dropdown) so it's reachable with one
            tap on mobile without needing to be logged in or open a menu first. */}
        <Link
          to="/explore"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay hover:bg-clay/20"
          aria-label="Watch Reels"
        >
          <PlayCircle size={16} />
          <span className="hidden sm:inline">Reels</span>
        </Link>

        {user && (
          <div className="relative shrink-0" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-full p-2 text-ink/60 hover:bg-surface"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-cream">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl2 border border-line/10 bg-surface p-2 shadow-xl">
                <div className="flex items-center justify-between border-b border-line/10 p-2">
                  <p className="text-sm font-semibold text-ink">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs font-medium text-clay hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-sm text-ink/50">You're all caught up.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n.id, n.link)}
                        className={`block w-full rounded-lg p-3 text-left text-sm hover:bg-cream-dark ${
                          n.read ? '' : 'bg-clay/10'
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />}
                          <span className={n.read ? 'ml-3.5' : ''}>
                            <span className="block font-semibold text-ink">{n.title}</span>
                            {n.body && <span className="block truncate text-xs text-ink/60">{n.body}</span>}
                            <span className="block text-xs text-ink/40">{timeAgo(n.createdAt)}</span>
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!user ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:text-ink">
              Log in
            </Link>
            <Link to="/signup" className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light">
              Sign up
            </Link>
          </div>
        ) : (
          <>
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-light font-semibold text-cream"
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl2 border border-line/10 bg-surface p-2 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-line/10 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-light font-semibold text-cream">
                      {initial}
                    </span>
                    <div>
                      <p className="truncate text-sm font-semibold text-ink">
                        {profile?.display_name || user.email}
                      </p>
                      <p className="text-xs text-ink/60">Trust {profile?.trust_score ?? 50}</p>
                    </div>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <UserIcon size={16} /> My profile
                  </Link>
                  <Link to="/my-listings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <Package size={16} /> My listings
                  </Link>
                  <Link to="/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <Inbox size={16} /> Messages
                  </Link>
                  <Link to="/saved" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <Heart size={16} /> Saved
                  </Link>
                  <Link to="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <MessageSquare size={16} /> My orders
                  </Link>
                  <Link to="/vault" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <Wallet size={16} /> Sauda Vault
                  </Link>
                  <Link to="/browse" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <ShoppingBag size={16} /> Browse marketplace
                  </Link>
                  <Link to="/explore" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                    <Clapperboard size={16} /> Explore
                  </Link>
                  {profile?.is_admin && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream-dark">
                      <ShieldAlert size={16} /> Reports (admin)
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-red-400 hover:bg-red-500/10">
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>

            <Link
              to="/sell"
              className="flex shrink-0 items-center gap-1 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light"
            >
              <Plus size={16} /> Sell
            </Link>
          </>
        )}
      </div>
    </header>
  )
}