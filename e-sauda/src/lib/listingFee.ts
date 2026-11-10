import { invokeFunction } from './edgeFunctions'

interface CreateCashfreeOrderResponse {
  orderId: string
  paymentSessionId: string
  fee: number
  alreadyPaid?: boolean
}

interface CashfreeCheckoutResult {
  error?: { message?: string }
  redirect?: boolean
  paymentDetails?: { paymentMessage?: string }
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'production' }) => {
      checkout: (options: {
        paymentSessionId: string
        redirectTarget: '_modal'
      }) => Promise<CashfreeCheckoutResult>
    }
  }
}

let sdkPromise: Promise<void> | null = null

async function loadCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]',
      )
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Could not load Cashfree checkout.')), { once: true })
        if (window.Cashfree) resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        sdkPromise = null
        reject(new Error('Could not load Cashfree checkout. Check your connection and try again.'))
      }
      document.head.appendChild(script)
    })
  }
  await sdkPromise
  if (!window.Cashfree) throw new Error('Cashfree checkout SDK did not initialize.')
}

function getCustomerPhone(): string {
  const phone = window.prompt(
    'Enter your 10-digit mobile number for Cashfree payment confirmation:',
  )?.trim()
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number to continue.')
  }
  return phone
}

export async function payListingFee(
  category: string,
  listingId: string,
  buyerName: string,
  buyerEmail: string,
): Promise<{ cashfreeOrderId: string; fee: number }> {
  const customerPhone = getCustomerPhone()
  const order = await invokeFunction<CreateCashfreeOrderResponse>(
    'create-listing-fee-order',
    { category, listingId, customerName: buyerName, customerEmail: buyerEmail, customerPhone },
  )

  if (order.alreadyPaid) {
    // The publish Edge Function will still fetch and verify the order directly
    // with Cashfree before it creates the listing.
    return { cashfreeOrderId: order.orderId, fee: order.fee }
  }


  await loadCashfreeSdk()
  const cashfree = window.Cashfree!({ mode: 'production' })
  try {
    await cashfree.checkout({
      paymentSessionId: order.paymentSessionId,
      redirectTarget: '_modal',
    })
  } catch {
    // The SDK result is not authoritative. The next backend publish request
    // independently fetches the order from Cashfree and only publishes if PAID.
  }

  return { cashfreeOrderId: order.orderId, fee: order.fee }
}
