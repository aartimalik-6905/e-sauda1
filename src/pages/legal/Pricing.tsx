import LegalLayout from '../../components/LegalLayout'

export default function Pricing() {
  return (
    <LegalLayout title="Pricing" lastUpdated="July 19, 2026">
      <p>
        This page describes what e-Sauda currently charges, in plain terms, for both
        buyers and sellers.
      </p>

      <h2>Posting a listing</h2>
      <p>
        Posting your first active listing in a category costs a ₹1 anti-bot listing
        fee, charged through our payment gateway partner before the listing goes
        live. This fee increases the more active listings you already have in that
        same category at the time of posting -- ₹10 for a second, ₹25 for a third or
        beyond -- as a deterrent against bulk/bot-style relisting, not a revenue
        feature. It resets per category as your listings there sell, expire, or are
        removed.
      </p>

      <h2>Buying a listing (Sauda Vault)</h2>
      <p>
        When you buy a listing through Sauda Vault, you pay exactly the listed price
        shown on the listing -- in Indian Rupees (INR) -- through our payment gateway
        partner. e-Sauda does not currently add any platform commission, service fee,
        or payment-processing surcharge on top of the listed price.
      </p>

      <h2>Delivery fees</h2>
      <p>
        If you choose to arrange delivery through a third party instead of meeting in
        person, an estimated delivery fee is shown before you confirm. See our
        Shipping Policy for the current status of this feature.
      </p>

      <h2>Refunds</h2>
      <p>
        If a Vault order is cancelled before handover, you're refunded in full, minus
        any delivery fee already incurred for that specific order. See our
        Cancellation and Refunds Policy for the full timeline. The ₹1-₹25 anti-bot
        listing fee is not refundable once a listing has been published, since it
        covers the act of posting itself rather than the sale.
      </p>

      <h2>Changes to pricing</h2>
      <p>
        If e-Sauda introduces or changes any fee described on this page, this page
        will be updated in advance, and the change will be clearly shown in the
        relevant part of the app before you're charged.
      </p>

      <h2>Contact</h2>
      <p>Questions about pricing can be sent to edotsauda@gmail.com .</p>
    </LegalLayout>
  )
}
