import { Link } from 'react-router-dom'
import { KidsPlayer } from '../../kids/KidsPlayer'
import { ProposalLayout } from '../proposal/ProposalLayout'
import { KIDS_LIVE_GAPS } from '../proposal/kidsWeb'
import ui from '../proposal/proposal.module.css'

// 兒童網頁課 0.1「翻到網頁的背面」的 live 引擎試做:kid-web 演員 + 舞台腳本 + 兒童版播放器殼層。
// 舞台與腳本引擎沒有改;做不到、需要擴充的地方列在 kidsWeb.ts 的 KIDS_LIVE_GAPS。React 直接畫的版本在 KidsLesson01Page.tsx。

export function KidsLesson01LivePage() {
  return (
    <ProposalLayout title="兒童網頁課 0.1 live 試做" footer="試做 · 演員：src/live/actors/kid-web/ · 腳本：src/content/live/kids/0.1.json · 殼層：src/kids/KidsPlayer.tsx">
      <p>
        <Link to="/studio/kids-web">← 兒童網頁課大綱</Link>　·　<Link to="/studio/kids-web/0-1">React 版試做</Link>
      </p>
      <h1>0.1　翻到網頁的背面</h1>

      {/* 孩子打開就是播放器,說明文字都放在播放器後面 */}
      <KidsPlayer script="kids/0.1.json" scrub />

      <h2>做到了什麼</h2>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試做 · 引擎沒改，只加演員與兒童版播放器</span>
      <section className={ui.card}>
        <p>
          同一課改用舞台腳本演出：看展示、自由點網頁或積木找對應、找找看三題。互動時會停下來等孩子直接點畫面上的東西，答錯會回到同一題再試。
        </p>
        <ul>
          <li>
            <strong>kid-web 演員：</strong>動作 flip（翻面、分開）、inspect（亮起對應的積木）、check（回答對錯），看過的積木集星星；照 README 2A.4、2A.5 用 init／apply 推算狀態，拖曳、倒轉都畫得對。
          </li>
          <li>
            <strong>兒童版播放器殼層：</strong>大按鈕、整句大字幕、段落泡泡，沒有時間軸與倍速；互動點一定要回答，選項是疊在網頁和積木上的大按鈕。
          </li>
          <li>
            <strong>回答：</strong>沿用互動場景的做法（scene.ts 的 expandAnswers），回答插進時間軸、重新載入舞台。
          </li>
          <li>
            <strong>子腳本（做）：</strong>主腳本播到「換你試試看」換上子腳本 kids/0.1-explore.json 的舞台（演員放大、兩面並排），示範一次點擊後讓孩子自由點，4 塊積木都找到就回主腳本接著播「找找看」。能點什麼、點了演什麼都寫在子腳本的 interact.spots，演員只負責動作怎麼畫。
          </li>
        </ul>
      </section>

      <h2>需要擴充的地方</h2>
      <section className={ui.card}>
        <ul>
          {KIDS_LIVE_GAPS.map((g) => (
            <li key={g.need}>
              <strong>{g.need}</strong>
              <br />
              現在：{g.now}
              <br />
              想法：{g.idea}
            </li>
          ))}
        </ul>
      </section>
    </ProposalLayout>
  )
}
