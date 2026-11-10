import { Link } from 'react-router-dom'
import { KidsPlayer } from '../../kids/KidsPlayer'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 兒童網頁課 0.3「網頁是一封信」的試做:kid-mail 演員(瀏覽器、伺服器、來回的信封)+ 主腳本與兩個子腳本。
// 已開放:公開的課程頁是 /courses/kids/0-3(content/kidsCourse.ts 的 KIDS_OPEN_LESSONS)。語音已產生(0.3*.voice.json)。

export function KidsLesson03LivePage() {
  return (
    <ProposalLayout title="兒童網頁課 0.3 試做" footer="試做 · 腳本：src/content/live/kids/0.3.json、0.3-mail.json、0.3-edit.json · 演員：src/live/actors/kid-mail/">
      <p>
        <Link to="/studio/kids-web">← 兒童網頁課大綱</Link>
      </p>
      <h1>0.3　網頁是一封信</h1>

      {/* 孩子打開就是播放器,說明文字都放在播放器後面 */}
      <KidsPlayer script="kids/0.3.json" scrub />

      <h2>這一課怎麼演</h2>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>已開放 · 公開課程頁 /courses/kids/0-3（登入後學習）</span>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>看：</strong>左邊是孩子的電腦（瀏覽器），右邊是伺服器（放網頁的電腦，像一個放信的櫃子）。在網址列打網址、按前往，信封沿著中間的路寄到伺服器：「請給我 www.xiaohua.tw」；伺服器找到那一封網頁，裝進信封寄回來，瀏覽器打開信，一塊一塊畫出網頁。
          </li>
          <li>
            <strong>做 1（子腳本 0.3-mail.json）：</strong>點書籤列上的三個網站，每點一個就看一次寄信、寄回、畫出來；三個都收到（三顆星）就回到主腳本。
          </li>
          <li>
            <strong>看：</strong>在自己的電腦上把標題改成「大明的家」，伺服器櫃子裡的還是「小花的家」；按重新整理，瀏覽器又寄一次信，拿回原本的網頁。
          </li>
          <li>
            <strong>做 2（子腳本 0.3-edit.json）：</strong>點網頁上的標題、文字、按鈕換成新的字（改過的有 ✏️），再按重新整理看全部變回來。
          </li>
          <li>
            <strong>找找看：</strong>網頁放在哪一台電腦上（點伺服器或你的電腦）、改過的字按哪裡可以變回來（重新整理、網址列、前往），答錯會說明再問一次。
          </li>
          <li>
            <strong>學會：</strong>網頁是從伺服器寄來的；在自己電腦上改的只有自己看得到。名詞：網址、瀏覽器、伺服器、重新整理。
          </li>
          <li>
            <strong>新增：</strong>kid-mail 演員（type、send、reply、open、go、edit、reload、check）。舞台、腳本引擎與兒童版播放器都沒有改。
          </li>
        </ul>
      </section>
    </ProposalLayout>
  )
}
