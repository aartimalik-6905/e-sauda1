import LegalLayout from '../../components/LegalLayout'

// PLACEHOLDER fields (marked clearly below) need your real details filled in before
// this goes live -- legal name, registered address, and support contact must match
// what you give your payment processor during KYC (Razorpay today; PayU once that
// verification is complete), or the mismatch can hold up your website/app
// activation step.
export default function Terms() {
  return (
    <LegalLayout title="Terms and Conditions" lastUpdated="July 19, 2026">
      <p>
        e-Sauda ("we", "us", "the platform") is operated by ANSHU YADAV, a
        sole proprietorship registered in India, operating out of SOUTH WEST DELHI,DELHI.
        These Terms govern your use of e-Sauda's website and services.
      </p>

      <h2>What e-Sauda is</h2>
      <p>
        e-Sauda is a peer-to-peer local marketplace connecting individual buyers and
        sellers. We are a platform that facilitates listings, communication, and
        payment handling between users -- we are not a party to the sale itself. The
        contract of sale is between the buyer and the seller.
      </p>

      <h2>Sauda Vault (escrow)</h2>
      <p>
        When a buyer purchases a listing through Sauda Vault, their payment is
        collected via our payment processor and held until the buyer
        confirms they've received the item, using a one-time handover code shared with
        the seller at the point of exchange. Funds are released to the seller only
        after handover is confirmed.
      </p>
      <p>
        If a Vault order is cancelled before handover, the buyer's payment is refunded,
        minus any delivery fee already incurred if a delivery partner had already been
        arranged for that order. See our Cancellation and Refunds Policy for full
        details and timelines.
      </p>

      <h2>Delivery</h2>
      <p>
        e-Sauda's primary handover method is an in-person meetup between buyer and
        seller, confirmed via the Vault's one-time code. The in-app "arrange delivery"
        option is an experimental feature for estimating third-party courier
        availability and cost; it does not currently represent a live integration with
        any named courier or ride-hailing service, and delivery timing/availability is
        not guaranteed by e-Sauda. See our Shipping Policy for details.
      </p>

      <h2>Prohibited items and conduct</h2>
      <p>
        You may not list or attempt to sell illegal items, counterfeit goods, or
        anything prohibited under Indian law. We reserve the right to remove listings,
        suspend accounts, and cooperate with law enforcement where required. Our
        reporting and moderation systems let any user flag a listing or account for
        review.
      </p>

      <h2>Account suspension</h2>
      <p>
        We may suspend an account found to violate these Terms, including for fraud,
        harassment, or repeated policy violations. A suspended account cannot post new
        listings or send new messages; it does not retroactively affect completed
        transactions.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        e-Sauda facilitates transactions between users but does not guarantee the
        condition, legality, or quality of any listed item. To the maximum extent
        permitted by law, e-Sauda is not liable for disputes between buyers and
        sellers beyond the Vault escrow and refund mechanisms described above.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of e-Sauda after a
        change constitutes acceptance of the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms can be sent to edotsauda@gmail.com. See also our
        Contact Us page.
      </p>
    </LegalLayout>
  )
}
