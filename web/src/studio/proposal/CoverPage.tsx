import { ProposalLayout } from './ProposalLayout'

export function CoverPage() {
  return (
    <ProposalLayout title="L3 封面圖" footer="web/src/studio/proposal/CoverPage.tsx">
      <h1>封面圖</h1>
      <p className="lead">平台需要兩種尺寸。下方直接嵌入封面設計頁，兩張都是即時繪製，畫面就是最終輸出內容。</p>

      <table className="card" style={{ display: 'table', marginBottom: 22 }}>
        <thead>
          <tr>
            <th>用途</th>
            <th>尺寸</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>長形課程封面圖</td>
            <td>1000×620，jpg／png</td>
            <td>
              <span className="chip done">已有</span>
            </td>
          </tr>
          <tr>
            <td>方形課程封面圖</td>
            <td>800×800，jpg／png</td>
            <td>
              <span className="chip todo">設計已完成，尚未輸出圖檔</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        <a className="btn" href="/materials/cover-designer" target="_blank" rel="noopener">
          在新分頁開啟封面設計頁
        </a>
      </p>

      <iframe className="frame" src="/materials/cover-designer" title="封面設計頁" height={1420} />

      <div className="note" style={{ marginTop: 20 }}>
        <strong>圖檔輸出</strong>
        兩張圖都還沒輸出成檔案。
        你確認封面沒問題後告訴我，我會輸出兩張 PNG，這一頁改成直接顯示圖檔。
      </div>
    </ProposalLayout>
  )
}
