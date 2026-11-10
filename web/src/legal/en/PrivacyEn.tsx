// English version (for reference; the Traditional Chinese version in ../zh/PrivacyZh.tsx prevails).
// When the policy changes, update both versions together.
import { Link } from 'react-router-dom'
import { ContactEmail, Ext, Fill, LegalDoc, Note, Table, type LegalSection } from '../LegalDoc'
import { OPERATOR_NAME } from '../operator'
import { PRIVACY_UPDATED } from '../updated'
import { useT } from '../../i18n/I18nProvider'

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: 'Scope and operator',
    body: (
      <>
        <p>
          This Privacy Policy applies to the evoleap.io website (the "Site"). It explains what data we process when you browse the Site or sign up for or sign in to an account, why we process it, who we share it with, how long we keep it, and the rights you have under the Personal Data Protection Act of Taiwan (the "PDPA").
        </p>
        <p>
          The Site is operated by <Fill value={OPERATOR_NAME} /> ("we" or "us"). This policy does not apply to third-party websites and services that the Site links to or embeds, such as Google accounts or the various AI tools; those services process data under their own privacy policies.
        </p>
      </>
    ),
  },
  {
    id: 'overview',
    title: 'Overview of the data we process',
    body: (
      <>
        <p>
          You do not need to sign up to browse public courses. Depending on the features you use, we process the following categories of data; details for each are in the sections below:
        </p>
        <ul>
          <li>
            <strong>Account data</strong> (only if you sign up or sign in): your email address, name, a hash of your password (not the password itself) or your Google account ID, and creation and update times.
          </li>
          <li>
            <strong>Playback progress</strong> (only when you are signed in): which lessons you have watched, the second you stopped at, the full length of the lesson, and when it was last updated.
          </li>
          <li>
            <strong>Guest lesson records</strong> (only when you are not signed in): which lesson, or the home page, demo page, course map, or sign-in page you opened (or which video on the demo page you played, which lesson's sign-in prompt you saw, and whether you successfully signed in or signed up on the sign-in page), when you opened it, how long it actually played that time, as well as your device type, which website you came from, whether the player loaded successfully, how long you stayed on the page, which buttons you clicked on the page, and which page you went to last. These records are distinguished only by a random guest ID (see "Guest lesson records") and do not include your name, email address, or similar data.
          </li>
          <li>
            <strong>Subscription records</strong> (only after you subscribe): subscription ID, plan, price ID, subscription status, start and end of the current period, cancellation time, and for each transaction, its ID and payment and refund times. Payment data is processed by Paddle, and we do not have access to your card number (see "Payment and subscription records").
          </li>
          <li>
            <strong>Sign-in status and guest ID</strong>: the <code>evoleap_session</code> cookie placed in your browser after you sign in; and the <code>evoleap_guest</code> cookie placed in your browser when you open a lesson or play a video on the demo page without signing in.
          </li>
          <li>
            <strong>Site usage statistics</strong>: data collected through Google Analytics 4, such as pages viewed, interaction events, device information, and approximate location.
          </li>
          <li>
            <strong>Server access logs</strong>: IP addresses, times, requested URLs, and similar information automatically recorded by our hosting service. The narration audio for the courses is stored on Google Cloud Storage (also located in Taiwan), and your browser downloads it directly from storage.googleapis.com during playback.
          </li>
          <li>
            <strong>Data collected by third-party services themselves</strong>: "Sign in with Google" is handled by Google under its own policies. Course videos are rendered directly by the Site and are not played through YouTube or other third-party video platforms.
          </li>
          <li>
            <strong>Advertising</strong> (only when you are signed in, not subscribed, and watching lessons after Lesson 0): ads are provided by Google AdSense, and Google collects related data itself (see "Advertising").
          </li>
        </ul>
        <p>The Site currently has no comment or registration forms.</p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Accounts',
    body: (
      <>
        <p>
          The Prologue of each course can be watched without signing in; other lessons require you to sign in (Lesson 0 is free once you are signed in, and later lessons require a subscription). Once you are signed in, we record your playback progress. There are two ways to sign up and sign in:
        </p>
        <h3>Signing up with an email address and password</h3>
        <ul>
          <li>
            We store your email address and name (you can enter a name yourself; if you don't, the part of your email address before the "@" is used by default).
          </li>
          <li>
            Your password is <strong>not stored in plain text</strong>. We keep only an irreversibly processed hash, which we use to check the password you enter when you sign in; no one on our side (including the Site's operations staff) can recover your password from the hash.
          </li>
        </ul>
        <h3>Signing in with a Google account</h3>
        <ul>
          <li>
            When you choose "Sign in with Google", Google provides us with a sign-in credential after you give consent. It includes your Google account ID (a fixed number that represents that Google account), your email address, whether that email address has been verified by Google, and your display name on Google.
          </li>
          <li>
            We store your Google account ID, email address, and name. Whether your email address is verified is used only to make a decision at the moment you sign in and is not stored separately: we create an account only if the email address has been verified by Google; if that email address was previously used to sign up with a password, we link this Google account to that same account.
          </li>
          <li>
            If your email address has already been used to sign up with a password, the first time you sign in with Google it will be linked to the same account, and your existing password will stop working. After that, please sign in with Google.
          </li>
          <li>We do not get your Google password, and we do not access your Gmail, Google Drive, contacts, or other Google data.</li>
          <li>
            The Google sign-in button on the sign-in page is provided by Google (Google Identity Services). Your browser connects directly to Google to load it, so Google may obtain your IP address and browser information and use its own cookies. This is handled under the{' '}
            <Ext href="https://policies.google.com/privacy?hl=en">Google Privacy Policy</Ext>.
          </li>
        </ul>
        <h3>Where account data is stored</h3>
        <p>
          Account data is stored in Google Cloud data centers located in Taiwan. Each account also has a randomly generated account ID, as well as creation and update times.
        </p>
        <h3>What we use account data for</h3>
        <ul>
          <li>To let you sign in, keep you signed in, record your playback progress, and record your subscription status on your account.</li>
          <li>To recognize that you are the same person, and to prevent duplicate sign-ups or others from using your email address.</li>
          <li>To respond to requests you make, such as requests for access, correction, or deletion.</li>
        </ul>
        <Note>
          <p>
            Your account holds only the data listed above, plus your subscription records once you subscribe (see "Payment and subscription records"). <strong>When you are signed in</strong>, we record your playback progress so that next time you can pick up where you left off; <strong>when you are not signed in, we do not store playback progress</strong> (we do not remember where you stopped), and any old progress previously left in your browser is also cleared; when you are not signed in, only "guest lesson records" are kept. Viewing while signed in is not recorded in guest records, and guest records are not merged into your account. Apart from this, we do not record any other viewing history, and we do not send your email address or account ID to Google Analytics. If we later want to record other learning data (for example, exercise completion), we will update this policy first.
          </p>
        </Note>
        <h3>Deleting your account</h3>
        <p>
          The Site does not yet have a "Delete account" button. To delete your account, please email <ContactEmail /> from the email address you signed up with, and once we confirm it is you, we will delete your account data (see "Retention" and "Your rights" for details).
        </p>
      </>
    ),
  },
  {
    id: 'guest',
    title: 'Guest lesson records',
    body: (
      <>
        <p>
          To understand whether people are watching the courses, how long they watch, and which lessons need improvement, when you are <strong>not signed in</strong> and open the home page, demo page, course map, a lesson, or the sign-in page, or play a video on the demo page, we record the following on our server:
        </p>
        <ul>
          <li>
            Which lesson you opened and when. Videos on the demo page are recorded only when you press play, and are recorded separately as "demo videos", apart from opening lessons.
          </li>
          <li>
            How long it actually played that time (paused time is not counted; updated roughly every 30 seconds during playback, and when you pause or leave the page).
          </li>
          <li>
            When you open a lesson that requires signing in and see the sign-in prompt, which page it was; when you open the home page, demo page, or course map, which page it was (to understand the paths visitors take after arriving at the home page).
          </li>
          <li>
            When you open the sign-in/sign-up page: which page on the Site you will return to after signing in; the error message shown on screen if signing in or signing up fails (for example, "Incorrect email or password" — we do not record the email address or password you enter); how long the Google sign-in button took to load, or why it failed to load; and whether you ultimately signed in or signed up successfully on that page, and by which method (email sign-in, email sign-up, or Google sign-in). Only the outcome is recorded, not which account.
          </li>
          <li>
            To find out why a lesson was opened but not played: your device type (phone, tablet, desktop, or an automated program such as a search engine; determined from the User-Agent sent by your browser, storing only the category, not the original content), which website you came from (storing only the domain, for example google.com, not the full URL or search terms), how long the player took to load or the error message if it failed to load, and how long the page was displayed in the foreground.
          </li>
          <li>
            The trail of this visit (up to 40 events): which button or link on the page you clicked (recording only the label on the button and the URL of links within the Site; <strong>we do not record any text you type</strong>), how far down the page you scrolled, switching to another tab and back, starting or pausing playback, and which page on the Site you finally moved to or closing the page, each with the number of seconds after opening.
          </li>
        </ul>
        <p>
          These records are distinguished only by a randomly generated guest ID, which is stored in the <code>evoleap_guest</code> cookie in your browser (HttpOnly, so JavaScript on web pages cannot read it). The records do not include your name, email address, or account, and are not sent to Google Analytics or any other third party; once you sign in, nothing more is recorded here, and earlier guest records are not merged into your account. Each record is kept for 180 days and then automatically deleted.
        </p>
        <p>
          If you do not want these records to be kept, you can block or delete the Site's <code>evoleap_guest</code> cookie in your browser (after deletion, a new ID is used and cannot be linked to earlier records; if cookies are blocked entirely, you appear as a new visitor every time you open a lesson), or watch while signed in. This does not affect your ability to watch free courses.
        </p>
      </>
    ),
  },
  {
    id: 'payment',
    title: 'Payment and subscription records',
    body: (
      <>
        <p>
          Orders for paid subscriptions are processed by Paddle.com. Paddle is the Merchant of Record and processes your payment data in accordance with the{' '}
          <Ext href="https://www.paddle.com/legal/privacy">Paddle Privacy Policy</Ext>.
        </p>
        <h3>Data processed by Paddle</h3>
        <p>
          The checkout window is provided by Paddle, and the information you enter in it (such as card number, cardholder name, email address, and country or region) is sent directly to Paddle. <strong>We do not obtain or store your full card number or security code.</strong> When you open the course plans page or check out, your browser connects to Paddle, so Paddle may obtain your IP address and browser information and use its own cookies. To enable automatic renewal, your payment method is stored by Paddle.
        </p>
        <h3>Data we provide to Paddle</h3>
        <p>
          When you open checkout, we give Paddle your account's email address and account ID, so that your email address can be pre-filled and, after payment is completed, the subscription is recorded on the correct account.
        </p>
        <h3>Data we keep</h3>
        <p>
          When a subscription starts, renews, has a failed payment, is cancelled, or a payment is completed or refunded, Paddle notifies our server. We keep the subscription ID, plan, price ID, subscription status, start and end of the current period, cancellation time, your account ID, and for each transaction, its ID and payment and refund times. We use these to grant and remove access to paid content, process refunds, and reconcile accounts.
        </p>
      </>
    ),
  },
  {
    id: 'analytics',
    title: 'Site usage statistics (Google Analytics)',
    body: (
      <>
        <p>
          To understand how many people use the Site, which courses and pages are helpful, and what needs improvement, we use Google Analytics 4 ("GA"), provided by Google. GA runs Google's code in your browser and sends the following data to Google:
        </p>
        <ul>
          <li>
            <strong>Pages viewed:</strong> URL path, page title, and referring page (Referer). Internal pages (proposals, documents, and asset pages) are not sent.
          </li>
          <li>
            <strong>Interaction events:</strong> for example, pressing the "Copy prompt" button (recording only which page it happened on, not the copied content); and events GA records automatically, such as first visit, session start, and engagement time. Depending on our settings in the GA admin, this may also include "enhanced measurement" events such as page scrolls and clicks on external links.
          </li>
          <li>
            <strong>Device information:</strong> device type, browser, operating system, screen resolution, and language setting.
          </li>
          <li>
            <strong>Approximate location:</strong> country, region, and city estimated by Google from your IP address. According to Google, GA4 does not log or store the IP address itself.
          </li>
          <li>
            <strong>Visitor identifier:</strong> a random number stored in the <code>_ga</code> cookie, used to tell "a returning visit from the same browser" apart from "a new visitor" (see "Cookies we use").
          </li>
        </ul>
        <p>
          We do <strong>not</strong> send your name, email address, account ID, or any account data to GA, and we do not use GA data for ad targeting. In GA we see only aggregated statistical reports and cannot use them to identify a specific person.
        </p>
        <p>
          Event data in GA associated with cookies and visitor identifiers is automatically deleted according to the retention period we set in the GA admin (2 months by default in GA4); aggregated statistical reports do not contain personally identifiable data and may be kept longer.
        </p>
        <h3>How to opt out of GA</h3>
        <ul>
          <li>
            Install the <Ext href="https://tools.google.com/dlpage/gaoptout?hl=en">Google Analytics Opt-out Browser Add-on</Ext> provided by Google.
          </li>
          <li>
            Block or delete the Site's cookies in your browser settings, or use a tracking-blocker extension. Opting out of GA does not affect your ability to browse courses or sign in.
          </li>
        </ul>
        <p>
          For how Google processes this data, please see{' '}
          <Ext href="https://policies.google.com/technologies/partner-sites?hl=en">How Google uses information from sites or apps that use our services</Ext>.
        </p>
      </>
    ),
  },
  {
    id: 'ads',
    title: 'Advertising',
    body: (
      <>
        <p>
          The Prologue and Lesson 0 of each course have no ads, and subscribers do not see ads either. Other lessons (except the kids’ web programming course) show Google AdSense ads, labeled as "Ad", to users who are signed in but not subscribed. Only these pages connect to AdSense.
        </p>
        <p>
          Pages of the kids’ web programming course never show ads and do not connect to AdSense.
        </p>
        <p>
          Users who choose the “Ad plan” see a short ad before each lesson of a subscription course. To confirm the ad has finished playing, the server only records which lesson’s ad you finished in a short-lived cookie in your browser, which expires after 30 minutes; no separate viewing record is kept.
        </p>
        <p>
          Third-party vendors, including Google, use cookies (such as the DoubleClick cookie) to serve ads based on your previous visits to the Site or other websites, and to count ad impressions and clicks; your browser connects directly to Google, so Google may obtain your IP address, device information, and the URL you are viewing. We do <strong>not</strong> send your name, email address, or account ID to advertising services.
        </p>
        <p>
          You can turn off personalized ads in <Ext href="https://adssettings.google.com/?hl=en">Google Ad Settings</Ext>, or manage third-party vendors' personalized advertising cookies at <Ext href="https://www.aboutads.info/choices/">aboutads.info</Ext>. For how Google uses this data, please see{' '}
          <Ext href="https://policies.google.com/technologies/ads?hl=en">How Google uses cookies in advertising</Ext>.
        </p>
      </>
    ),
  },
  {
    id: 'logs',
    title: 'Server access logs',
    body: (
      <>
        <p>
          The Site is hosted on Google Cloud Run. As with most websites, each time your browser requests a page or file from the Site, the hosting service automatically records an access log entry, which usually includes:
        </p>
        <ul>
          <li>Your IP address</li>
          <li>The time, URL, and response status of the request</li>
          <li>Browser and operating system information (User-Agent)</li>
          <li>The referring page (Referer, if provided by your browser)</li>
        </ul>
        <p>
          These logs are used to keep the Site running properly, troubleshoot errors, and prevent abuse and attacks. Because an IP address may in some cases indirectly identify an individual, we treat it as personal data. Logs are kept for the hosting service's default retention period and then automatically deleted. We do not use them to build a personal browsing profile of you, except to handle security incidents or to cooperate with investigations as required by law, and we do not match them against account data.
        </p>
      </>
    ),
  },
  {
    id: 'clipboard',
    title: '"Copy" buttons and the clipboard',
    body: (
      <p>
        Buttons such as "Copy prompt" on lesson pages simply write text from the page to your computer's clipboard within your browser, and the whole process takes place on your device. We do not read what is already in your clipboard, and we do not send the text you copy back to our server; GA only records the fact that "the copy button was pressed on a certain page" (see "Site usage statistics").
      </p>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies we use',
    body: (
      <>
        <p>Cookies are small text files that a website stores in your browser. The Site uses the following cookies:</p>
        <Table
          head={['Name', 'Set by', 'Purpose', 'Duration']}
          rows={[
            [
              <code>evoleap_session</code>,
              'The Site',
              'Sign-in status. It contains a token signed by us proving that you are signed in, and cannot be read by JavaScript on web pages (HttpOnly). It is set only after you sign in.',
              '30 days from sign-in; cleared immediately when you sign out',
            ],
            [
              <code>evoleap_guest</code>,
              'The Site',
              'Set only when you open a lesson without signing in. It contains a random guest ID used to link lesson records from the same browser together (see "Guest lesson records"); it cannot be read by JavaScript on web pages (HttpOnly).',
              '180 days',
            ],
            [
              <code>_ga</code>,
              'The Site, via Google Analytics',
              'Distinguishes different visitors (browsers) by a random number.',
              '2 years',
            ],
            [
              <>
                <code>_ga_&lt;ID&gt;</code>
              </>,
              'The Site, via Google Analytics',
              'Stores session state (for example, when the current visit started). <ID> is the ID of the Site\'s GA property.',
              '2 years',
            ],
            [
              'Determined by Paddle',
              'Paddle (third party)',
              'Operation of the course plans page and checkout window, fraud prevention, and Paddle\'s own purposes.',
              'Set by Paddle; see the Paddle Privacy Policy',
            ],
            [
              'Determined by Google',
              'Google (third party)',
              'The "Sign in with Google" button, and Google\'s own purposes.',
              'Set by Google; see Google\'s cookie information',
            ],
            [
              'Determined by Google and third-party vendors',
              'Google and third-party ad vendors',
              'Serving ads, personalized ads, and counting ad impressions and clicks. Set only on pages where you see ads (see "Advertising").',
              'Set by each vendor; see How Google uses cookies in advertising',
            ],
          ]}
        />
        <p>
          <code>evoleap_session</code> is required for signing in, and you cannot sign in if you block it; <code>evoleap_guest</code> is used only to collect statistics on how guests use the lessons, and blocking or deleting it does not affect watching lessons; <code>_ga</code> and <code>_ga_&lt;ID&gt;</code> are used only for statistics, and blocking or deleting them does not affect the Site's functionality. You can view, delete, or block cookies at any time in your browser settings.
        </p>
      </>
    ),
  },
  {
    id: 'purpose',
    title: 'Purposes, period, region, and recipients of collection',
    body: (
      <>
        <p>As required by Article 8 of the PDPA, we explain the following:</p>
        <ul>
          <li>
            <strong>Purposes of collection:</strong> providing the Site and course services; member account management and sign-in authentication; activating, renewing, cancelling, and processing refunds for paid subscriptions; statistical analysis of Site usage and service improvement; Site operations and information security management; and responding to your requests.
          </li>
          <li>
            <strong>Categories of data:</strong> account data (email address, name, password hash, Google account ID); subscription records (subscription ID, plan, price ID, subscription status, start and end of the current period, cancellation time, and transaction IDs and payment and refund times); guest lesson records (random guest ID, lessons opened and when, playback time, device type, referring domain, player load result, time on page, and browsing trail); sign-in and guest cookies; GA statistics (pages viewed, interaction events, device information, approximate location, visitor identifier); and server access logs (IP address, time, requested URL, User-Agent, Referer, etc.).
          </li>
          <li>
            <strong>Period of use:</strong> see the next section, "Retention".
          </li>
          <li>
            <strong>Region of use:</strong> Account data is stored in Google Cloud data centers located in Taiwan. Server access logs and GA data are processed by Google and may be stored or processed in Google data centers outside Taiwan. Paddle is located outside Taiwan; the information you provide at checkout, and the email address and account ID we give to Paddle, are transferred outside Taiwan for processing.
          </li>
          <li>
            <strong>Recipients:</strong> us; Google, which processes data on our behalf (Google Cloud hosting of the Site and database, Google Analytics statistics, and Google account sign-in); Paddle, which processes orders and payments; Google and third-party vendors that provide ads (provided directly by your browser; see "Advertising"); and, where required by law, authorities legally entitled to access the data.
          </li>
          <li>
            <strong>Method of use:</strong> collected, stored, and processed by automated systems; statistics are viewed as aggregated reports; account data and access logs are reviewed by us during operations, troubleshooting, or when handling your requests.
          </li>
        </ul>
        <p>
          You are free to choose whether to sign up for an account. Without signing up, you can still watch the Prologue of each course, but you cannot watch other lessons, and your playback progress is not recorded (guest lesson records are still kept, which you can opt out of as described in "Guest lesson records"); subscribing requires an account. Server access logs are generated automatically when the Site operates, and you can opt out of GA as described above.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Retention',
    body: (
      <ul>
        <li>
          <strong>Account data:</strong> kept for as long as your account exists. After you request deletion and it is confirmed, we will delete it within a reasonable period; our goal is to complete deletion within 30 days. Any copies remaining in database backups will be phased out as the backups expire. Data that must be retained under the law, or to handle disputes or security incidents, will be retained for the necessary period, and we will explain this to you at that time.
        </li>
        <li>
          <strong>Subscription records:</strong> kept for as long as your account exists, and also retained after cancellation or a refund. After your account is deleted, subscription and transaction IDs, plans, and times will still be retained for the necessary period to handle refunds, disputes, and reconciliation. Data held by Paddle is handled under the Paddle Privacy Policy.
        </li>
        <li>
          <strong>Sign-in cookie:</strong> stored in your browser for up to 30 days and cleared when you sign out.
        </li>
        <li>
          <strong>Guest lesson records and guest cookie:</strong> each record is kept for 180 days from when the lesson was opened and then automatically deleted; the <code>evoleap_guest</code> cookie lasts up to 180 days.
        </li>
        <li>
          <strong>GA data:</strong> automatically deleted according to the retention period set in the GA admin (2 months by default in GA4); aggregated statistical reports that contain no personal data may be kept longer.
        </li>
        <li>
          <strong>Server access logs:</strong> automatically deleted according to the hosting service's default retention period; where a security incident or legal proceeding is involved, they may be retained for the period needed to handle it.
        </li>
      </ul>
    ),
  },
  {
    id: 'sharing',
    title: 'We do not sell your data',
    body: (
      <p>
        We do not sell, rent, or trade your personal data, and we do not provide it to third parties for marketing purposes. Apart from Google, which processes data on our behalf as described above (Google Cloud, Google Analytics, and Google account sign-in), Paddle, which processes orders, and cases where it is required by law or necessary to protect the safety of the Site and its users, we do not provide your data to others. When ads are shown, your browser connects directly to Google and third-party vendors (see "Advertising"), and we do not give them your account data.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Data security',
    body: (
      <>
        <p>We take the following measures to protect your data:</p>
        <ul>
          <li>The Site uses encrypted HTTPS connections throughout, so the email address and password you enter are encrypted in transit.</li>
          <li>Passwords are stored only as irreversibly processed hashes; the original passwords are not stored.</li>
          <li>Full card numbers and security codes are processed by Paddle and never pass through or are stored on our servers.</li>
          <li>
            The sign-in cookie is set to HttpOnly, so JavaScript on web pages cannot read it, reducing the risk of theft by malicious code; it is sent only to the Site.
          </li>
          <li>Access to the database and access logs is limited to the Site's operations staff.</li>
        </ul>
        <p>
          Even so, no transmission or storage over the internet can be guaranteed to be 100% secure. Please set a password for the Site that you do not use anywhere else; if you believe your account has been compromised, please email us as soon as possible. If a data breach occurs that may affect your rights, we will notify you as required by the PDPA.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under Article 3 of the PDPA, you may exercise the following rights regarding the personal data we hold about you:</p>
        <ol>
          <li>To inquire about or review your data</li>
          <li>To request a copy of your data</li>
          <li>To request that your data be supplemented or corrected</li>
          <li>To request that we stop collecting, processing, or using your data</li>
          <li>To request deletion of your data</li>
        </ol>
        <p>
          Please send your request by email to <ContactEmail />. For account data, please send it from the email address you signed up with, or state that email address in your message, and we will look up your account by that email address. To avoid giving your data to someone else, we may need to reasonably confirm that you are the account holder (for example, by asking you to reply from that email address).
        </p>
        <p>For payment data held by Paddle, please contact Paddle in accordance with the Paddle Privacy Policy; we can also help pass on your request.</p>
        <p>
          Server access logs are not linked to accounts. If you want to make a request about them, please also provide the IP address you used and the approximate time of your visit. Guest lesson records are recorded only under a random guest ID stored in an HttpOnly cookie, which neither you nor we can usually see from the page, so it is generally not possible to confirm which records are yours; you can clear the <code>evoleap_guest</code> cookie in your browser so that future records are no longer linked to earlier ones. GA data is recorded only under a random visitor identifier, and we usually cannot tell which data is yours; you can opt out of GA as described in "Site usage statistics", or clear the <code>_ga</code> cookie in your browser.
        </p>
        <p>
          We will respond within the time limits set by the PDPA (generally within 15 days for inquiries, review, or copies, and within 30 days for correction, deletion, or stopping use; where necessary, these may be extended as permitted by law, and we will tell you why). We may be unable to delete data that must be retained under the law or to fulfill legal obligations, and we will explain this to you at that time.
        </p>
      </>
    ),
  },
  {
    id: 'minors',
    title: 'Children and minors',
    body: (
      <p>
        The courses on the Site are intended for general adult learners. The kids’ web programming course is designed for children around 9 years old; its content is written for parents to read and accompany their child, and we recommend that a parent or legal guardian use it together with the child. Pages of this course have no ads and do not connect to Google AdSense. We do not knowingly collect personal data such as names, email addresses, or contact details from children, and we do not ask children to create their own accounts. We recommend that minors use the Site and the AI tools introduced in the courses with the supervision or consent of a parent or legal guardian, and pay attention to each AI tool's own age restrictions. If you are a parent or legal guardian and believe we hold personal data about your child, please contact us and we will help, including by deleting the account.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may revise this policy because of changes to Site features or to the law. The revised version will be posted on this page and the "Last updated" date at the top will be updated. If a change involves collecting new personal data (for example, starting to record learning progress) or changing the purposes of use, we will post a prominent notice on the Site before the change takes effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        If you have any questions, complaints, or requests about this policy or your personal data (including deleting your account), please email us at <ContactEmail /> (operator: <Fill value={OPERATOR_NAME} />). For the rules on using the Site, please see our <Link to="/terms">Terms of Service</Link>.
      </p>
    ),
  },
]

export function PrivacyEn() {
  const t = useT()
  return (
    <LegalDoc
      title={t.legal.privacyTitle}
      updated={PRIVACY_UPDATED}
      intro="In short: you can watch the Prologue of each course without signing up; other lessons require you to sign in (lessons after Lesson 0 require a subscription). If you sign up or sign in, we keep your email address, name, and either a hash of your password (not the password itself) or your Google account ID. This data is stored in Google Cloud's data centers in Taiwan, and we use a cookie to remember that you are signed in. If you open a lesson without signing in, we use a random guest ID (a cookie) to record which lesson you opened, how long it played, your device type, and which website you came from, and we keep this for 180 days. We use Google Analytics to measure how the Site is used, but we do not send it your email address or account; the Google sign-in button is handled by Google under its own policies; and payments for paid subscriptions are processed by Paddle, so we never see your full card number. We do not sell your data, and you can email us at any time to ask to access, correct, or delete it. The full policy follows below."
      sections={sections}
    />
  )
}
