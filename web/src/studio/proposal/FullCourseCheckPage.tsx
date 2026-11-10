import { Link } from 'react-router-dom'
import { STUDIO_DATA } from '../studioData'
import { KIND_LABEL, fullItems, fullScriptPath, fullTrialPath, type FullCourseData, type FullCourseKind, type FullItem } from './fullCourse'
import { WithStudioData } from './WithStudioData'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'
import { useScriptCheck, type CheckStatus } from './useScriptCheck'

const STATUS: Record<CheckStatus, string> = { ok: '通過', error: '錯誤', wait: '檢查中', missing: '—' }

// 全環節課程腳本檢查:逐一載入 content/live/lab/full-course/ 的腳本,列出載入錯誤與長度(結果也在 window.__fullCourseCheck)。
export function FullCourseCheckPage() {
  return (
    <WithStudioData<FullCourseData> path={STUDIO_DATA.fullCourse} title="全環節課程腳本檢查" footer="腳本：src/content/live/lab/full-course/">
      {(d) => <FullCourseCheck items={fullItems(d.stages)} />}
    </WithStudioData>
  )
}

function FullCourseCheck({ items }: { items: FullItem[] }) {
  const rows = items.flatMap((it) => (['know', 'ai'] as FullCourseKind[]).map((kind) => ({ code: it.code, kind, title: it.lesson.title, path: fullScriptPath(it.code, kind) })))
  const results = useScriptCheck(
    rows.map((r) => r.path),
    '__fullCourseCheck',
  )
  const count = (s: CheckStatus) => rows.filter((r) => results[r.path].status === s).length
  return (
    <ProposalLayout title="全環節課程腳本檢查" footer="腳本：src/content/live/lab/full-course/">
      <h1>全環節課程腳本檢查</h1>
      <p className={ui.lead}>
        通過 {count('ok')}、錯誤 {count('error')}、檢查中 {count('wait')}、還沒有腳本 {count('missing')}（共 {rows.length} 堂）。
        <Link to="/studio/full-course">回全環節課程清單</Link>
      </p>
      <section className={`${ui.card} ${ui['table-scroll']}`}>
        <table className={ui['lesson-table']}>
          <thead>
            <tr>
              <th>課</th>
              <th>狀態</th>
              <th>說明</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => results[r.path].status !== 'missing')
              .map((r) => {
                const res = results[r.path]
                return (
                  <tr key={r.path} data-status={res.status}>
                    <td>
                      <Link to={fullTrialPath(r.code, r.kind)}>
                        {r.code} {r.title}（{KIND_LABEL[r.kind]}）
                      </Link>
                    </td>
                    <td className={ui.small}>{STATUS[res.status]}</td>
                    <td className={ui.small}>{res.status === 'ok' ? `約 ${Math.round((res.ms ?? 0) / 1000)} 秒` : (res.error ?? '')}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </section>
    </ProposalLayout>
  )
}
