import LegalLayout from '../../components/LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 19, 2026">
      <p>
        This Privacy Policy explains what information e-Sauda collects, why, and how
        it's used. e-Sauda is operated by ANSHU YADAV, a sole proprietorship
        registered in India ("we", "us").
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details: email address, display name, and city you provide at signup.</li>
        <li>Listings you post: title, description, price, category, condition, and photos.</li>
        <li>Messages you send to other users through e-Sauda's chat.</li>
        <li>
          Payment information: when you buy something via Sauda Vault (or pay the
          anti-bot listing fee described in our Pricing page), your payment is
          processed directly by our third-party payment gateway partner -- e-Sauda
          does not receive or store your card, UPI, or bank details. We store only
          the transaction reference and amount needed to confirm your order.
        </li>
        <li>Ratings and reports you submit about other users or listings.</li>
        <li>Basic usage data (e.g. login times) needed to keep your account secure.</li>
      </ul>

      <h2>How we use this information</h2>
      <ul>
        <li>To operate the marketplace: showing listings, enabling chat, processing Vault orders.</li>
        <li>To calculate trust scores and verification status shown on profiles.</li>
        <li>To send you notifications about messages, orders, and reports you're involved in.</li>
        <li>To review reports of policy violations and take moderation action where needed.</li>
        <li>To comply with legal obligations, including those related to payment processing.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share payment details with our third-party payment gateway partner solely
        to process your transaction, governed by that partner's own privacy policy.
        We do not sell your personal information to third parties. We may disclose
        information if required by law or to protect the safety of our users.
      </p>

      <h2>Reports and moderation privacy</h2>
      <p>
        If you file a report about another user or listing, your identity as the
        reporter is kept private from the person you reported -- only e-Sauda's
        administrators can see who filed a report.
      </p>

      <h2>Data retention</h2>
      <p>
        We retain your account and transaction data for as long as your account is
        active, and as needed to comply with legal and tax obligations. You may
        request deletion of your account by contacting us at edotsauda@gmail.com.
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
