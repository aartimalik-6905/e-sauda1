import LegalLayout from '../../components/LegalLayout'

export default function ContactUs() {
  return (
    <LegalLayout title="Contact Us" lastUpdated="November 5, 2026">
      <p>
        e-Sauda is operated by ANSHU YADAV, a sole proprietorship based in
        India. If you have a question, an issue with a listing or your account, or need to
        report something, reach us through any of the channels below.
      </p>

      <h2>Support email</h2>
      <p>edotsauda@gmail.com -- we aim to respond within 2 business days.</p>

      <h2>Phone</h2>
      <p>9817116312 -- available Mon-Sat, 10am-6pm IST.</p>

      <h2>Registered address</h2>
      {/* TODO: append the PIN code exactly as it appears on your business/KYC documents, so it matches what you give Cashfree. */}
      <p>RZF-371 A, AMBEDKAR MARG, RAJ NAGAR PART 2, PALAM, NEW DELHI</p>

      <h2>For issues with a listing or another user</h2>
      <p>
        If your question is about a specific listing or person, it's fastest to use the
        in-app Report feature on the listing or profile. This gives our team the
        context needed to help quickly. Deals and payments between buyers and sellers
        are made directly between them, so we cannot reverse them.
      </p>

      <h2>For listing fee payment issues</h2>
      <p>
        The listing fee is processed by our payment gateway partner, Cashfree. If the
        fee was deducted but your listing was not published, contact us at
        edotsauda@gmail.com with your account email and approximate payment time, and
        we'll look into it.
      </p>
    </LegalLayout>
  )
}
