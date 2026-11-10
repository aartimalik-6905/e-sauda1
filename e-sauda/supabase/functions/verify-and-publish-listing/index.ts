import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const API_VERSION = Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01'
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const appId = Deno.env.get('CASHFREE_APP_ID')
    const secret = Deno.env.get('CASHFREE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!appId || !secret || !supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Cashfree or Supabase server configuration is incomplete.' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Not authenticated.' }, 401)

    const { orderId, listingId, listing, media } = await req.json()
    if (typeof orderId !== 'string' || typeof listingId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(listingId) || !listing ||
        typeof listing.category !== 'string' || !listing.title ||
        !Number.isFinite(Number(listing.price)) || !media || media.id !== listingId ||
        typeof media.videoUrl !== 'string' || !media.videoUrl) {
      return json({ error: 'Invalid listing payment or listing details.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: payment, error: paymentError } = await admin
      .from('cashfree_listing_fee_payments')
      .select('*')
      .eq('cashfree_order_id', orderId)
      .eq('listing_id', listingId)
      .eq('seller_id', user.id)
      .maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) return json({ error: 'Payment order not found for this seller and listing.' }, 404)

    const gatewayResponse = await fetch(
      `${CASHFREE_BASE_URL}/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Accept: 'application/json',
          'x-api-version': API_VERSION,
          'x-client-id': appId,
          'x-client-secret': secret,
        },
      },
    )
    const gatewayOrder = await gatewayResponse.json().catch(() => ({}))
    if (!gatewayResponse.ok) {
      console.error('Cashfree order lookup failed:', gatewayResponse.status)
      return json({ error: 'Could not verify payment with Cashfree. Please retry.' }, 502)
    }

    const matches =
      Number(gatewayOrder.order_amount) === Number(payment.amount) &&
      gatewayOrder.order_currency === 'INR' &&
      payment.currency === 'INR' &&
      gatewayOrder.order_tags?.seller_id === user.id &&
      gatewayOrder.order_tags?.listing_id === listingId &&
      gatewayOrder.order_tags?.category === payment.category
    if (!matches) return json({ error: 'Cashfree order details did not match this listing payment.' }, 400)
    if (gatewayOrder.order_status !== 'PAID') {
      return json({
        error: 'Cashfree has not confirmed this payment as PAID. The listing has not been published.',
        orderStatus: gatewayOrder.order_status || 'UNKNOWN',
      }, 409)
    }

    if (payment.status !== 'PAID') {
      const { error: updateError } = await admin
        .from('cashfree_listing_fee_payments')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('cashfree_order_id', orderId)
        .eq('seller_id', user.id)
      if (updateError) throw updateError
    }

    if (listing.category !== payment.category) {
      return json({ error: 'Listing category does not match the paid category.' }, 400)
    }

    const { data: listingRow, error: publishError } = await userClient.rpc(
      'create_listing_with_cashfree_fee',
      {
        p_cashfree_order_id: orderId,
        p_title: String(listing.title),
        p_price: Number(listing.price) || 0,
        p_category: listing.category,
        p_sub_category: listing.subCategory || null,
        p_condition: String(listing.condition || 'Good'),
        p_description: listing.description || null,
        p_city: listing.city || null,
        p_location: listing.location || listing.city || '',
        p_width_cm: null,
        p_height_cm: null,
        p_depth_cm: null,
        p_emoji: String(listing.emoji || '📦'),
        p_bg: String(listing.bg || 'bg-sand'),
        p_latitude: listing.latitude ?? null,
        p_longitude: listing.longitude ?? null,
        p_id: listingId,
        p_photo_urls: Array.isArray(media.photoUrls) ? media.photoUrls : [],
        p_video_url: media.videoUrl || null,
      },
    )
    if (publishError) {
      console.error('Cashfree-verified listing publish failed:', publishError)
      return json({ error: publishError.message || 'Payment verified, but listing could not be published. Retry publishing; do not pay again.' }, 500)
    }

    return json({ success: true, listing: listingRow })
  } catch (error) {
    console.error('verify-and-publish-listing error:', error)
    return json({ error: 'Could not verify payment and publish listing.' }, 500)
  }
})
