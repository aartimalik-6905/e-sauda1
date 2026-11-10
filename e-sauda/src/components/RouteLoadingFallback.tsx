// Shown by <Suspense> in App.tsx while a lazily-loaded page's JS chunk is
// still downloading. Deliberately just grey bars -- no images, no fonts
// beyond what's already loaded, nothing that itself needs a slow network to
// render -- so it appears instantly even on a bad connection instead of
// leaving a blank screen while the real page streams in.
export default function RouteLoadingFallback() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="h-8 w-1/3 animate-pulse rounded bg-ink/10" />
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl2 border border-line/10">
            <div className="h-40 animate-pulse bg-ink/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
