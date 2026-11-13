// English version (for reference; the Traditional Chinese version in ../zh/RefundZh.tsx prevails).
// When the policy changes, update both versions together.
import { Link } from 'react-router-dom'
import { ContactEmail, Ext, Fill, LegalDoc, Note, type LegalSection } from '../LegalDoc'
import { OPERATOR_NAME } from '../operator'
import { REFUND_UPDATED, REFUND_DAYS } from '../updated'
import { useT } from '../../i18n/I18nProvider'

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: 'Scope',
    body: (
      <p>
        This policy applies to paid subscriptions on evoleap.io (the "Site"). Free courses require no payment and are not covered by this policy. Your subscription renews automatically and is charged according to the billing period you chose, until you cancel.
      </p>
    ),
  },
  {
    id: 'seller',
    title: 'Orders and refunds are handled by Paddle',
    body: (
      <p>
        Subscriptions and payments on the Site are processed by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders and handles payment collection, receipts, customer service inquiries, and refunds. Refunds are reviewed and paid back by Paddle in accordance with this policy and Paddle's{' '}
        <Ext href="https://www.paddle.com/legal/refund-policy">Refund Policy</Ext>.
      </p>
    ),
  },
  {
    id: 'cancel',
    title: 'How to cancel your subscription',
    body: (
      <>
        <p>You can cancel at any time in either of the following ways:</p>
        <ul>
          <li>
            Use the link on your Paddle payment receipt, or go to <Ext href="https://paddle.net">Paddle.net</Ext> to manage your subscription.
          </li>
          <li>
            Email us at <ContactEmail /> with the email address you used to subscribe, and we will help you.
          </li>
        </ul>
        <p>
          After you cancel, you will not be charged again, and you can keep using the service until the end of the period you have already paid for. Cancelling does not by itself result in a refund; if you would like a refund of an amount you have paid, please request one under the conditions below.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'When you can get a refund',
    body: (
      <>
        <p>
          For your first subscription payment and for each renewal payment, you may request a full refund within {REFUND_DAYS} days from the date of that payment.
        </p>
        <p>The time limit above does not apply in the following cases. Please email us and let us know:</p>
        <ul>
          <li>You were charged more than once for the same billing period.</li>
          <li>A technical problem on our side prevents you from using the paid content, and we cannot fix it within a reasonable time.</li>
          <li>We discontinue the paid service. In that case, we will refund the fees for the unused portion of the period on a pro-rata basis.</li>
        </ul>
        <Note>
          <p>
            After the time limit has passed, we generally do not provide ordinary refunds or pro-rata refunds for the remaining time of the current period. This does not affect any rights you have under applicable law (see "Your statutory rights").
          </p>
        </Note>
      </>
    ),
  },
  {
    id: 'how',
    title: 'How to request a refund',
    body: (
      <>
        <p>You can request a refund in either of the following ways:</p>
        <ul>
          <li>
            Use the link on your Paddle payment receipt, or go to <Ext href="https://paddle.net">Paddle.net</Ext> and choose to request a refund.
          </li>
          <li>
            Email us at <ContactEmail /> with the email address you used to subscribe and the order number on your receipt, and we will pass your request on for processing.
          </li>
        </ul>
        <p>
          Once a refund is approved, the money will be returned to your original payment method. When it arrives in your account depends on your payment method and card issuer.
        </p>
      </>
    ),
  },
  {
    id: 'after',
    title: 'Access after a refund',
    body: (
      <p>
        Once a full refund is approved, the subscription covered by that payment ends, your access to paid content stops immediately, and the subscription will not renew. The same applies if a chargeback is upheld. Your account and playback progress are kept, so you can subscribe again if you want to continue learning later.
      </p>
    ),
  },
  {
    id: 'statutory',
    title: 'Your statutory rights',
    body: (
      <p>
        This policy does not affect any mandatory rights you have under the consumer protection laws where you live. If local law gives you more rights (for example, a statutory right of withdrawal in certain regions), that law prevails.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        If you have any questions about refunds, please email us at <ContactEmail /> (operator: <Fill value={OPERATOR_NAME} />). For other subscription rules, see our <Link to="/terms">Terms of Service</Link>; for how payment data is handled, see our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
]

export function RefundEn() {
  const t = useT()
  return (
    <LegalDoc
      title={t.legal.refundTitle}
      updated={REFUND_UPDATED}
      intro={`In short: your subscription renews automatically and you can cancel at any time; you can request a full refund within ${REFUND_DAYS} days after each payment; orders and refunds are handled by Paddle; and your statutory rights are not affected.`}
      sections={sections}
    />
  )
}
