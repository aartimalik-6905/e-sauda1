// Lightweight, pattern-based scam-signal detection for chat messages. This is not
// an ML model — it's the same category of heuristic classifieds sites like OLX
// describe publicly (OTP requests, advance-payment pressure, UPI IDs, external
// links). Buyers and sellers pay each other directly and need to call each other to
// meet, so phone numbers are NOT flagged. The check exists to nudge people at the
// moment they're about to send something risky, and to give the other party a
// visible caution flag on a message that matched — not to silently block anyone.

export interface ModerationResult {
  flagged: boolean
  reasons: string[]
}

// A UPI payment address, e.g. someone@okhdfcbank
const UPI_ID_PATTERN = /\b[\w.\-]{2,}@[a-zA-Z]{2,}\b/

// A link to somewhere other than this app — links in classifieds chats are a
// common route to phishing pages and fake payment pages.
const EXTERNAL_LINK_PATTERN = /https?:\/\/\S+|www\.\S+/i

const OTP_REQUEST_PATTERN =
  /\b(otp|one[\s-]?time[\s-]?password|verification code)\b.{0,25}\b(send|share|tell|read out|give)\b|\b(send|share|tell|give)\b.{0,25}\b(otp|one[\s-]?time[\s-]?password|verification code)\b/i

const OFF_PLATFORM_PAYMENT_PATTERN =
  /\b(gpay|google pay|phonepe|paytm|upi)\b.{0,20}\b(send|pay|transfer|directly)\b|\b(pay|send)\b.{0,20}\b(gpay|google pay|phonepe|paytm|directly)\b/i

const ADVANCE_FEE_PATTERN =
  /\b(refundable|advance|courier|customs|processing)\s+(fee|payment|charge|deposit)\b/i

export function scanMessage(text: string): ModerationResult {
  const reasons: string[] = []

  if (OTP_REQUEST_PATTERN.test(text)) reasons.push('OTP request')
  if (OFF_PLATFORM_PAYMENT_PATTERN.test(text) || UPI_ID_PATTERN.test(text)) {
    reasons.push('payment request')
  }
  if (ADVANCE_FEE_PATTERN.test(text)) reasons.push('upfront fee request')
  if (EXTERNAL_LINK_PATTERN.test(text)) reasons.push('external link')

  return { flagged: reasons.length > 0, reasons }
}

// Turns the reason codes above into one short, human sentence for the pre-send
// warning and the on-message caution badge.
export function describeFlags(reasons: string[]): string {
  if (reasons.length === 0) return ''
  return `This message mentions a ${reasons.join(' and a ')}. Never pay in advance, never share an OTP, and only pay the seller in person after you've checked the item.`
}
