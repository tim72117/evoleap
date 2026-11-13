// English version (for reference; the Traditional Chinese version in ../zh/TermsZh.tsx prevails).
// When the terms change, update both versions together.
import { Link } from 'react-router-dom'
import { ContactEmail, Ext, Fill, LegalDoc, Note, type LegalSection } from '../LegalDoc'
import { OPERATOR_NAME } from '../operator'
import { TERMS_UPDATED } from '../updated'
import { useT } from '../../i18n/I18nProvider'

const sections: LegalSection[] = [
  {
    id: 'accept',
    title: 'Acceptance of these Terms',
    body: (
      <p>
        Welcome to evoleap.io (the "Site"). The Site is operated by <Fill value={OPERATOR_NAME} /> ("we" or "us"). By browsing or using the Site and its courses, you confirm that you have read and agree to these Terms of Service. If you do not agree, please stop using the Site. For how we handle your data, please see our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <>
        <p>
          The Site offers AI courses for complete beginners, including course maps, video lessons, written explanations, and prompt examples you can copy. The Prologue of each course can be watched without signing in; Lesson 0 requires you to sign up and sign in, and is free once you are signed in; later lessons are included in the paid subscription.
        </p>
        <ul>
          <li>Once you sign up and sign in, we record your playback progress (see "Accounts" below for account rules).</li>
          <li>
            Course content, structure, and availability may change at any time. We do not guarantee that any particular course will always be available, or that the Site will always be accessible.
          </li>
          <li>
            The price, billing period, and renewal terms of paid subscriptions will be clearly shown before checkout. See "Paid subscriptions" for the rules.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Accounts',
    body: (
      <>
        <p>
          You can sign up with an email address and password, or sign in with your Google account. By signing up or signing in, you agree to these Terms; for how we handle account data, please see our <Link to="/privacy">Privacy Policy</Link>. When using your account, please follow these rules:
        </p>
        <ul>
          <li>
            <strong>Provide accurate information:</strong> Please use an email address that belongs to you and that you can receive mail at. We need it to verify your identity, for example when handling requests to access or delete your account.
          </li>
          <li>
            <strong>One person, one account:</strong> Your account is for your personal use only. Do not share, transfer, lend, or sell it to anyone else.
          </li>
          <li>
            <strong>Keep your password safe:</strong> Please choose a password you do not use on any other website, keep it safe, and do not tell it to anyone. Remember to sign out after using a public or someone else's computer. If you find that your account may have been used by someone else, please let us know as soon as possible at <ContactEmail />.
          </li>
          <li>
            <strong>Signing in with Google:</strong> Your Google account itself is provided and managed by Google and is subject to Google's terms of service and privacy policy. Whether you can sign in to the Site also depends on your Google account working normally.
          </li>
        </ul>
        <p>
          If an account is used in violation of these Terms (for example, sharing an account, signing up under someone else's identity, mass sign-ups using automated programs, or violating "Acceptable use"), we may suspend or terminate that account. Where circumstances permit, we will first notify you by the account's email address and explain why.
        </p>
        <p>
          You may stop using your account at any time. The Site does not yet offer a self-service way to delete your account. To delete it, please email <ContactEmail /> from the email address you signed up with, and once we confirm it is you, we will delete your account data.
        </p>
      </>
    ),
  },
  {
    id: 'subscription',
    title: 'Paid subscriptions',
    body: (
      <>
        <p>
          Subscriptions and payments on the Site are processed by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders and handles payment collection, receipts, customer service inquiries, and refunds. When you pay, you also need to agree to Paddle's{' '}
          <Ext href="https://www.paddle.com/legal/invoiced-consumer-terms">Buyer Terms</Ext>.
        </p>
        <ul>
          <li>
            <strong>What the subscription includes:</strong> During your subscription, you can use the Site's paid learning features and access all paid courses, including courses added during your subscription. A subscription is a right to use the service during the subscription period, not permanent ownership of the courses; course content may change as described in "The service".
          </li>
          <li>
            <strong>Price:</strong> The actual amount, currency, taxes, and billing period are as shown on the checkout screen. Taxes are calculated based on where you are located.
          </li>
          <li>
            <strong>Automatic renewal:</strong> Your subscription automatically renews and is charged at the end of each period according to the billing period you chose, until you cancel.
          </li>
          <li>
            <strong>Cancellation:</strong> You can cancel at any time; see our <Link to="/refund">Refund Policy</Link> for how. After you cancel, you will not be charged again, and you can keep using the service until the end of the period you have already paid for. After that, you will no longer be able to access paid courses, but your account and playback progress are kept, so you can pick up where you left off if you subscribe again. Cancelling does not by itself result in a refund.
          </li>
          <li>
            <strong>Failed payments:</strong> If a renewal payment fails, Paddle may retry the charge. If it still cannot be completed, your subscription may be paused or ended, and your access to paid content will stop as well.
          </li>
          <li>
            <strong>Price changes:</strong> Before changing the subscription price, we will notify you in advance by your account's email address. The new price applies from your next billing period; if you do not agree, you can cancel before it takes effect.
          </li>
          <li>
            <strong>Sign-in required:</strong> You must sign in to your account to subscribe. Subscription benefits are tied to that account, may be used only by the account holder, and are not transferable.
          </li>
          <li>
            <strong>Activation:</strong> Your subscription is usually activated within a few seconds after payment. If it does not activate, please email <ContactEmail /> with your order number.
          </li>
          <li>
            <strong>Refunds:</strong> Please see our <Link to="/refund">Refund Policy</Link>. Once a full refund is approved or a chargeback is upheld, the subscription concerned ends and your access to paid content stops immediately.
          </li>
          <li>
            <strong>Violation of these Terms:</strong> If your account is terminated for violating these Terms, your subscription ends as well, and fees already paid are generally not refunded. This does not affect any rights you have under applicable law.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'license',
    title: 'License to use course content',
    body: (
      <>
        <p>
          The course videos, text, images, course structure, prompt examples, and other content on the Site ("Course Content") are licensed to you for <strong>personal learning</strong> purposes. Within that scope, you may:
        </p>
        <ul>
          <li>Watch and read the Course Content online.</li>
          <li>Copy prompts and code examples from the courses and use them in your own practice or projects.</li>
          <li>Quote small portions of the content within the scope of fair use under the Copyright Act, with attribution and a link to the Site.</li>
        </ul>
        <p>Without our prior written consent, you may not:</p>
        <ul>
          <li>Download, record, re-upload, or republish course videos or the Course Content as a whole.</li>
          <li>Sell or rent the Course Content, or use it for commercial purposes such as paid courses or teaching materials.</li>
          <li>Remove or alter copyright notices on the Course Content.</li>
        </ul>
        <p>You are welcome to freely share links to the Site or to specific course pages.</p>
      </>
    ),
  },
  {
    id: 'ai-tools',
    title: 'Using third-party AI tools',
    body: (
      <>
        <p>
          The courses teach you to use various third-party AI tools and services (for example, chatbots, AI coding tools, and AI agents). These tools are not provided by us, and we do not necessarily have any relationship with their providers. Please note:
        </p>
        <ul>
          <li>
            <strong>Your own accounts and costs:</strong> Using these tools is subject to each tool's own terms of service and privacy policy. You may need to sign up for your own accounts, and you may incur subscription or usage fees, which you are responsible for.
          </li>
          <li>
            <strong>Working on your own computer:</strong> You carry out the course exercises on your own computer and accounts, and you judge and bear the risks yourself. Some AI tools can read, modify, or delete files or run commands. Please <strong>back up important files</strong> first, and we recommend working in a dedicated practice folder.
          </li>
          <li>
            <strong>Review what the AI does:</strong> When an AI tool asks to run commands, modify files, or access external services, make sure you understand and confirm the action before allowing it. Do not approve operations you do not understand.
          </li>
          <li>
            <strong>Protect sensitive data:</strong> Do not paste passwords, API keys, personal data, or confidential company information into AI tools unless you understand how the tool will handle that data.
          </li>
        </ul>
        <Note>
          <p>
            The features, interfaces, prices, and terms of AI tools change quickly, so what you see may differ from the course videos. Please refer to each tool's latest official documentation.
          </p>
        </Note>
      </>
    ),
  },
  {
    id: 'accuracy',
    title: 'Accuracy of AI output and course content',
    body: (
      <>
        <p>
          Text, code, images, or suggestions generated by AI may be wrong, outdated, or incomplete, or may infringe the rights of others. Whether it is something you make with AI by following the courses or AI output demonstrated in the courses, please check and test it yourself before using it. When using it for real work or business, or for important decisions involving legal, financial, medical, or similar matters, you should also consult a qualified professional.
        </p>
        <p>
          We do our best to make the Course Content accurate and useful, but it is provided for learning reference only and does not constitute professional advice of any kind, and we cannot guarantee that it is entirely accurate or suitable for your situation. If you find a mistake, please let us know by email.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'Acceptable use',
    body: (
      <>
        <p>When using the Site, you must not:</p>
        <ul>
          <li>Attack, break into, or interfere with the normal operation of the Site or its servers, or attempt to access non-public parts of it.</li>
          <li>Use automated programs to scrape the Site's content in bulk, placing a burden on our servers, or to reproduce the Course Content.</li>
          <li>Use the Site in any way that violates the law or infringes the rights of others.</li>
          <li>Sign up or sign in under someone else's identity, or attempt to access accounts that do not belong to you.</li>
        </ul>
        <p>If you violate these rules, we may take necessary measures such as restricting connections or suspending or terminating accounts.</p>
      </>
    ),
  },
  {
    id: 'external',
    title: 'External links',
    body: (
      <p>
        The Site contains links to external websites. These external websites and services are provided and managed by third parties; their content, availability, and data handling are outside our control, and you should follow their respective terms and policies when using them. Providing a link does not mean we endorse it.
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    body: (
      <p>
        Copyright and other intellectual property rights in the Course Content belong to us or the original rights holders and are protected by the copyright laws of the Republic of China (Taiwan) and other applicable laws. The AI tools, product names, and trademarks mentioned on the Site belong to their respective owners and are mentioned for instructional purposes only. Rights in what you create using AI tools are determined by applicable law and the terms of each tool; we do not claim any rights in it.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Disclaimer and limitation of liability',
    body: (
      <>
        <p>
          The Site and the courses are provided "as is". To the extent permitted by law, we are not liable for damages arising from:
        </p>
        <ul>
          <li>Your use of third-party AI tools or services (including their fees, malfunctions, data loss, or the content they produce).</li>
          <li>
            Loss of files, system problems, or other damage caused when you follow the courses without backing up, without reviewing what the AI does, or based on your own judgment.
          </li>
          <li>Suspension or interruption of the Site, errors in or delayed updates to content, or external websites and services.</li>
        </ul>
        <p>
          However, this does not apply to damages caused by our intentional misconduct or gross negligence, or to liability that cannot be excluded or limited under the law (for example, mandatory provisions such as those of the Consumer Protection Act).
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Changes to and termination of the service',
    body: (
      <p>
        We may modify, suspend, or terminate all or part of the Site's services at any time. For significant changes or termination of the service, we will announce it on the Site in advance whenever possible; if termination affects accounts, we will also notify the account's email address in advance whenever possible and handle account data in accordance with our Privacy Policy. If we discontinue the paid service, we will stop renewals and refund the fees for the unused portion of the period on a pro-rata basis.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        We may revise these Terms of Service. The revised version will be posted on this page and the "Last updated" date at the top will be updated; for significant changes, we will post a prominent notice on the Site. By continuing to use the Site after the changes, you agree to the revised Terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        The interpretation and application of these Terms of Service, and any disputes arising from the Site, are governed by the laws of the Republic of China (Taiwan), except where the law provides otherwise by mandatory provisions (for example, rules on jurisdiction over consumer disputes).
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        If you have any questions about these Terms of Service, or find a mistake or possible infringement in the Course Content, please email us at <ContactEmail /> (operator: <Fill value={OPERATOR_NAME} />).
      </p>
    ),
  },
]

export function TermsEn() {
  const t = useT()
  return (
    <LegalDoc
      title={t.legal.termsTitle}
      updated={TERMS_UPDATED}
      intro="In short: the courses are for your personal learning, so please do not republish them or use them commercially. Paid subscriptions renew automatically and can be cancelled at any time; orders are handled by Paddle, and refund conditions are set out in our Refund Policy. Some lessons require you to sign in; your account is for your own use, so keep your password safe, and you can email us at any time to ask us to delete it. The AI tools used in the courses are provided by third parties, so work carefully on your own computer: back up first, make sure you understand an action before allowing it, and check what the AI produces yourself. The full terms follow below."
      sections={sections}
    />
  )
}
