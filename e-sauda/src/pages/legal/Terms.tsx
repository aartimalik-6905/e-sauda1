import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function Terms() {
  return (
    <LegalLayout title="Terms and Conditions" lastUpdated="November 5, 2026">
      <p>
        <strong>This website is operated by ANSHU YADAV</strong>, trading as
        e-Sauda ("we", "us", "the platform"), a sole proprietorship registered in
        India, operating out of South West Delhi, Delhi. These Terms govern your use
        of e-Sauda's website and services.
      </p>

      <h2>What e-Sauda is</h2>
      <p>
        e-Sauda is an online classifieds platform for local, person-to-person (C2C)
        trade. Individuals list items they want to sell, and other individuals
        browse those listings and contact the seller through in-app chat. e-Sauda
        only provides the space where buyers and sellers find each other. We do not
        own, inspect, sell, ship or deliver any item, and we are not a party to any
        sale.
      </p>

      <h2>How a deal works</h2>
      <ul>
        <li>The buyer and seller agree the price, time and place of meeting directly between themselves.</li>
        <li>The buyer inspects the item in person.</li>
        <li>The buyer pays the seller directly, in cash, by UPI or by any other method they both agree on.</li>
        <li>e-Sauda does not collect, hold, transfer or guarantee any payment between buyer and seller.</li>
      </ul>
      <p>
        The contract of sale is solely between the buyer and the seller. e-Sauda is
        not responsible for the quality, safety, legality, authenticity or
        availability of any listed item, for whether a buyer or seller turns up, or
        for any payment made between users.
      </p>

      <h2>Listing fee</h2>
      <p>
        The only payment taken by e-Sauda is a small listing fee paid by the seller
        when publishing a listing, charged through our payment gateway partner
        (Cashfree). The amounts are on our{' '}
        <Link to="/pricing" className="text-clay hover:underline">Pricing</Link>{' '}
        page. The fee is for the use of the platform and is not a commission on the
        sale. Buyers pay e-Sauda nothing.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate information about yourself and your items. Photos and the video must show the actual item.</li>
        <li>Only list items that you own and are legally allowed to sell.</li>
        <li>Never ask for, or make, advance payments to a person you have not met.</li>
        <li>Meet in a safe public place and check the item and the payment before handing anything over. See our <Link to="/safety" className="text-clay hover:underline">Safety tips</Link>.</li>
        <li>Never share OTPs or scan QR codes or approve payment requests to "receive" money.</li>
      </ul>

      <h2>Prohibited items and conduct</h2>
      <p>
        You may not list or attempt to sell illegal items, stolen goods, counterfeit
        goods, weapons, drugs, live animals, or anything else prohibited under Indian
        law. You may not harass other users, create fake listings or accounts, or use
        the platform to run scams. We may remove listings, suspend accounts and
        cooperate with law enforcement where required. Any user can report a listing
        or account for review.
      </p>

      <h2>Account suspension</h2>
      <p>
        We may suspend an account found to violate these Terms, including for fraud,
        harassment, or repeated policy violations. A suspended account cannot post
        new listings or send new messages.
      </p>

      <h2>Disputes between users</h2>
      <p>
        Because deals happen directly between users, any dispute about an item or a
        payment must be settled between the buyer and the seller. If you think you
        have been cheated, report the listing or user in the app, and for financial
        fraud contact the National Cyber Crime helpline (1930) or your local police.
        We will review reports and may take action on accounts and listings, but we
        cannot recover money or items.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, e-Sauda is not liable for any loss,
        damage or dispute arising from a transaction or meeting between users, or for
        content posted by users.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of e-Sauda after a
        change constitutes acceptance of the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms can be sent to edotsauda@gmail.com. See also our{' '}
        <Link to="/contact" className="text-clay hover:underline">Contact Us</Link> page.
      </p>
    </LegalLayout>
  )
}
