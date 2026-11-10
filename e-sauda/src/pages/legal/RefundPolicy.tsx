import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="November 5, 2026">
      <p>
        e-Sauda is a classifieds platform. Buyers and sellers deal directly with
        each other, and e-Sauda does not sell items or receive any money for them. The
        only payment made to e-Sauda is the seller's listing fee, so this policy
        covers that fee and explains how refunds for items work.
      </p>

      <h2>Items bought from other users</h2>
      <p>
        e-Sauda does not collect or hold the price of any item, so e-Sauda cannot
        refund it. You pay the seller directly, in person. Inspect the item and
        confirm it matches the listing <strong>before</strong> you pay. If you are not
        satisfied, do not pay and do not take the item. Any return or refund after
        payment must be agreed between the buyer and the seller.
      </p>
      <p>
        If an item was misrepresented, use the Report button on the listing or the
        seller's profile. Our team reviews reports and may remove listings or suspend
        accounts. For money lost to fraud, contact the National Cyber Crime helpline
        (1930) or your local police.
      </p>

      <h2>Listing fee</h2>
      <p>
        The listing fee (see <Link to="/pricing" className="text-clay hover:underline">Pricing</Link>)
        is for publishing a listing and is <strong>not refundable</strong> once the
        listing has been published, including if the item is sold, edited, or later
        removed for breaking our rules.
      </p>

      <h2>When we do refund the listing fee</h2>
      <ul>
        <li>You were charged but your listing was not published.</li>
        <li>You were charged more than once for the same listing.</li>
        <li>A listing was removed by us by mistake.</li>
      </ul>
      <p>
        Write to edotsauda@gmail.com with the email on your account and the payment
        reference from Cashfree. Approved refunds go back to the original payment
        method and usually reach your account within <strong>5-7 business days</strong>,
        depending on your bank or payment provider.
      </p>

      <p>
        See also our{' '}
        <Link to="/cancellation-policy" className="text-clay hover:underline">Cancellation Policy</Link>.
      </p>
    </LegalLayout>
  )
}
