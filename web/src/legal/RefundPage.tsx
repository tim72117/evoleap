import { Link } from 'react-router-dom'
import { ContactEmail, Ext, Fill, LegalDoc, Note, type LegalSection } from './LegalDoc'
import { OPERATOR_NAME } from './operator'

/** 最後更新日期;內容有實質變更時一併更新 */
const REFUND_UPDATED = '2026-11-05'

/** 付款日起可申請退款的天數 */
const REFUND_DAYS = 14

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: '適用範圍',
    body: (
      <p>
        本政策適用於您在 evoleap.io（以下稱「本網站」）的付費訂閱。免費課程不需付款，不適用本政策。訂閱會依您選擇的計費週期自動續訂並扣款，直到您取消為止。
      </p>
    ),
  },
  {
    id: 'seller',
    title: '由 Paddle 處理訂單與退款',
    body: (
      <p>
        本網站的訂閱與付款流程由我們的線上轉售商 Paddle.com 處理。Paddle.com 是所有訂單的交易主體（Merchant of Record），負責收款、開立收據，以及處理客服詢問與退款。退款的審核與退回款項由 Paddle 依本政策及其
        <Ext href="https://www.paddle.com/legal/refund-policy">退款政策</Ext>辦理。
      </p>
    ),
  },
  {
    id: 'cancel',
    title: '如何取消訂閱',
    body: (
      <>
        <p>您可以隨時取消，以下任一種方式都可以：</p>
        <ul>
          <li>
            使用 Paddle 付款收據上的連結，或前往 <Ext href="https://paddle.net">Paddle.net</Ext> 管理訂閱。
          </li>
          <li>
            來信 <ContactEmail />，並提供您訂閱時使用的 Email，我們會協助處理。
          </li>
        </ul>
        <p>取消後不會再扣款，已付費的期間仍可使用到期滿。取消本身不會產生退款；如果想退回已付的款項，請依下面的條件申請。</p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: '可以退款的情形',
    body: (
      <>
        <p>首次訂閱與每次續訂的款項，都可以在該筆付款日起 {REFUND_DAYS} 天內申請全額退款。</p>
        <p>以下情形不受上述期限限制，請來信告訴我們：</p>
        <ul>
          <li>同一個計費週期被重複扣款。</li>
          <li>因我們的技術問題導致您無法使用付費內容，而且我們無法在合理時間內修復。</li>
          <li>我們終止付費服務。此時會按比例退還尚未使用期間的費用。</li>
        </ul>
        <Note>
          <p>超過期限時，原則上不提供一般退款，也不按比例退還當期剩餘的時間，但您依法享有的權利不受影響（見「您的法定權利」）。</p>
        </Note>
      </>
    ),
  },
  {
    id: 'how',
    title: '如何申請',
    body: (
      <>
        <p>您可以用以下任一種方式申請：</p>
        <ul>
          <li>
            使用 Paddle 付款收據上的連結，或前往 <Ext href="https://paddle.net">Paddle.net</Ext> 選擇申請退款。
          </li>
          <li>
            來信 <ContactEmail />，並提供您訂閱時使用的 Email 與收據上的訂單編號，我們會協助轉交處理。
          </li>
        </ul>
        <p>退款核准後，款項會退回原付款方式。實際入帳時間依付款方式與發卡機構而定。</p>
      </>
    ),
  },
  {
    id: 'after',
    title: '退款後的使用權限',
    body: (
      <p>
        全額退款核准後，該筆款項對應的訂閱會結束，付費內容的使用權限立即停止，也不會再續訂。爭議款（chargeback）成立時也相同。帳號與播放進度會保留，之後如果想再學習，可以重新訂閱。
      </p>
    ),
  },
  {
    id: 'statutory',
    title: '您的法定權利',
    body: (
      <p>
        本政策不影響您依所在地消費者保護法律享有的強制性權利。如果當地法律給您更多權利（例如特定地區的法定解除權），以該法律為準。
      </p>
    ),
  },
  {
    id: 'contact',
    title: '聯絡我們',
    body: (
      <p>
        對退款有任何疑問，請來信 <ContactEmail />（營運者：<Fill value={OPERATOR_NAME} />）。訂閱的其他規則請見<Link to="/terms">服務條款</Link>，付款資料的處理方式請見<Link to="/privacy">隱私權政策</Link>。
      </p>
    ),
  },
]

export function RefundPage() {
  return (
    <LegalDoc
      title="退款政策"
      updated={REFUND_UPDATED}
      intro={`簡單說：訂閱會自動續訂，可以隨時取消；每筆付款後 ${REFUND_DAYS} 天內可以申請全額退款；訂單與退款由 Paddle 處理，您依法享有的權利不受影響。`}
      sections={sections}
    />
  )
}
