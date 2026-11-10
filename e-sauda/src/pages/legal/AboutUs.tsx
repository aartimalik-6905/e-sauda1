import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function AboutUs() {
  return (
    <LegalLayout title="About Us" lastUpdated="November 5, 2026">
      <p>
        e-Sauda is an online classifieds platform where people in India buy and sell
        second-hand and local items directly with each other. Whether it's furniture,
        electronics or anything else worth a second life, you list it, chat with a
        buyer or seller nearby, meet, and complete the deal between yourselves.
      </p>

      <h2>Who we are</h2>
      <p>
        e-Sauda is operated by ANSHU YADAV, a sole proprietorship registered in
        India, operating out of South West Delhi, Delhi.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>
          <strong>Sellers list:</strong> add photos, a short video of the item, a
          description and a price. A small listing fee is paid online when the listing
          is published.
        </li>
        <li>
          <strong>Buyers browse and chat:</strong> search by category and area, watch
          the video, and message the seller in the app. Making offers and
          negotiating a price is built into the chat.
        </li>
        <li>
          <strong>Deal in person:</strong> buyer and seller meet, the buyer checks the
          item, and payment is made directly to the seller, by cash or UPI. e-Sauda
          never holds or handles that money.
        </li>
      </ul>

      <h2>How we earn</h2>
      <p>
        Only from the small listing fee paid by sellers (see{' '}
        <Link to="/pricing" className="text-clay hover:underline">Pricing</Link>). We
        take no commission on sales and charge buyers nothing.
      </p>

      <h2>Trust &amp; safety</h2>
      <ul>
        <li>A mandatory product video, so listings show the real item.</li>
        <li>Report and block tools on every listing and chat, reviewed by our team.</li>
        <li>Chat warnings for risky messages such as OTP requests, advance-payment requests and UPI IDs.</li>
        <li>Ratings after a deal, so good members are visible.</li>
        <li>A <Link to="/safety" className="text-clay hover:underline">Safety tips</Link> guide for meeting and paying safely.</li>
      </ul>

      <h2>Our mission</h2>
      <p>
        We want local reselling to be simple, cheap and safe, while keeping what
        makes person-to-person trade valuable: fair prices, direct conversations and
        items that get a second life instead of ending up in landfill.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about e-Sauda? Reach us at edotsauda@gmail.com or visit our{' '}
        <Link to="/contact" className="text-clay hover:underline">Contact Us</Link>{' '}
        page.
      </p>
    </LegalLayout>
  )
}
