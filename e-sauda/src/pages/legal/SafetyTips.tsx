import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function SafetyTips() {
  return (
    <LegalLayout title="Safety Tips" lastUpdated="November 5, 2026">
      <p>
        On e-Sauda, buyers and sellers meet and pay each other directly. e-Sauda does
        not hold your money, so the best protection is to follow these simple rules.
      </p>

      <h2>Before you meet</h2>
      <ul>
        <li>Chat in the app first. Watch the listing video and ask for anything you want to see.</li>
        <li>Check the other person's profile, ratings and how long they've been on e-Sauda.</li>
        <li><strong>Never pay in advance</strong>, not even a small "token" or "booking" amount, to someone you haven't met.</li>
        <li>Be careful with anyone who rushes you, refuses to meet, or keeps changing the place.</li>
        <li>For phones and vehicles, ask about the bill, the box, the IMEI or the RC documents, and check them when you meet.</li>
      </ul>

      <h2>At the meetup</h2>
      <ul>
        <li>Meet in a busy public place such as a metro station, mall or market, in daylight where possible.</li>
        <li>Avoid secluded places, and avoid inviting strangers home or going to theirs.</li>
        <li>Take a friend or family member, or at least tell someone where you're going.</li>
        <li>Check the item properly, and compare it with the photos and video.</li>
      </ul>

      <h2>Paying and getting paid</h2>
      <ul>
        <li>Pay only after you have seen and tested the item.</li>
        <li>Sellers: check that the money is in <strong>your own bank or UPI app</strong> before handing over the item. A screenshot is not proof of payment.</li>
        <li><strong>Never share an OTP</strong> or UPI PIN with anyone. You never need a PIN to receive money.</li>
        <li><strong>Never scan a QR code or accept a "collect request" to receive money.</strong> Scanning a code only ever sends money out.</li>
        <li>Be wary of overpayments, "refund the extra" requests, and anyone asking for a courier, customs or processing fee.</li>
      </ul>

      <h2>Report and block</h2>
      <p>
        Use <strong>Report</strong> on any listing or user that looks fake or unsafe,
        and <strong>Block</strong> in chat to stop someone messaging you. Our team
        reviews reports and can remove listings and suspend accounts.
      </p>

      <h2>If you have been cheated</h2>
      <ul>
        <li>Report the user and the listing on e-Sauda.</li>
        <li>For online or UPI fraud, call the National Cyber Crime helpline <strong>1930</strong> or report at cybercrime.gov.in as soon as possible.</li>
        <li>Contact your bank immediately. For theft or threats, call the police.</li>
      </ul>
      <p>
        e-Sauda is not a party to deals between users and cannot recover money or
        items. See our <Link to="/terms" className="text-clay hover:underline">Terms</Link>.
      </p>
    </LegalLayout>
  )
}
