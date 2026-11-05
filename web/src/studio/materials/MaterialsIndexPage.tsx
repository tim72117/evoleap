import { Link } from 'react-router-dom'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 工具總覽:研發基地裡所有工具的入口。
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
    title: '宣傳影片',
    body: '用即時教學畫面製作的宣傳片：選一支腳本在網頁上播放（可拖曳、全螢幕、字幕）；輸出 mp4 用指令逐格錄製，有旁白語音時一併混進音軌，並輸出字幕檔。',
    how: '網頁播放；指令：在 web/ 執行 npm run record:live -- promo/檔名.json',
    links: [{ to: '/materials/promo', label: '開啟' }],
    path: 'web/src/studio/materials/PromoPage.tsx · web/scripts/record-live.mjs · web/src/content/live/promo/',
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
    <ProposalLayout title="工具" footer="研發基地 · 工具在 web/src/studio/ 與 web/src/live/">
      <h1>工具</h1>
      <p className={ui.lead}>研發基地用的工具。</p>
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
