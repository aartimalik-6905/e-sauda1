// Deploy: supabase functions deploy suggest-description
// Requires the same GROQ_API_KEY secret as chat-assistant (see its comment for
// where to get one for free): supabase secrets set GROQ_API_KEY=gsk_...
//
// Separate function from chat-assistant rather than a branch inside it: this one
// needs a vision-capable model and a very different (single-shot, no conversation
// history, no user-data grounding) prompt shape, and keeping them apart means a
// change to one can't accidentally break the other.
//
// Model: overridable via a GROQ_VISION_MODEL secret (supabase secrets set
// GROQ_VISION_MODEL=...) for the same reason chat-assistant's GROQ_MODEL is --
// Groq's vision-capable model lineup has moved more than once (Llama 4 Scout/
// Maverick, then Qwen3-VL). If this starts failing outright, check
// https://console.groq.com/docs/vision for the current recommended model before
// assuming the bug is anywhere in this file.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.6-27b'
// Groq vision models cap how many images a single request can include --
// keeping our own cap well under that (and under a sane payload size for a
// person on a slow connection to upload in the first place) rather than
// relying on Groq to reject an oversized request.
const MAX_IMAGES = 4

// Best-effort cleanup in case the vision model ignores the "output only the
// description" instruction. Prefers the explicit ===DESCRIPTION===...===END===
// block the prompt asks for (reasoning models tend to narrate their thought
// process as plain prose with no tags, so we can't just strip <think> blocks
// or "Photo N:" style lines and call it done -- the delimiters are the only
// reliable anchor). Falls back to heuristic stripping if the model didn't use
// the markers, so a working description still gets through.
function cleanDescription(raw: string): string {
  let text = raw.trim()

  // Preferred path: pull out exactly what's between the markers.
  const marked = text.match(/===DESCRIPTION===([\s\S]*?)===END===/i)
  if (marked && marked[1].trim()) {
    text = marked[1].trim()
  } else {
    // Fallback: model didn't use the markers (or only opened one). Strip a
    // leading ===DESCRIPTION=== if present with no matching ===END===.
    text = text.replace(/^===DESCRIPTION===\s*/i, '').replace(/===END===\s*$/i, '').trim()

    // Drop any <think>...</think> reasoning blocks some models emit.
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

    // Drop narrated-reasoning lines/paragraphs, e.g. "The user wants...",
    // "I need to look at...", "Let me...", "Image Analysis:", section
    // headers, and per-photo breakdown lines like "Photo 1: ..." /
    // "- Image 2: ...".
    const reasoningLine =
      /^\s*(?:\*|-|\d+[.)])?\s*(?:(?:the user (?:wants|is asking)|i need to|i'll|i will|let me|first,?\s+i|looking at|analy[sz]ing|image analysis|photo analysis)\b|(?:photo|image|picture|pic)\s*\d+\s*[:.\-–])/i
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !reasoningLine.test(l))

    text = lines.join(' ')
  }

  // Strip a leading preamble like "Here's a description:" / "Description:".
  text = text.replace(/^(here'?s?\s+(?:is\s+)?(?:a\s+|the\s+)?description[^:]*:|description\s*:)\s*/i, '')

  // Strip markdown bold/italic/headers and wrapping quotes.
  text = text.replace(/^#+\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
  text = text.replace(/^["'"]+|["'"]+$/g, '')

  // Collapse any leftover repeated whitespace from the line-join above.
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only used to confirm the caller is a real logged-in user (matches every
    // other Edge Function in this project) -- this function doesn't read or
    // write any of their data, it just proxies to Groq.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      images?: string[] // data: URLs (base64) -- see src/lib/descriptionSuggestion.ts
      category?: string
      subCategory?: string
      condition?: string
      title?: string
    }
    const images = (body.images ?? []).filter((i) => typeof i === 'string' && i.startsWith('data:image/'))
    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one photo (or a video frame) is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      console.error('suggest-description: GROQ_API_KEY secret is not set')
      return new Response(
        JSON.stringify({ error: 'Description suggestions are not configured yet. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const knownDetails = [
      body.category && `Category: ${body.category}`,
      body.subCategory && `Sub-category: ${body.subCategory}`,
      body.condition && `Condition the seller selected: ${body.condition}`,
      body.title && `Title the seller typed: "${body.title}"`,
    ]
      .filter(Boolean)
      .join('\n')

    const instructions = `
You are helping a seller on e-Sauda, a peer-to-peer second-hand marketplace in India, write the
description for their listing. You're given photos of the item (one may be a frame grabbed from
their video) and whatever details they've already filled in.

Write a short, honest, buyer-friendly description in plain text (no markdown, no headings, no
emoji). 2-4 sentences. Describe only what's actually visible: item type, apparent brand/model if
identifiable, color, visible condition/wear/damage, and anything notable in the photos (included
accessories, packaging, etc). Do NOT invent specs, age, purchase price, or a reason for selling --
if it's not visible in the photos, leave it out. Never claim something is "like new" or
"perfect condition" unless the photos genuinely show no visible wear. Don't repeat the title
verbatim.

You will see multiple photos of the SAME item from different angles. Synthesize everything you
see across all of them into ONE flowing description of the item -- never describe the photos
individually. Do not write things like "Photo 1 shows..." or "In the second image..." or "Front
cover: ... Back cover: ..." or any per-image breakdown, list, or label. A buyer reading it should
not be able to tell how many photos there were or in what order.

Bad (never do this):
"Photo 1: front cover showing the title. Photo 2: back cover with the blurb. Photo 3: close-up of
the corner."

Bad (never do this either):
"The user wants a description for a book listing. I need to look at the provided images. Image
Analysis: Image 1 shows the front cover..."

Good (do this instead):
"Hardcover edition with the original dust jacket, green and gold cover design. Spine and corners
show light shelf wear but the jacket isn't torn. Includes the back-cover blurb and barcode intact."

Do not narrate your reasoning, your analysis process, or what you're about to do -- not even
briefly, not even before the real answer. If you need to think, do it silently and only output
the result.

Output your final answer wrapped EXACTLY like this, with nothing else before, after, or outside
the markers -- no reasoning, no "Image Analysis", no preamble, no labels:
===DESCRIPTION===
<the description here>
===END===

${knownDetails ? `Details the seller already entered (for context, don't just repeat them):\n${knownDetails}` : ''}
`.trim()

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: 600,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              ...images.slice(0, MAX_IMAGES).map((url) => ({ type: 'image_url', image_url: { url } })),
            ],
          },
        ],
      }),
    })

    const data = await groqRes.json()
    if (!groqRes.ok) {
      console.error('Groq vision API error:', data)
      return new Response(
        JSON.stringify({
          error:
            data?.error?.code === 'model_decommissioned'
              ? 'Description suggestions need a configuration update (the model was retired by the provider). This has been logged.'
              : 'Could not generate a suggestion right now.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const description = cleanDescription(data.choices?.[0]?.message?.content ?? '')
    if (!description) {
      return new Response(JSON.stringify({ error: 'Could not generate a suggestion right now.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('suggest-description error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})