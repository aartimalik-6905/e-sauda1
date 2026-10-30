import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function CancellationPolicy() {
  return (
    <LegalLayout title="Cancellation Policy" lastUpdated="October 30, 2026">
      <p>
        This policy explains how orders placed through Sauda Vault, e-Sauda's
        escrow-based payment system, can be cancelled.
      </p>

      <h2>Cancellation window</h2>
      <p>
        A buyer or a seller can cancel a Vault order <strong>at any time before
        handover is confirmed</strong> with the one-time code. There is no
        cancellation fee. If handover has not taken place within{' '}
        <strong>7 days</strong> of the order being funded, either party may cancel
        and the buyer will be refunded.
      </p>

      <h2>How to cancel</h2>
      <p>
        Open <Link to="/orders" className="text-clay hover:underline">My orders</Link>,
        select the order, and choose Cancel. The listing returns to active status
        immediately.
      </p>

      <h2>Refund on cancellation</h2>
      <p>
        The refund is initiated automatically when the order is cancelled, to the
        original payment method, and reaches your account within{' '}
        <strong>5-7 business days</strong>. If a delivery partner had already been
        arranged, that delivery fee is deducted from the refund. See our{' '}
        <Link to="/refund-policy" className="text-clay hover:underline">Return and Refund Policy</Link>.
      </p>

      <h2>After handover</h2>
      <p>
        Once handover is confirmed, the order is complete and can no longer be
        cancelled.
      </p>

      <h2>Cancelling a listing</h2>
      <p>
        Sellers can remove or mark a listing as sold at any time from My Listings.
        The listing fee is not refundable once a listing has been published.
      </p>

      <h2>Contact</h2>
      <p>Questions about cancellations can be sent to edotsauda@gmail.com.</p>
    </LegalLayout>
  )
}
