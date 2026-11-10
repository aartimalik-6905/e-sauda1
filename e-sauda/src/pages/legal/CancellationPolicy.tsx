import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function CancellationPolicy() {
  return (
    <LegalLayout title="Cancellation Policy" lastUpdated="November 5, 2026">
      <p>
        e-Sauda is a classifieds platform. Deals are agreed and completed directly
        between buyers and sellers, so there are no orders placed with e-Sauda to
        cancel. This policy explains how cancelling works on the platform.
      </p>

      <h2>Cancelling a deal or a meetup</h2>
      <p>
        If you can no longer go ahead with a deal, tell the other person in the chat as
        early as you can and agree a new time or call it off. There is no fee for
        cancelling, because no money has been taken by e-Sauda for the deal. Never pay
        in advance to "reserve" an item.
      </p>

      <h2>Removing or closing a listing</h2>
      <p>
        Sellers can edit, remove, or mark a listing as sold at any time from{' '}
        <Link to="/my-listings" className="text-clay hover:underline">My Listings</Link>.
        A listing marked as sold can be put back on sale if the deal fell through.
      </p>

      <h2>Listing fee</h2>
      <p>
        The listing fee is not refundable once a listing has been published, even if
        you later remove it or it sells. See our{' '}
        <Link to="/refund-policy" className="text-clay hover:underline">Refund Policy</Link>{' '}
        for the cases where we do refund it.
      </p>

      <h2>Closing your account</h2>
      <p>
        You can delete your account at any time from your Profile page. Your active
        listings are taken down.
      </p>

      <h2>Contact</h2>
      <p>Questions about cancellations can be sent to edotsauda@gmail.com.</p>
    </LegalLayout>
  )
}
