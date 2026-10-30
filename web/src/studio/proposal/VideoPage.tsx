import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProposalLayout } from './ProposalLayout'
// 頁面資料 videoData.json 由 tools/video/build-proposal-page.mjs 從 tools/video/scripts/fundraising.json 產生(JSON 不要手改)。
import video from './videoData.json'

export function VideoPage() {
  const [guides, setGuides] = useState(false)
  const base = video.stillsBase + (guides ? '-guides' : '')
  const n = video.sceneCount

  return (
    <ProposalLayout title="L3 募資影片" footer="web/src/studio/proposal/VideoPage.tsx">
      <h1>募資影片</h1>
      <p className="lead">
        共 {n} 個場景，預估 {Math.floor(video.totalSec / 60)} 分 {video.totalSec % 60}{' '}
        秒。下方是各場景接近結尾時的畫面與老師要念的旁白稿。
      </p>

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>項目</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>畫面（{n} 個場景）</td>
              <td>
                <span className="chip done">已完成</span>
              </td>
            </tr>
            <tr>
              <td>旁白稿</td>
              <td>
                <span className="chip todo">待補自我介紹（場景 2）</span>
              </td>
            </tr>
            <tr>
              <td>旁白錄音（老師本人）</td>
              <td>
                <span className="chip todo">待錄</span>
              </td>
            </tr>
            <tr>
              <td>成片與字幕檔（.srt）</td>
              <td>
                <span className="chip todo">待錄製</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <h2>平台規格</h2>
      <section className="card">
        <table>
          <tbody>
            <tr>
              <td>長度</td>
              <td>1 到 3 分鐘</td>
            </tr>
            <tr>
              <td>畫面</td>
              <td>16:9、1080p、mp4</td>
            </tr>
            <tr>
              <td>必須說明</td>
              <td>課程目標、教學方式、與同類課程的差異、自我介紹</td>
            </tr>
            <tr>
              <td>口白</td>
              <td>必須是老師本人，不能是機器人聲</td>
            </tr>
            <tr>
              <td>預留位置</td>
              <td>右上角平台 logo、底部 CC 字幕；重要資訊不可被擋住</td>
            </tr>
            <tr>
              <td>字幕</td>
              <td>另外上傳 .srt（zh-TW），不燒進畫面</td>
            </tr>
          </tbody>
        </table>
      </section>

      <h2>畫面與旁白稿</h2>
      <label className="toggle">
        <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} /> 疊出平台 logo
        與字幕預留區
      </label>
      <div className="grid">
        {video.scenes.map((sc) => (
          <figure key={sc.n}>
            <img src={`${base}/${sc.still}`} alt={`場景 ${sc.n}`} />
            <figcaption>
              <b>{sc.n}</b>
              {sc.narration}
            </figcaption>
          </figure>
        ))}
      </div>

      <h2>待補或待確認</h2>
      <div className="note">
        <ul style={{ margin: 0 }}>
          {video.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <h2>相關檔案</h2>
      <section className="card">
        <table>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/storyboard/fundraising">分鏡腳本</Link>
              </td>
              <td>每個場景的畫面、時間、旁白對照表</td>
            </tr>
            <tr>
              <td>
                腳本原始檔<span className="repo-path">tools/video/scripts/fundraising.json</span>
              </td>
              <td>改這個檔，重跑工具就會更新畫面</td>
            </tr>
            <tr>
              <td>
                影片工具說明<span className="repo-path">tools/video/README.md</span>
              </td>
              <td>如何產生畫面、錄製與混入旁白</td>
            </tr>
          </tbody>
        </table>
      </section>
    </ProposalLayout>
  )
}
