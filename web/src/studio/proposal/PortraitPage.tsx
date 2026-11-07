import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Aspect } from '../../live/types'
import { PromoPlayer } from '../materials/PromoPage'
import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 開發中:直式(9:16)舞台。2026-11-07 整理自 live/README.md 的「直式舞台(原型)」一節與 CHANGELOG 0.13 前後的已知缺口。
// 舞台、播放器與課程腳本都已支援直式(live/place.ts、live/blocking.ts、site/useAutoAspect.ts);演員依舞台換樣態只做了兒童課的 kid-web、kid-tree。
// 技術細節以 live/README.md 為準,這一頁只記定位、現況與待決定。

const POSITIONING: [string, string][] = [
  ['研發階段', '已完成(還沒發版):手機直拿時所有播放器(互動課程頁、首頁嵌入、LivePlayer、兒童課)自動用直式,課程腳本都有直式位置與調度;大人課的演員還沒有直式樣態。'],
  ['一句話', '同一支腳本、旁白、章節都不變,方向是播放時的參數:時間軸不變、空間可變。'],
  ['適用', '所有互動課程(L0、網頁怎麼運作、兒童網頁課)與宣傳影片;手機直拿看課、短影音平台的 1080×1920 影片。'],
]

const DONE: [string, string][] = [
  ['畫布', '橫式 1920×1080(預設,與原本逐像素相同)、直式 1080×1920。'],
  ['位置', 'place 與 move.to 可寫成 { landscape, portrait };語意名稱在直式自動換算:left 是上半部、right 是下半部、center 垂直置中、window 留邊滿版、full 滿版。'],
  ['字卡與鏡頭', '字卡、說明框的字級在直式另外調整,字幕可折行;鏡頭的下緣安全線橫式 68%、直式 84%。'],
  ['自動直式', '視窗 ≤600px 且直拿時自動用直式(site/useAutoAspect.ts);網址 ?aspect=portrait|landscape 優先。互動課程頁的側欄改成底部抽屜,工具列有「橫/直」切換鈕。'],
  ['調度', '幾位演員共用同一塊位置、輪流到前景(live/blocking.ts):序章、L0 第 0–2 課、網頁課 0.2 兩種方向都用。'],
  ['兒童課', 'KidsPlayer 依方向換舞台尺寸;kid-web 在直的外框裡加寬、分開時上下排,kid-tree 改成網頁在上、樹在下。'],
  ['預覽與錄製', '/materials/promo?script=…&aspect=portrait 看任何腳本的直式;npm run record:live -- … --aspect portrait 輸出 1080×1920 的 mp4。'],
]

const ACTORS: [string, string, string][] = [
  ['person', '人物固定畫在左上角、尺寸很小,槽再大也只是多一片空白', '依槽放大成半身像,泡泡放在人物上方或下方'],
  ['chat', '大槽時訊息擠在底部、上方一大片空;500×700 剛好像手機,表現最好', '固定成手機比例置中,或字級依槽寬放大'],
  ['claude-desktop', '側欄占去約 1/5 寬,全部是小字,手機上不可讀;輸入框離內容很遠', '直式隱藏側欄、字級放大約 1.6 倍,或只演輸入框與對話的精簡版'],
  ['browser', '網頁寬度固定再縮放進槽,窄槽時字很小,網址列被截斷(桌面寬度已改成網頁和槽一樣寬、高度跟著槽的比例,直式拉長、橫式變矮,不留白)', '直式預設用手機寬度(390)並撐滿槽高,網址列只留網域'],
  ['editor', '字小、行少,大槽時下半部全空;窄槽時程式碼被切掉', '隱藏檔案清單、字級放大、長行折行'],
  ['finder', '內容只占頂端幾列,其餘空白', '改圖示格狀或放大列高,高度依內容'],
  ['notes', '便條集中在上方,下面大片空', '便條依槽尺寸縮放、置中排列'],
  ['macbook', '等比例縮放不會被切,但上下留白很多', '用 tilt 或 screen 推近,或加直立擺放'],
]

const GAPS = [
  '大人課的演員都是照橫式比例畫的:直式槽留白多、字相對太小,窄槽會被切掉或折行。字小與舞台基準字級無關,要在演員內依槽寬換算。',
  '手機直式時演員縮到約 0.36 倍,字偏小。',
  '語意名稱 right 在直式是固定高度的下半部,依內容高度的演員(finder、person)放在 right 時不再是內容高。',
]

