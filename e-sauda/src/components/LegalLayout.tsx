import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Shared by every page under src/pages/legal/ -- keeps typography and the
// last-updated stamp consistent without repeating the wrapper markup six times.
export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm text-ink/50 hover:text-ink">
        ← Back to e-Sauda
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink/50">Last updated: {lastUpdated}</p>
      <div className="mt-8 max-w-none text-ink/80 [&_h2]:font-display [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </div>
  )
}
