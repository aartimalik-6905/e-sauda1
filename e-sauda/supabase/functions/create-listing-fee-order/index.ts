import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const API_VERSION = Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01'
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg'

function feeForCount(activeCount: number): number {
  if (activeCount === 0) return 1
  if (activeCount === 1) return 10
  return 25
}

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
    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!appId || !secretKey || !supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Cashfree or Supabase server configuration is incomplete.' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required.' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Not authenticated.' }, 401)

    const body = await req.json()
    const { category, listingId, customerName, customerEmail, customerPhone } = body
    if (typeof category !== 'string' || !category.trim() ||
        typeof listingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(listingId) ||
        typeof customerPhone !== 'string' || !/^[6-9]\d{9}$/.test(customerPhone)) {
      return json({ error: 'A valid category, listing ID and 10-digit mobile number are required.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: existing, error: existingError } = await admin
      .from('cashfree_listing_fee_payments')
      .select('cashfree_order_id,payment_session_id,amount,status,created_at,updated_at')
      .eq('listing_id', listingId)
      .eq('seller_id', user.id)
      .in('status', ['CREATING', 'PENDING', 'PAID'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing?.status === 'PAID') {
      return json({
        orderId: existing.cashfree_order_id,
        paymentSessionId: existing.payment_session_id,
        fee: Number(existing.amount),
        alreadyPaid: true,
      })
    }

    if (existing?.status === 'CREATING') {
      const ageMs = Date.now() - new Date(existing.updated_at || existing.created_at).getTime()
      if (Number.isFinite(ageMs) && ageMs > 90_000) {
        await admin.from('cashfree_listing_fee_payments')
          .update({ status: 'FAILED', updated_at: new Date().toISOString() })
          .eq('cashfree_order_id', existing.cashfree_order_id)
          .eq('status', 'CREATING')
      } else {
        return json({ error: 'Your payment order is still being prepared. Please retry in a few seconds.' }, 409)
      }
    }

    if (existing?.status === 'PENDING' && existing.payment_session_id) {
      return json({
        orderId: existing.cashfree_order_id,
        paymentSessionId: existing.payment_session_id,
        fee: Number(existing.amount),
      })
    }

    const { count, error: countError } = await admin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('category', category)
      .eq('status', 'active')
    if (countError) throw countError

    const fee = feeForCount(count ?? 0)
    const orderId = `es_${crypto.randomUUID().replaceAll('-', '')}`
    const { error: insertError } = await admin
      .from('cashfree_listing_fee_payments')
      .insert({
        cashfree_order_id: orderId,
        listing_id: listingId,
        seller_id: user.id,
        category,
        amount: fee,
        currency: 'INR',
        status: 'CREATING',
      })
    if (insertError) {
      if (insertError.code === '23505') {
        return json({ error: 'A payment attempt for this listing is already being created. Please retry in a moment.' }, 409)
      }
      throw insertError
    }

    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin')
    if (!appUrl) throw new Error('APP_URL is not configured.')
    const webhookUrl = `${supabaseUrl}/functions/v1/cashfree-webhook`
    const gatewayResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-idempotency-key': orderId,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: fee,
        order_currency: 'INR',
        customer_details: {
          customer_id: user.id,
          customer_name: String(user.user_metadata?.display_name || customerName || 'e-Sauda seller').slice(0, 100),
          customer_email: String(user.email || '').slice(0, 100),
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: `${appUrl.replace(/\/$/, '')}/sell?cashfree_return=1`,
          notify_url: webhookUrl,
        },
        order_note: `e-Sauda listing fee for ${category}`,
        order_tags: {
          listing_id: listingId,
          seller_id: user.id,
          category,
          purpose: 'listing_fee',
        },
      }),
    })

    const gatewayData = await gatewayResponse.json().catch(() => ({}))
    if (!gatewayResponse.ok || !gatewayData.payment_session_id) {
      console.error('Cashfree create order failed:', gatewayResponse.status, gatewayData)
      await admin.from('cashfree_listing_fee_payments')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('cashfree_order_id', orderId)
      return json({ error: 'Cashfree could not create the payment order. Please try again.' }, 502)
    }

    const { error: updateError } = await admin
      .from('cashfree_listing_fee_payments')
      .update({
        payment_session_id: gatewayData.payment_session_id,
        status: 'PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('cashfree_order_id', orderId)
      .eq('seller_id', user.id)
      .eq('status', 'CREATING')
    if (updateError) throw updateError

    return json({
      orderId,
      paymentSessionId: gatewayData.payment_session_id,
      fee,
    })
  } catch (error) {
    console.error('create-listing-fee-order error:', error)
    return json({ error: 'Unexpected server error while creating payment order.' }, 500)
  }
})
