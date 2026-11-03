import { Link } from 'react-router-dom'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 工具總覽:課程研發工作區裡所有工具的入口(網頁工具直接開啟;指令列工具連到使用說明)。
// 新增工具時在這裡加一張卡片。

type Tool = {
  title: string
  /** 用途 */
  body: string
  /** 怎麼用:網頁或指令 */
  how: string
  links: { to: string; label: string }[]
  /** 程式所在位置 */
  path: string
}

const TOOLS: Tool[] = [
  {
    title: '課程編排',
    body: '列出各程度的課程與段落，拖曳段落到不同課程、拖曳課程到不同程度，修改即時存成 JSON。',
    how: '網頁（只能在本機開發站儲存）',
    links: [{ to: '/materials/course-map', label: '開啟' }],
    path: 'web/src/studio/materials/course-map.json',
  },
  {
    title: '即時教學畫面預覽',
    body: '看任一份課程腳本在某個時間點的畫面，或用完整播放器播放；寫腳本、檢查畫面時使用。',
    how: '網頁',
    links: [
      { to: '/proposal/visuals/preview', label: '開啟預覽' },
      { to: '/docs/live', label: '規格' },
    ],
    path: 'web/src/live/ · web/src/content/live/',
  },
  {
    title: '宣傳影片錄製工具',
    body: '用 JSON 分鏡腳本產生畫面，逐格截圖錄成 1080p 影片與字幕檔。',
    how: '指令：在 web/ 執行 npm run record',
    links: [{ to: '/docs/recorder', label: '使用說明' }],
    path: 'web/src/studio/recorder/',
  },
  {
    title: '封面設計',
    body: '繪製 L3 課程的長形與方形封面，另存成 PNG。',
    how: '網頁',
    links: [{ to: '/materials/cover-designer', label: '開啟' }],
    path: 'web/src/studio/materials/',
  },
  {
    title: '封面裁切',
    body: '上傳截圖或素材，拖曳縮放對齊裁切框，輸出平台要求的比例與解析度。',
    how: '網頁',
    links: [{ to: '/materials/cover-cropper', label: '開啟' }],
    path: 'web/src/studio/materials/',
  },
]

export function MaterialsIndexPage() {
  return (
    <ProposalLayout title="工具" footer="課程研發工作區 · 工具在 web/src/studio/ 與 web/src/live/">
      <h1>工具</h1>
      <p className={ui.lead}>課程研發用的工具。網頁工具直接開啟；指令列工具連到使用說明。</p>
      {TOOLS.map((t) => (
        <section className={ui.card} key={t.title}>
          <div className={ui['card-head']}>
            <div className={ui['head-left']}>
              <div>
                <h3>{t.title}</h3>
                <div className={ui.meta}>{t.how}</div>
              </div>
            </div>
          </div>
          <div className={ui['card-body']}>
            <p className={ui['kv-lead']}>{t.body}</p>
            <p className={ui['kv-lead']} style={{ marginTop: 6 }}>
              <span className={ui['repo-path']}>{t.path}</span>
            </p>
          </div>
          <div className={ui['card-foot']}>
            <div className={ui.links}>
              {t.links.map((l, i) => (
                <Link key={l.to} className={i === 0 ? ui.btn : `${ui.btn} ${ui.ghost}`} to={l.to}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </ProposalLayout>
  )
}
