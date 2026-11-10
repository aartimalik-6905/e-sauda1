import { Link } from 'react-router-dom'
import { HelpCircle, Wifi, WifiOff } from 'lucide-react'
import { useNetworkStatusContext } from '../context/NetworkStatusContext'
import ThemeToggle from './ThemeToggle'

export default function Footer() {
  const { liteMode, setLiteMode } = useNetworkStatusContext()

  return (
    <footer className="glass !rounded-none !border-x-0 !border-b-0">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-xs font-semibold text-cream">e</span>
              <span className="font-display text-base font-extrabold tracking-tight text-ink">e-Sauda</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-ink/50">
              Trust-first local marketplace. Escrow-secured. Delivery baked in.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Manual override for Lite mode -- auto-detected on connections the
                  browser itself reports as slow/data-saver (see useNetworkStatus),
                  but this covers Safari/iOS (no such API) and anyone who just wants
                  to save data on request. Turning it on doesn't disable any feature --
                  only how photos/video are loaded (see components/LazyImage.tsx). */}
              <button
                onClick={() => setLiteMode(!liteMode)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  liteMode
                    ? 'border-clay/30 bg-clay/10 text-clay'
                    : 'border-line/10 text-ink/50 hover:text-ink'
                }`}
                aria-pressed={liteMode}
              >
                {liteMode ? <WifiOff size={13} /> : <Wifi size={13} />}
                Lite mode {liteMode ? 'on' : 'off'}
              </button>
              <ThemeToggle className="border border-line/10" />
            </div>
            <p className="mt-1.5 max-w-[15rem] text-[11px] text-ink/35">
              Loads photos/video on tap instead of automatically — handy on a slow connection.
            </p>
          </div>
          <div>
            <h4 className="eyebrow">Marketplace</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li><Link to="/browse" className="hover:text-clay">Browse listings</Link></li>
              <li><Link to="/sell" className="hover:text-clay">Sell an item</Link></li>
              <li><Link to="/vault" className="hover:text-clay">Sauda Vault</Link></li>
              <li><Link to="/orders" className="hover:text-clay">My orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="eyebrow">Trust &amp; safety</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li>
                <Link to="/help" className="flex items-center gap-1.5 font-medium text-clay hover:underline">
                  <HelpCircle size={14} /> Help guide — how e-Sauda works
                </Link>
              </li>
              <li>DigiLocker verification (coming soon)</li>
              <li>OTP handover</li>
              <li>Chat moderation</li>
              <li>Report &amp; block</li>
            </ul>
          </div>
          <div>
            <h4 className="eyebrow">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li><Link to="/about" className="hover:text-clay">About us</Link></li>
              <li><Link to="/terms" className="hover:text-clay">Terms and conditions</Link></li>
              <li><Link to="/privacy" className="hover:text-clay">Privacy policy</Link></li>
              <li><Link to="/refund-policy" className="hover:text-clay">Cancellation &amp; refunds</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-clay">Shipping policy</Link></li>
              <li><Link to="/pricing" className="hover:text-clay">Pricing</Link></li>
              <li><Link to="/contact" className="hover:text-clay">Contact us</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-14 border-t border-line/10 pt-6 text-xs text-ink/30">
          © 2026 e-Sauda. <Link to="/terms" className="hover:text-clay">Terms</Link> · <Link to="/privacy" className="hover:text-clay">Privacy</Link> ·{' '}
          <Link to="/help" className="hover:text-clay">Help guide</Link>
        </p>
      </div>
    </footer>
  )
}