import { Link } from 'react-router-dom'
import { List } from './BasicsOutline'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 跨等級構想:演員互動,包含靜態互動與互動時的播放時間線。尚未評估。
// 腳本與互動的架構之後再一起設計,這頁只記想法與目前的了解,不是規格。

const SHOWCASE = '/studio/actor-interaction/showcase'

const POSITIONING: [string, string][] = [
  ['一句話', '在互動階段，學員可以真的點演員畫面上的東西，而不是只從旁邊的選項挑一個。'],
  ['研發階段', '靜態互動已在演員展示試做；時間線還只是想法，互動課程也還沒接上。'],
  ['適用範圍', '所有用舞台系統的互動課程，以及演員展示。'],
]

const CURRENT = [
  '互動課程的「把演員推到主畫面」（ActorPush）已經能在演員的目標上疊真實按鈕，但和課程頁綁在一起，也只有選項的形式。',
  '演員已經用目標名稱提供各區塊的位置，鏡頭、聚光燈、虛擬滑鼠都靠它定位，互動層可以沿用。',
  '演員每一格都可能重畫內容，畫面也必須只由時間決定，所以不適合直接在演員的元素上綁點擊事件。',
]

const STATIC_DONE = [
  '只有舞台，沒有播放器和時間軸；每次操作都接一步再演出，可以復原或重設。',
  '演員用 hotspots(state) 說明目前可以點什麼，頁面量出位置後疊上透明的真實按鈕，演員不處理點擊。',
  '要打字的地方（例如輸入框）會開真的輸入框；點到的動作跳過虛擬滑鼠的移動，直接從點下去的那一刻開始演。',
  '八位演員都有可點區：claude-desktop 可以走完選單到 Fork，finder 可以拖檔案，macbook 可以開蓋。',
]

const STATIC_LIMITS = [
  '只能點演員宣告過的地方，其他地方沒有反應；例如選單裡目前只有 Fork 能點，也不能點旁邊關閉選單。',
  '舞台寬度不到 500px 時關閉互動層：可點區太小，測試時真的點錯，要改用操作按鈕。',
  '瀏覽器演員只能重新整理，網頁內的連結和按鈕還不能直接點。',
]

// 互動時時間線的安排:一次互動從播放到接著播放的各個階段。
const TIMELINE_PHASES: { phase: string; timeline: string; screen: string; status: string }[] = [
  { phase: '播到互動點', timeline: '停在 checkpoint 的時間點，時間不再前進', screen: '定格，疊上可點區', status: '已有（互動課程）' },
  { phase: '等學員操作', timeline: '時間不動，所以等多久都不影響時間線', screen: '畫面由時間決定，不能靠時間做動畫；提示閃爍等要交給互動層的 CSS', status: '要設計' },
  { phase: '學員點下去', timeline: '對應的步驟插到互動點後面，重新載入舞台，後面的內容往後移', screen: '跳過虛擬滑鼠移動，從點下去的那一刻開始演', status: '靜態展示已有；課程要接' },
  { phase: '演出回應', timeline: '從互動點接著播，插入的步驟是時間線的一部分', screen: '和腳本寫好的演出相同', status: '已有（互動課程）' },
  { phase: '接著播放', timeline: '回到腳本原本的下一步', screen: '演員狀態要接得上學員選的結果', status: '已有（requires 處理前後依賴）' },
  { phase: '拖回去或重新回答', timeline: '回答留在時間線上；重新回答時收回它，以及接在它後面的回答', screen: '依時間重算，不用另外還原', status: '已有（互動課程）' },
]

const TIMELINE_DIRECTION = [
  '維持現在的原則：學員的操作就是時間線的一部分，畫面仍然只由時間決定，拖曳和倒轉不用另外處理。',
  '等待期間時間不前進。互動層自己的提示動畫不寫進時間線，錄影時也不會出現。',
  '一次互動可能不只點一下（開選單再按 Fork）。初步想法是「互動段」：暫停期間每點一下就插入一小段並演完，時間仍停在這段的結尾，達成目標或按繼續才往下播。',
  '學員是點的，不是看示範，所以演出跳過虛擬滑鼠的移動；「略過，看示範」才保留滑鼠，讓學員看到該點哪裡。',
]

const CAUTIONS = [
  '要做到什麼都能點，等於用腳本重寫一個假 App，成本會一路往上；建議只放在關鍵操作。',
  '點錯時若每種情況都要演不同反應，要寫和測的組合會很快變多。',
  '目標名稱或版面改動時可能讓互動失效，需要能自動走一遍的測試。',
  '打字、鍵盤快捷鍵、拖曳不只是點擊，還要考慮手機上的操作方式。',
]

const OPEN_QUESTIONS: { title: string; body: string }[] = [
  { title: '腳本與互動的架構', body: '可點的地方、點了之後的演出要怎麼描述，和現有的互動點（checkpoint）是什麼關係。之後一起設計，這頁不預設答案。' },
  { title: '進度條怎麼顯示', body: '回答後總長度會變，章節標記也跟著移動。要顯示實際長度，還是讓互動段不佔進度條？' },
  { title: '旁白怎麼接', body: '插入的演出要先產生語音；學員自己打的字沒有語音，只能用字幕。章節音軌是照固定時間合成的，時間往後移時接不接得上要實測。' },
  { title: '還沒回答就拖過互動點', body: '目前有 skip 的互動點會演示範；要不要強制停下來，還是都可以略過。' },
  { title: '進度要不要保存', body: '學員重新開頁時，是否還原回答，讓時間線和上次一樣。' },
  { title: '要做到多真', body: '只讓關鍵操作能點，或連帶提供 hover、點錯的提示。' },
]

export function ActorInteractionPage() {
  return (
    <ProposalLayout title="演員互動" footer="跨等級構想 · 尚未評估">
      <h1>構想 · 演員互動</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待評估</span>

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

      <h2>目前的了解</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={CURRENT} />
        </div>
      </section>

      <h2>靜態互動</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>不播放、只有舞台，學員或研發人員直接操作演員。已經試做：</p>
          <List items={STATIC_DONE} />
          <p className={ui['kv-lead']} style={{ marginTop: 8 }}>
            目前的限制：
          </p>
          <List items={STATIC_LIMITS} />
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={ui.btn} to={`${SHOWCASE}?mode=static`}>
              試用靜態互動
            </Link>
            <Link className={`${ui.btn} ${ui.ghost}`} to={SHOWCASE}>
              看動態展示
            </Link>
          </div>
        </div>
      </section>

      <h2>互動時的播放時間線</h2>
      <section className={`${ui.card} ${ui['table-scroll']}`}>
        <table className={ui['lesson-table']}>
          <thead>
            <tr>
              <th>階段</th>
              <th>時間線</th>
              <th>畫面</th>
              <th>現況</th>
            </tr>
          </thead>
          <tbody>
            {TIMELINE_PHASES.map((x) => (
              <tr key={x.phase}>
                <td className={ui.nowrap}>
                  <strong>{x.phase}</strong>
                </td>
                <td className={ui.small}>{x.timeline}</td>
                <td className={ui.small}>{x.screen}</td>
                <td className={ui.small}>{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>初步方向：</p>
          <List items={TIMELINE_DIRECTION} />
        </div>
        <div className={ui['card-foot']}>
          <div className={ui.links}>
            <Link className={`${ui.btn} ${ui.ghost}`} to="/studio/interactive">
              看現有的互動教學場景
            </Link>
          </div>
        </div>
      </section>

      <h2>要注意的地方</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <List items={CAUTIONS} />
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
    </ProposalLayout>
  )
}
