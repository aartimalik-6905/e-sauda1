import LegalLayout from '../../components/LegalLayout'

export default function ShippingPolicy() {
  return (
    <LegalLayout title="Shipping Policy" lastUpdated="October 30, 2026">
      <p>
        e-Sauda is a local marketplace built around in-person exchange, not
        warehouse-to-doorstep shipping. This policy explains how items actually change
        hands.
      </p>

      <h2>Primary handover method: in-person meetup</h2>
      <p>
        Once a buyer funds a Vault order, the buyer and seller arrange a time and
        place to meet, using e-Sauda's chat. At the meetup, the buyer shares a
        one-time handover code with the seller to confirm the exchange and release
        payment. There is no shipping carrier, warehouse, or transit time involved in
        this method -- handover typically happens within 0-7 days of an order being
        funded, depending on how quickly both parties can meet.
      </p>

      <h2>Delivery arrangement (experimental feature)</h2>
      <p>
        e-Sauda also offers an in-app option to arrange delivery via a third-party
        courier as an alternative to meeting in person. This feature is currently
        experimental: it estimates availability, cost, and timing, but does not yet
        represent a live, contracted integration with any specific courier or
        ride-hailing company. If you use this option, treat the estimated time and fee
        as indicative rather than guaranteed, and confirm delivery specifics directly
        with your counterparty. We are working toward a real third-party delivery
        integration; this policy will be updated once that's live.
      </p>

      <h2>No shipping charges beyond delivery fees</h2>
      <p>
        e-Sauda does not charge separate shipping or handling fees. If a delivery
        partner is arranged for an order, that partner's fee (shown before you confirm)
        is the only delivery-related cost, and is deducted from any refund only if the
        delivery had already been arranged at the time of cancellation -- see our
        Cancellation Policy and Return and Refund Policy.
      </p>

      <h2>Lost or damaged items</h2>
      <p>
        Since e-Sauda does not currently operate its own logistics network, disputes
        about items damaged or lost in transit during a self-arranged or
        third-party-assisted delivery should be raised directly between buyer and
        seller, or reported to e-Sauda via the Report feature for review.
      </p>

      <h2>Contact</h2>
      <p>Questions about delivery or handover can be sent to edotsauda@gmail.com.</p>
    </LegalLayout>
  )
}