const NEXT = [
  '演員依舞台換樣態:先做最常出場的 claude-desktop、browser、editor,依上表的建議。',
  '用手機實機看一次各課的直式與調度,確認節奏與字的大小。',
  '加了調度的課要重新合成章節音軌(npm run mix -- --all --publish)。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '平板直拿', body: '目前只有 ≤600px 的手機直拿自動直式,平板直拿仍是橫式舞台;要不要放寬門檻?' },
  { title: '短影音', body: '是否要把宣傳影片輸出成直式,發在短影音平台。' },
]

const TRIALS: { script: string; label: string }[] = [
  { script: 'promo/portrait-demo.json', label: '直式示範' },
  { script: 'lab/blocking-demo.json', label: '調度：前後景輪替' },
  { script: 'l0/0.intro.json', label: '序章（調度）' },
  { script: 'l0/0.0-tools.json', label: '第 0 課（調度）' },
]

/** 試做:按下才載入播放器(舞台載入較重),可換腳本與方向 */
function PortraitTrial() {
  const [on, setOn] = useState(false)
  const [script, setScript] = useState(TRIALS[0].script)
  const [aspect, setAspect] = useState<Aspect>('portrait')
  if (!on)
    return (
      <div className={ui.links}>
        <button type="button" className={ui.btn} onClick={() => setOn(true)}>
          ▶ 載入直式試做
        </button>
      </div>
    )
  return (
    <section>
      <div className={ui.links} role="group" aria-label="試做腳本">
        {TRIALS.map((t) => (
          <button key={t.script} type="button" className={script === t.script ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={script === t.script} onClick={() => setScript(t.script)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={ui.links} role="group" aria-label="舞台方向" style={{ marginTop: 8 }}>
        {(['portrait', 'landscape'] as const).map((a) => (
          <button key={a} type="button" className={aspect === a ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={aspect === a} onClick={() => setAspect(a)}>
            {a === 'portrait' ? '直式 9:16' : '橫式 16:9'}
          </button>
        ))}
      </div>
      <PromoPlayer key={`${script}|${aspect}`} script={script} aspect={aspect} />
    </section>
  )
}

export function PortraitPage() {
  return (
    <ProposalLayout title="直式舞台" footer="開發 · 已完成,大人課演員的直式樣態尚未做">
      <h1>開發 · 直式舞台(9:16)</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>已完成 · 演員樣態待做</span>

      <h2>定位</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {POSITIONING.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '9em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>目前已做(原型)</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {DONE.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '9em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>試做</h2>
      <p className={ui.lead}>選一支腳本，切換橫式和直式比較。序章與第 0 課是課程本身的腳本，兩種方向都用調度。「調度」是兩位演員共用同一塊位置、輪流到前景：依序示範縱深構圖（depth）、子母畫面（pip）、單人鏡頭（single），規格見 web/src/live/blocking.ts。</p>
      <PortraitTrial />
      <div className={ui.links}>
        <Link className={`${ui.btn} ${ui.ghost}`} to="/courses/tools/intro?aspect=portrait">
          序章的直式互動頁（含手機底部抽屜）
        </Link>
      </div>

      <h2>逐演員觀察</h2>
      <p className={ui.lead}>各演員原樣放進直式槽(1000×1400、1000×700、500×700),演員程式沒有改。沒有演員崩壞或消失,主要問題是留白多、字太小。</p>
      <section className={ui.card}>
        <table>
          <thead>
            <tr>
              <th>演員</th>
              <th>看到的問題</th>
              <th>建議的直式樣態</th>
            </tr>
          </thead>
          <tbody>
            {ACTORS.map(([name, issue, idea]) => (
              <tr key={name}>
                <td className={ui.nowrap}>
                  <strong>{name}</strong>
                </td>
                <td>{issue}</td>
                <td>{idea}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>已知缺口</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={GAPS} />
        </div>
      </section>

      <h2>建議的下一步</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <ol className={ui['plain-list']}>
            {NEXT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </section>

      <h2>待決定</h2>
      <div className={ui.note}>
        <ul style={{ margin: 0 }}>
          {OPEN_QUESTIONS.map((q) => (
            <li key={q.title}>
              <strong style={{ display: 'inline' }}>{q.title}</strong>：{q.body}
            </li>
          ))}
        </ul>
      </div>
      <p className={ui.lead}>技術細節(換算規則、檔案位置)見 web/src/live/README.md 的「直式舞台(原型)」一節。</p>
    </ProposalLayout>
  )
}
