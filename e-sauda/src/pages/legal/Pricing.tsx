import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function Pricing() {
  return (
    <LegalLayout title="Pricing" lastUpdated="November 5, 2026">
      <p>
        e-Sauda is a classifieds platform. Buyers and sellers deal with each other
        directly, so the only thing e-Sauda charges for is a small fee when a seller
        publishes a listing.
      </p>

      <h2>For buyers: free</h2>
      <p>
        Browsing, chatting with sellers and saving listings cost nothing. e-Sauda
        takes no commission and never handles your payment. You pay the seller
        directly, in person, for the price you agree with them.
      </p>

      <h2>For sellers: listing fee</h2>
      <p>
        The fee is charged in Indian Rupees (INR) through our payment gateway partner
        (Cashfree) before your listing goes live. It depends on how many active
        listings you already have in the same category:
      </p>
      <ul>
        <li>First active listing in a category: ₹1</li>
        <li>Second active listing in the same category: ₹10</li>
        <li>Third or further active listing in the same category: ₹25</li>
      </ul>
      <p>
        The count resets as your listings there are sold, expire or are removed.
        The fee covers publishing the listing and helps keep spam and bulk
        reselling off the platform.
      </p>

      <h2>What we do not charge</h2>
      <ul>
        <li>No commission or percentage on the sale price.</li>
        <li>No fee to buyers.</li>
        <li>No shipping or handling fees, because items are handed over in person.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        The listing fee is not refundable once a listing has been published. If you
        were charged but your listing was not published, you can retry without being
        charged again, or contact us for a refund. See our{' '}
        <Link to="/refund-policy" className="text-clay hover:underline">Refund Policy</Link>.
      </p>

      <h2>Changes to pricing</h2>
      <p>
        If e-Sauda introduces or changes any fee, this page will be updated first, and
        the amount will be shown clearly in the app before you are charged.
      </p>

      <h2>Contact</h2>
      <p>Questions about pricing can be sent to edotsauda@gmail.com.</p>
    </LegalLayout>
  )
}
