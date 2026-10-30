import { Link } from 'react-router-dom'
import LegalLayout from '../../components/LegalLayout'

export default function RefundPolicy() {
  return (
    <LegalLayout title="Return and Refund Policy" lastUpdated="October 30, 2026">
      <p>
        This policy explains returns and refunds for purchases made through Sauda
        Vault, e-Sauda's escrow-based payment system. e-Sauda is a marketplace;
        items are sold by individual sellers.
      </p>

      <h2>How Sauda Vault payments work</h2>
      <p>
        Your payment is collected upfront and held in escrow. It is released to the
        seller only after you inspect the item and confirm handover using a
        one-time code.
      </p>

      <h2>Returns</h2>
      <p>
        Inspect the item at handover <strong>before</strong> sharing the one-time
        code. If the item is not as described, do not share the code; cancel the
        order for a full refund instead. Once the code is shared and handover is
        confirmed, the sale is final and the item cannot be returned through
        e-Sauda.
      </p>

      <h2>Refund mode</h2>
      <p>
        Refunds are always paid back to the <strong>original payment method</strong>{' '}
        (the card, UPI ID, or bank account used for the purchase). We do not issue
        refunds in cash or to a different account.
      </p>

      <h2>Refund duration</h2>
      <p>
        A refund is initiated immediately when an order is cancelled before
        handover. It typically reaches your account within{' '}
        <strong>5-7 business days</strong>, depending on your bank or payment
        provider.
      </p>

      <h2>Delivery fee deductions</h2>
      <p>
        If a third-party delivery had already been arranged before cancellation,
        that delivery fee is deducted from the refund. Otherwise the full amount is
        refunded. The exact refund amount is shown on your order.
      </p>

      <h2>Disputes after handover</h2>
      <p>
        If an item was misrepresented, report it within <strong>48 hours</strong> of
        handover using the Report feature on the listing or seller profile. Our team
        reviews reports within <strong>5 business days</strong> and may remove
        listings or suspend accounts. Because payment has already been released to
        the seller, any refund after handover is settled between buyer and seller.
      </p>

      <h2>Failed or delayed refunds</h2>
      <p>
        If your order shows as cancelled but you have not received your refund
        within 7 business days, contact edotsauda@gmail.com with your order details.
      </p>

      <p>
        See also our{' '}
        <Link to="/cancellation-policy" className="text-clay hover:underline">Cancellation Policy</Link>.
      </p>
    </LegalLayout>
  )
}
