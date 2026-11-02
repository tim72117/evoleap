import { Link } from 'react-router-dom'
import { Article, Callout, DataTable, Ext, Section } from '../Article'

// 參考案例:video-shotcraft(產品宣傳片製作 skill)。2026-11-02 閱讀原始碼與文件的整理,未實際渲染。
// 和其他研究筆記不同:這是一個開源專案的做法,不是有學習成效實證的研究;「不照搬」的理由引用即時教學影像頁的研究整理。

type Row = [string, string]

const SUMMARY: Row[] = [
  ['是什麼', '一套給 Claude Code、Codex 使用的產品宣傳片製作 skill（Apache-2.0）。AI 依配方卡，用真實截圖與程式碼逐格畫出畫面，以 Remotion 輸出 MP4，不用 AI 生成影像。'],
  ['鏡頭配方卡', '124 張卡、150 個鏡頭。每張記錄意圖、影格時間表、參數的調節手感、音效、已知問題，並指向範例程式；要求先讀範例，不憑卡名重寫。'],
  ['真實介面素材', '用無頭瀏覽器截取 2 倍整頁圖、元素去背圖與座標表（layout.json），再由 2.5D 頁面相機運鏡；疊加元素與頁面共用座標。'],
  ['文字保持清晰', '放大時用 CSS zoom，不用 transform: scale，讓瀏覽器以放大後的尺寸繪製；主角元素另備 4 倍圖，推近時淡入替換。'],
  ['判例式準則', '每條審美規則都附當時的返工回饋與自查問題，例如一個鏡頭只講一個動態、關鍵資訊落定後至少停 1 秒。'],
  ['分層驗收', '每個鏡頭抽靜態影格自查，交付前由未參與製作的 subagent 獨立審查，逐條列出帶影格編號的證據。'],
]

const ADOPT: Row[] = [
  ['教學鏡頭配方', '整理常用段落（推近輸入框 → 打字 → 送出；展開權限對話框 → 聚光 → 點擊），附時間表與已知問題，讓 AI 寫腳本更穩定。'],
  ['先留停留時間', '排時間軸時先留好重要結果的停留時間，操作速度依真人節奏，與即時教學影像頁的節奏原則一致。'],
  ['指定驗收時間點', '每段腳本指定要檢查的時間點，在預覽頁截圖確認；交付前再做一次獨立審查。'],
  ['返工記成判例', '把實際修改過的問題寫成「規則＋回饋＋自查問題」，累積成課程自己的準則。'],
]

const SKIP: Row[] = [
  ['配樂卡點、全畫面衝擊', '宣傳片追求記憶點；教學研究指出音樂與無關刺激會干擾學習，有旁白時不採用。'],
  ['傾斜運鏡與炫技特效', '操作教學需要看清文字。保留正視的推近；若日後加入 3D 傾斜，再注意文字清晰問題。'],
  ['離線渲染 MP4', '課程要能暫停、選取文字、依步驟跳轉，繼續在瀏覽器即時播放；宣傳片段才需要輸出影片。'],
  ['靜態截圖取代演員', '教學要呈現逐步操作與狀態變化，模擬介面比靜態圖適合；截圖只用在必須呈現真實頁面的少數場景。'],
]

const toc = [
  { id: 'what', title: '它怎麼做' },
  { id: 'adopt', title: '值得借用' },
  { id: 'skip', title: '不照搬' },
]

export function ShotcraftPage() {
  return (
    <Article slug="research/video-shotcraft" toc={toc}>
      <p>
        <Ext href="https://github.com/Vincentwei1021/video-shotcraft">video-shotcraft</Ext> 是一套給 Claude Code、Codex
        使用的產品宣傳片製作 skill。本篇整理它的製作方法，評估哪些適合用在課程的即時教學畫面。
      </p>
      <Callout title="這是參考案例，不是研究結論">
        <p>
          內容來自閱讀它的原始碼與文件（2026-11-02），沒有實際渲染；卡片與鏡頭數量等數字取自該專案的說明，未另外核對。它的目標是產品宣傳片，和教學影像不同，所以只借用製作方法；「值得借用」是提案，尚未在課程上驗證。
        </p>
      </Callout>

      <Section id="what" title="它怎麼做">
        <DataTable head={['項目', '做法']} rows={SUMMARY} />
      </Section>

      <Section id="adopt" title="值得借用">
        <DataTable head={['做法', '用在課程上']} rows={ADOPT} />
      </Section>

      <Section id="skip" title="不照搬">
        <DataTable head={['手法', '原因']} rows={SKIP} />
        <p>
          理由依據的研究整理見課程研發<Link to="/proposal/visuals">即時教學影像</Link>頁的製作原則。
        </p>
      </Section>
    </Article>
  )
}
