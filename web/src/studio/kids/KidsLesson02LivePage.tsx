import { Link } from 'react-router-dom'
import { KidsPlayer } from '../../kids/KidsPlayer'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 兒童網頁課 0.2「網頁是一棵樹」的試做:kid-tree 演員(橫向樹狀圖、照樹畫網頁、移動節點)+ 主腳本與拖拉子腳本 + 兒童版播放器的拖曳。
// 還沒放上公開的課程地圖(content/kidsCourse.ts 的 KIDS_OPEN_LESSONS),看過再決定。語音還沒產生,目前用瀏覽器語音念。

export function KidsLesson02LivePage() {
  return (
    <ProposalLayout title="兒童網頁課 0.2 試做" footer="試做 · 腳本：src/content/live/kids/0.2.json、0.2-drag.json · 演員：src/live/actors/kid-tree/ · 拖曳：src/kids/drag.ts">
      <p>
        <Link to="/studio/kids-web">← 兒童網頁課大綱</Link>
      </p>
      <h1>0.2　網頁是一棵樹</h1>

      {/* 孩子打開就是播放器,說明文字都放在播放器後面 */}
      <KidsPlayer script="kids/0.2.json" scrub />

      <h2>這一課怎麼演</h2>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試做 · 還沒產生語音，也還沒放上公開的課程地圖</span>
      <section className={ui.card}>
        <ul>
          <li>
            <strong>看：</strong>空白的網頁旁邊是一棵橫向的樹（根在左、往右長，同一層由上往下排，和網頁的上下順序一樣）。小畫家從樹根出發，由上往下走過每個節點，網頁一塊一塊畫出來；名片盒往右多一層，裡面的圖片和文字畫在框框裡。示範把圖片拉到最上面再拉回去。
          </li>
          <li>
            <strong>做（子腳本 0.2-drag.json）：</strong>孩子按住樹上的節點拖到別的位置（滑鼠、手指都可以），網頁馬上照新的樹重畫；右下角三個任務（圖片拉到最上面、按鈕拉進名片盒、文字拉到圖片上面）都完成就回到主腳本。往右拖得越多，會放進越裡面一層。
          </li>
          <li>
            <strong>找找看：</strong>瀏覽器第一個畫的是哪一個、哪一個是裝東西的盒子，點樹上的節點回答，答錯會說明再問一次。
          </li>
          <li>
            <strong>學會：</strong>瀏覽器照著樹，由上往下、一層一層把網頁畫出來；名詞：樹狀圖、上一層、下一層、裡面。
          </li>
          <li>
            <strong>新增：</strong>kid-tree 演員（draw、move、inspect、check，任務 goals）；兒童版播放器的拖曳（子腳本的 interact.drag，拖放位置由 src/kids/drag.ts 依演員狀態算出，舞台與腳本引擎沒有改）。
          </li>
        </ul>
      </section>
    </ProposalLayout>
  )
}
