// Vercel serverless function, auto-deployed from the /api folder — no separate build
// step, no extra hosting needed beyond what you're already using for the app itself.
//
// A pure client-side SPA can't give WhatsApp/Facebook/etc a real preview: those
// crawlers fetch the URL and read <meta> tags WITHOUT running any JavaScript, so
// whatever they see is whatever's already in the raw HTML — which for a plain SPA is
// always the same generic index.html, regardless of which listing the link is for.
//
// This function generates the REAL per-listing tags (title, price, photo) server-side
// on demand, using the same public anon key and public `listings` table your app
// already reads from client-side — no extra permissions, no service-role key needed
// here, since anyone can already see any active listing's details in the app itself.
//
// vercel.json routes ONLY requests from known crawler user-agents here (see that
// file). A real person clicking the link never sees this — they're redirected
// straight to the real listing page in the actual React app.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = async (req, res) => {
  const id = req.query.id
  if (!id) {
    res.statusCode = 400
    res.end('Missing listing id')
    return
  }

  const pageUrl = `https://${req.headers.host}/listing/${id}`

  try {
    const apiRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&select=title,price,description,photo_urls,status`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    )
    const rows = await apiRes.json()
    const listing = Array.isArray(rows) ? rows[0] : null

    if (!listing) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html')
      res.end(
        `<!doctype html><html><head><meta charset="utf-8" /><title>Listing not found — e-Sauda</title></head><body>This listing could not be found.</body></html>`,
      )
      return
    }

    const priceText = listing.price ? `₹${Number(listing.price).toLocaleString('en-IN')}` : ''
    const rawTitle = listing.title || 'Listing on e-Sauda'
    const title = escapeHtml(priceText ? `${rawTitle} — ${priceText}` : rawTitle)
    const description = escapeHtml(
      listing.status !== 'active'
        ? 'This listing is no longer available.'
        : listing.description
          ? listing.description.slice(0, 150)
          : `${priceText ? priceText + ' · ' : ''}Buy it locally on e-Sauda — chat with the seller, meet, check it, then pay directly.`,
    )
    // Deliberately no fallback image URL when a listing has none — pointing og:image
    // at a nonexistent asset just shows a broken-image icon on WhatsApp, which is
    // worse than a clean text-only preview.
    const image = Array.isArray(listing.photo_urls) && listing.photo_urls[0] ? listing.photo_urls[0] : null

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="e-Sauda" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
  <meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(pageUrl)}">${title}</a>…</p>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Cached briefly at the CDN edge — a listing's price/photo doesn't change so
    // often that every single crawler hit needs to re-fetch Supabase.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    res.statusCode = 200
    res.end(html)
  } catch (err) {
    console.error('og-listing error:', err)
    res.statusCode = 500
    res.end('Internal error generating preview')
  }
}
