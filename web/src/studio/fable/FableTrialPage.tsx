import { Link, useSearchParams } from 'react-router-dom'
import { LivePlayer } from '../../courses/LivePlayer'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import './registerActors'

// 「從做好到上線」0.1「本機與網路上」的畫面試作:探「即時教學畫面引擎」最多能做到什麼程度。
// 不用字卡、說明框,全部用演員、場景與動畫把概念演出來;兩位試作演員(fable-sky 夜景背景、fable-world 場景)
// 只登記給這一頁(registerActors.ts),不進公開 bundle;腳本在 content/live/lab/fable/0.1.json(只給管理員)。

const VERSIONS = [
  { id: 'actors', label: '原版：兩位演員', script: 'lab/fable/0.1.json', title: '本機與網路上（畫面試作）', note: '背景（fable-sky）與前景（fable-world）是兩位演員，背景的變化要在腳本裡用 mood 逐步下指令。' },
  { id: 'scene', label: '場景版：背景依狀態變化', script: 'lab/fable/0.1-scene.json', title: '本機與網路上（場景版）', note: '同一個場景（fable-scene）的兩層：背景依網站上線了沒、伺服器開著沒、大家打開了沒自動變化，腳本只寫劇情。' },
] as const

export function FableTrialPage() {
  const [params, setParams] = useSearchParams()
  const version = VERSIONS.find((v) => v.id === params.get('v')) ?? VERSIONS[0]
  return (
    <ProposalLayout title="畫面試作：本機與網路上" footer="試作 · 腳本：src/content/live/lab/fable/0.1.json · 演員：src/studio/fable/actors/" wide>
      <p>
        <Link className={`${ui.btn} ${ui.ghost}`} to="/studio/visuals">
          ← 即時教學影像
        </Link>
      </p>
      <h1>0.1　本機與網路上</h1>
      <p className={ui.lead}>學會：看懂 localhost 和網址的差別，知道作品現在只有自己看得到。約 2 分半。沒有字卡，全部用場景演出來。</p>

      <div className={ui.tabs} role="group" aria-label="版本" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {VERSIONS.map((v) => (
          <button key={v.id} type="button" className={v.id === version.id ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={v.id === version.id} onClick={() => setParams(v.id === 'scene' ? { v: 'scene' } : {})}>
            {v.label}
          </button>
        ))}
      </div>
      <p className={ui.lead}>{version.note}</p>
      <div className={ui['live-video']} style={{ maxWidth: 'none' }}>
        <LivePlayer key={version.id} script={version.script} title={version.title} onTime={() => {}} saveProgress={false} />
      </div>

      <p>
        <Link className={ui.btn} to="/studio/scenes">
          場景版的規則與展示：開發 › 場景 →
        </Link>
      </p>

      <h2>這一課怎麼演</h2>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試作 · 還沒產生語音（先用字幕），也沒有練習點</span>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>網址傳出去，朋友打不開：</strong>深夜的書桌，筆電的終端機跑起 npm run dev，印出 localhost 網址，瀏覽器視窗從螢幕下方滑上來、網站一塊塊畫出。你把網址傳給城市另一頭的阿哲：紙飛機沿著弧線飛過城市落到他的手機。阿哲一打開，信從手機出發、繞一圈又回到手機自己（localhost 指的就是他自己），手機晃一下：無法連上。
          </li>
          <li>
            <strong>localhost 是哪一台電腦：</strong>鏡頭推近書桌，筆電化成一間小房間：窗戶亮著、牆上掛著網站、門口的門牌是 5173。阿哲的手機旁邊也長出一間小房間，裡面是空的。門牌旁再多出 3000、8080 兩扇門（同一台電腦可以開好幾個網站）。按下 Ctrl + C，房間的燈慢慢暗掉、牆上的網站變成「網站停了」。
          </li>
          <li>
            <strong>上線之後的網址：</strong>城市地底亮起光纖、光點往伺服器那一側流動；網站從房間裡起飛、越縮越小、落進城裡那座亮著 24h 霓虹的大樓，招牌亮起 www.example.com，鏡頭同時拉回全景。阿哲再輸入網址，信飛到大樓、大樓的燈快閃、信帶著 200 OK 回來，手機上出現網站；城裡各處的手機與筆電一台台亮起同一個網站。伺服器一關機，整棟大樓熄燈、所有螢幕一起暗掉，信到門口沒人收、掉下來；再開機又亮回來。最後天色轉亮，收尾。
          </li>
        </ul>
      </section>

      <h2>新做的演員與背景</h2>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>fable-sky（動態背景，canvas）：</strong>星空（260 顆星各自的週期閃爍）、月亮與光暈、慢慢飄的雲、兩層平滑雜訊的遠山、兩排城市大樓（窗戶依固定種子亮暗，少數每隔一陣子閃一下）、地面，以及地底三條光纖（光點帶尾巴沿線流動）。動作只有燈光提示 <code>mood</code>：night、network（光纖亮起）、dawn（天色轉橘、星星退去），1.5 秒漸變。每一格都用傳入的 ms 重畫，畫面相同時跳過。
          </li>
          <li>
            <strong>fable-world（場景）：</strong>書桌（檯燈光暈、馬克杯）、筆電（終端機逐字打指令、瀏覽器滑上來）、小房間（屋頂、窗戶、相框裡的網站、門牌）、伺服器大樓（24 格窗戶、機櫃裡的網站、招牌、霓虹）、城裡五台裝置、朋友的手機（聊天訊息、滑上來的瀏覽器分頁、載入中的點點、錯誤頁、晃動）、朋友的小房間、紙飛機、信件、飛行中的網站。十一個操作式動作（boot、open、send、visit、reveal、peek、doors、stop、deploy、power、crowd），結果由 init／apply 推算：阿哲 visit 什麼網址會成功、會繞回自己、還是沒有回應，由當時的狀態（網站上線了嗎、伺服器開著嗎）決定，腳本不用寫結果。演員內部還有自己的「推軌」：小房間打開時推近書桌，上線時拉回全景。
          </li>
        </ul>
      </section>

      <h2>用到引擎哪些能力</h2>
      <section className={ui.card}>
        <ul>
          <li>兩位演員疊在同一塊 <code>full</code> 位置：背景與前景分層，各自依時間畫。</li>
          <li>有狀態的演員（init／apply）：每一步前後的狀態由舞台推算，拖曳到任何時間點都對得上；操作對不上狀態（還沒 boot 就 open、重複 deploy）載入就報錯。</li>
          <li>舞台鏡頭：終端機印出網址時推近（focus + zoom），門牌那一段推近小房間，再拉回全景。</li>
          <li>kit：typewriter、progress／ease、drawPath（信沿著 SVG 路徑飛、路徑逐步畫出）、shake（打不開時手機晃動）、pulse（霓虹呼吸）、blink（游標）、dots（連線中…）、rand／noise（星星、窗戶、遠山的固定種子）、spring／outBack（房間彈出）。</li>
          <li>字幕由旁白自動切分；章節由 chapter 標出，時間軸上有刻度。</li>
        </ul>
      </section>

      <h2>碰到引擎的限制、怎麼繞</h2>
      <p>要改舞台引擎的幾項（同一拍多個動作、鏡頭跟拍、演員互相讀狀態、常用手法收進 kit）記在即時教學畫面頁的「引擎優化構想」。</p>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>沒有場景級的鏡頭運動：</strong>舞台的 focus 只能「推近某個目標再拉回」，沒辦法寫「跟著紙飛機平移」或「拉回全景時順便往上搖」。這次把推軌做在演員裡（fable-world 自己對整個場景做 transform），可以做到自訂的路徑，但舞台的鏡頭不知道演員自己縮放過，兩者同時用時要自己避開；演員內部的推軌也量不到舞台的安全區（字幕區 68%）。
          </li>
          <li>
            <strong>疊在一起的演員不能互相看：</strong>背景的光纖和前景的大樓位置是各自寫死的座標，兩個演員沒有共用的場景座標或「誰在哪裡」；要對齊只能在兩邊都用 1920×1080 的 px。背景也收不到前景的狀態（例如伺服器關機時光纖應該一起暗），只能靠腳本再下一個 mood。
          </li>
          <li>
            <strong>一步只能有一個演員的動作：</strong>「上線」同時要光纖亮起（sky）和網站起飛（world），只能拆成兩步前後接著演，沒辦法在同一時刻並行；想要「背景與前景同一拍」只能把兩件事做進同一個演員。
          </li>
          <li>
            <strong>動畫長度是演員決定的（已處理）：</strong>旁白比動作長時舞台只延長停頓，動作本身不會跟著慢下來。現在 fable-world 的動畫依步驟長度等比例縮放，腳本在那一步寫 <code>ms</code>，整段動作就會放慢或加快來配合旁白；沒寫時照原本的長度。
          </li>
          <li>
            <strong>canvas 背景與鏡頭（已處理）：</strong>舞台推近時 canvas 跟著放大，1920×1080 的點陣在 1.7 倍下會軟掉。現在 fable-sky 依畫布實際顯示的大小（外殼縮放、鏡頭推近、螢幕像素密度）調整解析度，0.5 倍一階、最多 2 倍；只影響清晰度，不影響畫面內容。
          </li>
          <li>
            <strong>純函式的代價：</strong>每一格都要重新算出所有東西（背景每格重畫整張 canvas），render 不能存「上一格」。目前一格約 2–4 ms，倍速與拖曳都順；再複雜（粒子、更多窗戶）就要靠 kit.key 跳過相同的影格。
          </li>
          <li>
            <strong>路徑上的位置要讀 DOM：</strong>信沿路徑飛用的是 SVG 的 getPointAtLength，是「讀版面」不是「改版面」，拖曳與倒轉都一致，但在沒有版面的環境（vitest 的 jsdom）量不到，所以這兩位演員沒有逐格的單元測試，只能測 apply。
          </li>
          <li>
            <strong>沒做的：</strong>練習點（原本的 0.1 有一題「哪一個網址可以傳給朋友」，這版先用畫面收尾）、老師開場、語音、直式舞台（場景是橫式構圖，直式要重新排）。
          </li>
        </ul>
      </section>
    </ProposalLayout>
  )
}
