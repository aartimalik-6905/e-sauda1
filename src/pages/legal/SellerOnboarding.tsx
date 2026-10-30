import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function SellerOnboarding() {
  return (
    <LegalLayout title="Seller Onboarding and KYC" lastUpdated="October 30, 2026">
      <p>
        e-Sauda is a peer-to-peer marketplace operated by ANSHU YADAV (trading as
        e-Sauda). Individual sellers list their own items and buyers purchase them
        directly. This page explains how a seller is onboarded, what identity
        information we collect, and how seller payouts work.
      </p>

      <h2>Onboarding process flow</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li>
          <strong>Create an account:</strong> the seller signs up with an email
          address, display name, and city, and verifies their email.
        </li>
        <li>
          <strong>Complete identity verification (KYC):</strong> the seller submits
          the documents listed below. Until KYC is complete, the seller can browse,
          chat, and save items, but cannot receive a payout.
        </li>
        <li>
          <strong>Post a listing:</strong> the seller adds photos, a mandatory
          product video, a description, a category, and a price in INR. A small
          anti-bot listing fee applies (see our{' '}
          <Link to="/pricing" className="text-clay hover:underline">Pricing</Link>{' '}
          page).
        </li>
        <li>
          <strong>Listing review:</strong> listings are subject to automated checks
          and moderation. Prohibited or counterfeit items are removed.
        </li>
        <li>
          <strong>Sale through Sauda Vault:</strong> the buyer pays through our
          payment gateway partner and the amount is held in escrow.
        </li>
        <li>
          <strong>Handover and payout:</strong> after the buyer confirms handover
          with a one-time code, the sale amount is released to the seller's
          verified bank account or UPI ID.
        </li>
      </ol>

      <h2>KYC documents collected from sellers</h2>
      <ul>
        <li>Government photo ID: Aadhaar (verified via DigiLocker) or another officially valid ID.</li>
        <li>PAN card, for tax identification.</li>
        <li>Bank account details or a UPI ID in the seller's own name, for payouts.</li>
        <li>GST registration details, only where the seller is registered under GST.</li>
      </ul>
      <p>
        The name on the payout account must match the name on the identity
        document. Payouts are not released to accounts in a third party's name.
      </p>

      <h2>How we handle KYC data</h2>
      <p>
        KYC documents are used only to verify identity and process payouts, are
        stored securely, and are never displayed to other users. See our{' '}
        <Link to="/privacy" className="text-clay hover:underline">Privacy Policy</Link>{' '}
        for details.
      </p>

      <h2>Suspension</h2>
      <p>
        We may withhold payouts or suspend a seller account if KYC information is
        found to be false, or if the account is involved in fraud or repeated
        policy violations. See our{' '}
        <Link to="/terms" className="text-clay hover:underline">Terms and Conditions</Link>.
      </p>

      <h2>Contact</h2>
      <p>Questions about seller onboarding can be sent to edotsauda@gmail.com.</p>
    </LegalLayout>
  )
}
