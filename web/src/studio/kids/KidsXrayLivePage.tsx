import { Link } from 'react-router-dom'
import { KidsPlayer } from '../../kids/KidsPlayer'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 兒童網頁課「戴上 X 光眼鏡」的試做草稿(原本的 0.2;0.2 改成「網頁是一棵樹」,這份之後併進 0.3「網頁是一封信」):kid-web 演員(xray、edit、reload)+ 主腳本與子腳本 + 兒童版播放器。
// 還沒放上公開的課程地圖(content/kidsCourse.ts 的 KIDS_OPEN_LESSONS),看過再決定。語音還沒產生,目前用瀏覽器語音念。

export function KidsXrayLivePage() {
  return (
    <ProposalLayout title="兒童網頁課 X 光眼鏡草稿" footer="試做 · 腳本：src/content/live/kids/xray.json、xray-edit.json · 演員：src/live/actors/kid-web/">
      <p>
        <Link to="/studio/kids-web">← 兒童網頁課大綱</Link>
      </p>
      <h1>草稿　戴上 X 光眼鏡</h1>

      {/* 孩子打開就是播放器,說明文字都放在播放器後面 */}
      <KidsPlayer script="kids/xray.json" scrub />

      <h2>這一課怎麼演</h2>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試做 · 還沒產生語音，也還沒放上公開的課程地圖</span>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>看：</strong>不翻面，戴上 X 光眼鏡，網頁上每個東西旁邊出現它的積木名字；示範把標題改成「阿明的家」，按重新整理又變回「小花的家」。
          </li>
          <li>
            <strong>做（子腳本 xray-edit.json）：</strong>孩子自己點網頁上的標題、文字、按鈕改字（再點一次換另一句），改過之後按網址列的 ↻ 重新整理，看到全部變回來就結束。
          </li>
          <li>
            <strong>找找看：</strong>兩道是非題（別人看得到我改的嗎、重新整理之後會怎樣），選項是舞台下方的大按鈕，答錯會說明再問一次。
          </li>
          <li>
            <strong>演員新增的動作：</strong>xray（戴上／拿下 X 光眼鏡）、edit（改網頁的字，逐字打出來）、reload（重新整理，改過的字變回原本的）。
          </li>
          <li>
            <strong>播放器新增：</strong>沒有對應演員目標的選項（是非題）排成舞台下方的大按鈕。
          </li>
        </ul>
      </section>
    </ProposalLayout>
  )
}
