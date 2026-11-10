import LegalLayout from '../../components/LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="November 5, 2026">
      <p>
        This Privacy Policy explains what information e-Sauda collects, why, and how
        it's used. e-Sauda is operated by ANSHU YADAV, a sole proprietorship
        registered in India ("we", "us").
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details: email address, display name, and city you provide at signup.</li>
        <li>Listings you post: title, description, price, category, condition, location, photos and video.</li>
        <li>Messages and price offers you send to other users through e-Sauda's chat.</li>
        <li>
          Payment information: the only payment on e-Sauda is the seller's listing fee.
          It is processed directly by our payment gateway partner (Cashfree). e-Sauda
          does not receive or store your card, UPI or bank details. We store only the
          transaction reference and amount needed to confirm that the fee was paid.
        </li>
        <li>Ratings and reports you submit about other users or listings.</li>
        <li>Basic usage data (e.g. login times) needed to keep your account secure.</li>
      </ul>
      <p>
        e-Sauda does not handle payments between buyers and sellers, so we do not see
        or store any information about how users pay each other.
      </p>

      <h2>How we use this information</h2>
      <ul>
        <li>To operate the platform: showing listings and enabling chat and offers.</li>
        <li>To calculate trust scores and ratings shown on profiles.</li>
        <li>To send you notifications about messages and reports you're involved in.</li>
        <li>To review reports of policy violations and take moderation action where needed.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Your name, city, listings, ratings and the content of your listings are visible
        to other users. Your messages are visible only to the person you are chatting
        with. We share payment details with our payment gateway partner solely to
        process the listing fee, governed by that partner's own privacy policy. We do
        not sell your personal information. We may disclose information if required by
        law or to protect the safety of our users.
      </p>

      <h2>Reports and moderation privacy</h2>
      <p>
        If you file a report about another user or listing, your identity as the
        reporter is kept private from the person you reported. Only e-Sauda's
        administrators can see who filed a report.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We retain your account data for as long as your account is active, and as
        needed to comply with legal and tax obligations. You can delete your account
        from your Profile page; your name and details are anonymised and your active
        listings are taken down.
      </p>

      <h2>Your choices</h2>
      <p>
        You can update your display name and profile details at any time from your
        Profile page. You can block other users from messaging you, and manage your
        saved items and notifications from within the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this Privacy Policy or your data can be sent to
        edotsauda@gmail.com.
      </p>
    </LegalLayout>
  )
}
