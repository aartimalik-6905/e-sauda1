import LegalLayout from '../../components/LegalLayout'

export default function AboutUs() {
  return (
    <LegalLayout title="About Us" lastUpdated="October 30, 2026">
      <p>
        e-Sauda is a peer-to-peer local marketplace where individuals buy and sell
        directly with each other -- no warehouses, no middlemen, no drama. Whether
        it's furniture, electronics, or anything else worth a second life, e-Sauda
        makes it simple to list an item, chat with a genuine buyer or seller nearby,
        and complete the exchange with confidence.
      </p>

      <h2>Who we are</h2>
      <p>
        e-Sauda is operated by ANSHU YADAV, a sole proprietorship registered in
        India, operating out of South West Delhi, Delhi.
      </p>

      <h2>What makes e-Sauda different</h2>
      <ul>
        <li>
          <strong>Sauda Vault (escrow):</strong> when a buyer pays for a listing, the
          payment is held securely and released to the seller only after the buyer
          confirms handover with a one-time code -- so neither side has to trust a
          stranger blindly.
        </li>
        <li>
          <strong>Direct, peer-to-peer buying:</strong> every listing is bought
          individually, in a single transaction between one buyer and one seller.
          There's no shopping cart because there's no multi-seller checkout to
          combine -- you view a listing, agree a price (or accept an offer), and buy
          it directly.
        </li>
        <li>
          <strong>Real-time chat:</strong> buyers and sellers coordinate meetups and
          ask questions directly within the app.
        </li>
        <li>
          <strong>Trust &amp; safety tools:</strong> ratings, reporting, and
          moderation help keep listings and users accountable.
        </li>
      </ul>

      <h2>Our mission</h2>
      <p>
        We want reselling locally to feel as easy and safe as buying from a store --
        without losing what makes peer-to-peer trade valuable: fair prices, direct
        conversations, and items that get a second life instead of ending up in
        landfill.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about e-Sauda? Reach us at edotsauda@gmail.com or visit our{' '}
        <a href="/contact" className="text-clay hover:underline">
          Contact Us
        </a>{' '}
        page.
      </p>
    </LegalLayout>
  )
}
