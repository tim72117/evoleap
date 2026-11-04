import { Link } from 'react-router-dom'
import { ContactEmail, Ext, Fill, LegalDoc, Note, Table, type LegalSection } from './LegalDoc'
import { OPERATOR_NAME } from './operator'

/** 最後更新日期;內容有實質變更時一併更新 */
const PRIVACY_UPDATED = '2026-11-04'

// 本政策描述的是網站「目前」的實際狀況:Email/密碼與 Google 登入(帳號存在 Cloud SQL)、
// 登入 cookie evoleap_session、Google Analytics 4(僅正式環境且有設定評估 ID 時)、
// 伺服器存取記錄(課程影片是網站自己即時畫出的教學畫面,不嵌入 YouTube 等第三方播放器)。新增任何蒐集資料的功能(例如練習完成狀態、表單、付費)前,
// 必須先更新本頁。對應程式:server/internal/api/auth.go、server/internal/api/progress.go、server/internal/store/users.go、server/internal/store/progress.go、
// web/src/site/analytics.ts。

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: '適用範圍與營運者',
    body: (
      <>
        <p>
          本隱私權政策適用於 evoleap.io 網站（以下稱「本網站」），說明您瀏覽本網站或註冊、登入帳號時，我們會處理哪些資料、為什麼處理、交給誰、保存多久，以及您依《個人資料保護法》（以下稱「個資法」）享有的權利。
        </p>
        <p>
          本網站由 <Fill value={OPERATOR_NAME} />（以下稱「我們」）營運。本政策不適用於本網站連結或嵌入的第三方網站與服務，例如 Google 帳號或各家 AI 工具，這些服務依其各自的隱私權政策處理資料。
        </p>
      </>
    ),
  },
  {
    id: 'overview',
    title: '我們處理的資料一覽',
    body: (
      <>
        <p>瀏覽公開課程不需要註冊。依您使用的功能，我們會處理以下幾類資料，各類的細節見後面各節：</p>
        <ul>
          <li>
            <strong>帳號資料</strong>（只有註冊或登入時才有）：Email、名稱、密碼的雜湊值（不是密碼本身）或 Google 帳號 ID、建立與更新時間。
          </li>
          <li>
            <strong>播放進度</strong>（只有登入後才有）：您看過哪幾課的教學畫面、停在第幾秒、該課全長與最後更新時間。
          </li>
          <li>
            <strong>登入狀態</strong>：登入後放在您瀏覽器裡的 <code>evoleap_session</code> cookie。
          </li>
          <li>
            <strong>網站使用統計</strong>：透過 Google Analytics 4 蒐集的瀏覽頁面、互動事件、裝置與大略地區等資料。
          </li>
          <li>
            <strong>伺服器存取記錄</strong>：代管服務自動留下的 IP 位址、時間、請求網址等。課程的旁白音檔放在 Google Cloud Storage（同樣位於臺灣），播放時您的瀏覽器會直接向 storage.googleapis.com 下載。
          </li>
          <li>
            <strong>第三方服務自行蒐集的資料</strong>：「使用 Google 帳號登入」由 Google 依其政策處理。課程影片由本網站直接產生畫面，不透過 YouTube 等第三方影音平台播放。
          </li>
        </ul>
        <p>本網站目前沒有付費功能、留言或報名表單，也沒有放置廣告或廣告追蹤像素。</p>
      </>
    ),
  },
  {
    id: 'account',
    title: '帳號',
    body: (
      <>
        <p>
          部分課程（例如「Vibe Coding 入門」）是「登入後免費」觀看，因此您可以建立帳號。註冊與登入有兩種方式：
        </p>
        <h3>以 Email 與密碼註冊</h3>
        <ul>
          <li>我們會儲存您的 Email 與名稱（名稱可自行填寫；未填寫時，預設使用 Email 中「@」前面的部分）。</li>
          <li>
            您的密碼<strong>不會以原文儲存</strong>。我們只保存經過不可逆處理的雜湊值，登入時用它比對您輸入的密碼；我們（包括網站維運人員）都無法從雜湊值還原出您的密碼。
          </li>
        </ul>
        <h3>使用 Google 帳號登入</h3>
        <ul>
          <li>
            您選擇「使用 Google 帳號登入」時，Google 會在您同意後提供一份登入憑證給我們，其中包括：您的 Google 帳號 ID（一組代表該 Google 帳號的固定編號）、Email、該 Email 是否已經過 Google 驗證，以及您在 Google 上的顯示名稱。
          </li>
          <li>
            我們會儲存 Google 帳號 ID、Email 與名稱。「Email 是否已驗證」只在登入當下用來判斷，不會另外儲存：只有 Email 已經過 Google 驗證時，我們才會建立帳號；若該 Email 先前已用密碼註冊過，會把這個 Google 帳號連結到同一個帳號上。
          </li>
          <li>如果您的 Email 已經用密碼註冊過，第一次用 Google 登入時會綁定到同一個帳號，原本的密碼隨之失效，之後請用 Google 登入。</li>
          <li>我們不會取得您的 Google 密碼，也不會存取您的 Gmail、雲端硬碟、聯絡人等其他 Google 資料。</li>
          <li>
            登入頁的 Google 登入按鈕由 Google 提供（Google Identity Services），您的瀏覽器會直接連線到 Google 載入它，Google 可能因此取得您的 IP 位址、瀏覽器資訊，並使用它自己的 cookie，這部分依{' '}
            <Ext href="https://policies.google.com/privacy?hl=zh-TW">Google 隱私權政策</Ext>處理。
          </li>
        </ul>
        <h3>帳號資料存放在哪裡</h3>
        <p>
          帳號資料存放在 Google Cloud 位於臺灣的資料中心。每個帳號另有一組隨機產生的帳號編號，以及建立、更新時間。
        </p>
        <h3>我們用帳號資料做什麼</h3>
        <ul>
          <li>讓您登入、維持登入狀態，並開放需要登入的課程。</li>
          <li>辨識是同一個人，避免重複註冊或他人冒用您的 Email。</li>
          <li>回覆您主動提出的查詢、更正、刪除等請求。</li>
        </ul>
        <Note>
          <p>
            帳號只保存上面列出的資料。<strong>登入後</strong>，我們會記錄您的播放進度，讓您下次從上次看到的地方接著看；<strong>未登入時不會儲存任何播放進度</strong>，先前留在瀏覽器裡的舊進度也會被清除。除此之外沒有記錄其他觀看紀錄，也不會把您的 Email 或帳號編號傳給 Google Analytics。日後若要記錄其他學習資料（例如練習完成狀態），會先更新本政策說明。
          </p>
        </Note>
        <h3>刪除帳號</h3>
        <p>
          網站目前還沒有「刪除帳號」的按鈕。如需刪除帳號，請用您註冊時的 Email 來信 <ContactEmail /> 提出，我們確認是本人後會刪除您的帳號資料（詳見「保存期間」與「您的權利」）。
        </p>
      </>
    ),
  },
  {
    id: 'analytics',
    title: '網站使用統計（Google Analytics）',
    body: (
      <>
        <p>
          為了解有多少人使用本網站、哪些課程與頁面有幫助、哪裡需要改進，我們使用 Google 提供的 Google Analytics 4（以下稱「GA」）。GA 會在您的瀏覽器執行 Google 的程式碼，並把下列資料傳送給 Google：
        </p>
        <ul>
          <li>
            <strong>瀏覽的頁面：</strong>網址路徑、頁面標題、來源網頁（Referer）。內部用的頁面（提案、文件、素材頁）不會送出。
          </li>
          <li>
            <strong>互動事件：</strong>例如按下「複製提示詞」按鈕（只記錄發生在哪一頁，不包含複製的內容）；以及 GA 自動記錄的事件，例如第一次造訪、工作階段開始、停留與互動時間。依我們在 GA 後台的設定，也可能包括捲動頁面、點擊外部連結等「加強型評估」事件。
          </li>
          <li>
            <strong>裝置資訊：</strong>裝置類型、瀏覽器、作業系統、螢幕解析度、語言設定。
          </li>
          <li>
            <strong>大略地區：</strong>由 Google 依您的 IP 位址推估的國家、地區與城市。依 Google 說明，GA4 不會記錄或儲存 IP 位址本身。
          </li>
          <li>
            <strong>訪客識別碼：</strong>存在 <code>_ga</code> cookie 中的隨機編號，用來區分「同一個瀏覽器的再次造訪」與「新的訪客」（見「Cookie 一覽」）。
          </li>
        </ul>
        <p>
          我們<strong>不會</strong>把您的姓名、Email、帳號編號或任何帳號資料傳給 GA，本網站沒有廣告，我們也不把 GA 資料用於廣告投放。我們在 GA 中只看到彙整後的統計報表，無法用它認出特定的人。
        </p>
        <p>
          GA 中與 cookie、訪客識別碼相關的事件資料，依我們在 GA 後台設定的保存期限自動刪除（GA4 預設為 2 個月）；彙整後的統計報表不含可識別個人的資料，可能保存較久。
        </p>
        <h3>如何拒絕 GA</h3>
        <ul>
          <li>
            安裝 Google 提供的 <Ext href="https://tools.google.com/dlpage/gaoptout?hl=zh-TW">Google Analytics 選擇停用瀏覽器外掛程式</Ext>。
          </li>
          <li>在瀏覽器設定中封鎖或刪除本網站的 cookie，或使用阻擋追蹤的擴充功能。拒絕 GA 不會影響您瀏覽課程或登入。</li>
        </ul>
        <p>
          Google 如何處理這些資料，請參考{' '}
          <Ext href="https://policies.google.com/technologies/partner-sites?hl=zh-TW">Google 如何使用採用其服務的網站或應用程式中的資訊</Ext>。
        </p>
      </>
    ),
  },
  {
    id: 'logs',
    title: '伺服器存取記錄',
    body: (
      <>
        <p>
          本網站架設在 Google Cloud Run 上。和大多數網站一樣，您的瀏覽器每次向本網站請求網頁或檔案時，代管服務會自動留下一筆存取記錄，內容通常包括：
        </p>
        <ul>
          <li>您的 IP 位址</li>
          <li>請求的時間、網址與回應狀態</li>
          <li>瀏覽器與作業系統資訊（User-Agent）</li>
          <li>來源網頁（Referer，若瀏覽器有提供）</li>
        </ul>
        <p>
          這些記錄用於維持網站正常運作、排查錯誤、防範濫用與攻擊。IP 位址在某些情況下可能間接識別到個人，因此我們把它當作個人資料看待。記錄採用代管服務預設的保存期限，屆期後自動刪除；我們不會用它來建立您的個人瀏覽檔案，除非是為了處理資安事件或依法配合調查，也不會將它與帳號資料比對。
        </p>
      </>
    ),
  },
  {
    id: 'clipboard',
    title: '「複製」按鈕與剪貼簿',
    body: (
      <p>
        課程頁上的「複製提示詞」等按鈕，只是在您的瀏覽器裡把頁面上的文字寫入您電腦的剪貼簿，整個過程在您的裝置上完成。我們不會讀取您剪貼簿裡原有的內容，也不會把您複製的文字傳回伺服器；GA 只會記錄「在哪一頁按了複製」這件事（見「網站使用統計」）。
      </p>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookie 一覽',
    body: (
      <>
        <p>
          Cookie 是網站存放在您瀏覽器中的小型文字檔。本網站使用的 cookie 如下：
        </p>
        <Table
          head={['名稱', '設定者', '用途', '有效期限']}
          rows={[
            [
              <code>evoleap_session</code>,
              '本網站',
              '登入狀態。內容是一組經我們簽章、證明您已登入的權杖，網頁上的 JavaScript 無法讀取（HttpOnly）。只有登入後才會設定。',
              '登入起 30 天；登出時立即清除',
            ],
            [
              <code>_ga</code>,
              '本網站，透過 Google Analytics',
              '以隨機編號區分不同的訪客（瀏覽器）。',
              '2 年',
            ],
            [
              <>
                <code>_ga_&lt;ID&gt;</code>
              </>,
              '本網站，透過 Google Analytics',
              '保存工作階段狀態（例如本次造訪何時開始）。其中 <ID> 是本網站 GA 資源的編號。',
              '2 年',
            ],
            [
              '由 Google 決定',
              'Google（第三方）',
              '「使用 Google 帳號登入」按鈕，以及 Google 自己的用途。',
              '依 Google 的設定，詳見 Google 的 cookie 說明',
            ],
          ]}
        />
        <p>
          <code>evoleap_session</code> 是登入所必需的，封鎖它就無法登入；<code>_ga</code> 與 <code>_ga_&lt;ID&gt;</code> 只用於統計，封鎖或刪除不影響網站功能。您可以在瀏覽器設定中隨時查看、刪除或封鎖 cookie。
        </p>
      </>
    ),
  },
  {
    id: 'purpose',
    title: '蒐集目的、期間、地區與對象',
    body: (
      <>
        <p>依個資法第 8 條，說明如下：</p>
        <ul>
          <li>
            <strong>蒐集目的：</strong>提供網站與課程服務、會員帳號管理與登入驗證、網站使用情形的統計分析與服務改善、網站維運與資訊安全管理、回應您的請求。
          </li>
          <li>
            <strong>資料類別：</strong>帳號資料（Email、名稱、密碼雜湊值、Google 帳號 ID）；登入 cookie；GA 統計資料（瀏覽頁面、互動事件、裝置資訊、大略地區、訪客識別碼）；伺服器存取記錄（IP 位址、時間、請求網址、User-Agent、Referer 等）。
          </li>
          <li>
            <strong>利用期間：</strong>見下一節「保存期間」。
          </li>
          <li>
            <strong>利用地區：</strong>帳號資料存放於 Google Cloud 位於臺灣的資料中心。伺服器存取記錄與 GA 資料由 Google 處理，可能存放或處理於臺灣境外的 Google 資料中心。
          </li>
          <li>
            <strong>利用對象：</strong>我們；受我們委託處理資料的 Google（Google Cloud 代管網站與資料庫、Google Analytics 統計、Google 帳號登入）；另於法律要求時，提供給依法有權調閱的機關。
          </li>
          <li>
            <strong>利用方式：</strong>以自動化系統蒐集、儲存與處理；統計資料以彙整報表方式查看；帳號資料與存取記錄於維運、排查問題或處理您的請求時由我們查閱。
          </li>
        </ul>
        <p>
          您可以自由選擇是否註冊帳號；不註冊仍可觀看公開課程，但無法觀看需要登入的課程。伺服器存取記錄是網站運作時自動產生的，GA 則可依前述方式拒絕。
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: '保存期間',
    body: (
      <ul>
        <li>
          <strong>帳號資料：</strong>在您的帳號存在期間保存。您提出刪除請求並經確認後，我們會在合理期間內刪除；我們的目標是在 30 日內完成。若資料庫備份中仍有副本，會隨備份到期而淘汰。依法律規定或為處理爭議、資安事件而必須保留的資料，會在必要期間內保留，屆時會向您說明。
        </li>
        <li>
          <strong>登入 cookie：</strong>存在您的瀏覽器中，最長 30 天，登出時清除。
        </li>
        <li>
          <strong>GA 資料：</strong>依 GA 後台設定的保存期限（GA4 預設 2 個月）自動刪除；彙整後不含個人資料的統計報表可能保存較久。
        </li>
        <li>
          <strong>伺服器存取記錄：</strong>依代管服務的預設保存期限自動刪除；如涉及資安事件或法律程序，得於處理所需期間內保留。
        </li>
      </ul>
    ),
  },
  {
    id: 'sharing',
    title: '不出售您的資料',
    body: (
      <p>
        我們不會出售、出租或交換您的個人資料，也不會將其提供給第三方做行銷用途。除了上面提到受託處理資料的 Google（Google Cloud、Google Analytics、Google 帳號登入），以及法律要求或為保護本網站與使用者安全所必要的情形外，我們不會將資料提供給他人。
      </p>
    ),
  },
  {
    id: 'security',
    title: '資料安全',
    body: (
      <>
        <p>我們採取以下措施保護您的資料：</p>
        <ul>
          <li>本網站全程使用 HTTPS 加密連線，您輸入的 Email 與密碼在傳輸過程中會被加密。</li>
          <li>密碼只以經過不可逆處理的雜湊值保存，不保存密碼原文。</li>
          <li>
            登入 cookie 設為 HttpOnly，網頁上的 JavaScript 無法讀取，降低被惡意程式竊取的風險；它只會傳送給本網站。
          </li>
          <li>資料庫與存取記錄的存取權限僅限於網站維運人員。</li>
        </ul>
        <p>
          即使如此，網路傳輸與儲存無法保證百分之百安全。請為本網站設定一組不在其他地方使用的密碼；若您認為帳號遭到盜用，請盡快來信通知我們。若發生可能影響您權益的資料外洩事件，我們會依個資法規定通知您。
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '您的權利',
    body: (
      <>
        <p>依個資法第 3 條，您對我們保有的您的個人資料，可以行使以下權利：</p>
        <ol>
          <li>查詢或請求閱覽</li>
          <li>請求製給複製本</li>
          <li>請求補充或更正</li>
          <li>請求停止蒐集、處理或利用</li>
          <li>請求刪除</li>
        </ol>
        <p>
          請來信 <ContactEmail /> 提出申請。若是關於帳號資料，請用您註冊時的 Email 寄出，或在信中註明該 Email，我們會依 Email 查找您的帳號；為避免把資料交給他人，我們可能需要合理確認您是帳號本人（例如請您從該 Email 回信）。
        </p>
        <p>
          伺服器存取記錄並未與帳號連結，若要查詢這部分，請一併提供您當時使用的 IP 位址與大約的瀏覽時間。GA 資料只以隨機的訪客識別碼記錄，我們通常無法辨認哪些屬於您；您可以依「網站使用統計」一節的方式拒絕 GA，或清除瀏覽器的 <code>_ga</code> cookie。
        </p>
        <p>
          我們會依個資法規定的期限回覆（查詢、閱覽或複製本原則上 15 日內，更正、刪除、停止利用原則上 30 日內；必要時得依法延長並告知原因）。依法律規定或為履行法定義務而必須保留的資料，我們可能無法刪除，屆時會向您說明。
        </p>
      </>
    ),
  },
  {
    id: 'minors',
    title: '兒童與未成年人',
    body: (
      <p>
        本網站的課程以一般成人學習者為對象，並非專為兒童設計，我們不會刻意蒐集兒童的個人資料。未成年人註冊帳號、使用本網站及課程中介紹的 AI 工具時，建議在法定代理人陪同或同意下進行，並留意各 AI 工具自身的年齡限制。若您是家長或法定代理人，認為我們保有您孩子的個人資料，請與我們聯絡，我們會協助處理，包括刪除帳號。
      </p>
    ),
  },
  {
    id: 'changes',
    title: '政策變更',
    body: (
      <p>
        我們可能因網站功能調整或法令變更而修改本政策，修改後的版本會公布在本頁，並更新頁首的「最後更新日期」。若變更涉及蒐集新的個人資料（例如開始記錄學習進度）或改變使用目的，我們會在變更生效前於網站上明顯公告。
      </p>
    ),
  },
  {
    id: 'contact',
    title: '聯絡我們',
    body: (
      <p>
        對本政策或您的個人資料有任何疑問、申訴或請求（包括刪除帳號），請來信 <ContactEmail />（營運者：<Fill value={OPERATOR_NAME} />）。網站使用規則請見<Link to="/terms">服務條款</Link>。
      </p>
    ),
  },
]

export function PrivacyPage() {
  return (
    <LegalDoc
      title="隱私權政策"
      updated={PRIVACY_UPDATED}
      intro="簡單說：看公開課程不必註冊。若您註冊或登入，我們會保存 Email、名稱，以及密碼的雜湊值（不是密碼本身）或 Google 帳號 ID，資料存放在 Google Cloud 的臺灣機房，並用一個 cookie 記住您的登入狀態。我們用 Google Analytics 統計網站使用情形，但不會把您的 Email 或帳號傳給它；Google 登入按鈕則由 Google 依其政策處理。我們不出售您的資料，您可以隨時來信要求查詢、更正或刪除。以下是完整說明。"
      sections={sections}
    />
  )
}
