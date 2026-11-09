import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useScriptPaths } from '../../live/scripts'
import { LAB_TRIALS } from './labTrials'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'
import { useScriptCheck, type CheckStatus } from './useScriptCheck'

const STATUS: Record<CheckStatus, string> = { ok: '通過', error: '錯誤', wait: '檢查中', missing: '還沒有腳本' }

// 其他課程的試做清單(和全環節課程清單不重疊的部分):依課程分組,有腳本的連到試做頁,並逐一載入檢查(結果也在 window.__labTrialsCheck)。
export function LabTrialsPage() {
  // 兒童課的子腳本(lab/kids/1.1-sort.json 這類)由主腳本的 checkpoint 帶入,沒有自己的試做頁,一起載入檢查;
  // 有哪些要向伺服器問,問到之前先只檢查主腳本
  const all = useScriptPaths()
  const subs = useMemo(() => {
    const mains = new Set(LAB_TRIALS.map((t) => t.script))
    return (all ?? []).filter((p) => p.startsWith('lab/kids/') && !mains.has(p))
  }, [all])
  const results = useScriptCheck([...LAB_TRIALS.map((t) => t.script), ...subs], '__labTrialsCheck')
  const badSubs = subs.filter((p) => results[p].status === 'error')
  const courses = [...new Set(LAB_TRIALS.map((t) => t.course))]
  const count = (s: CheckStatus) => LAB_TRIALS.filter((t) => results[t.script].status === s).length
  return (
    <ProposalLayout title="課程試做清單" footer="清單：src/studio/proposal/labTrials.ts · 腳本：src/content/live/lab/">
      <h1>課程試做清單</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>試做 · 還沒有語音</span>
      <p className={ui.lead}>
        各課程還沒有即時教學畫面、而且和 <Link to="/studio/full-course">全環節課程清單</Link> 不重疊的課，共 {LAB_TRIALS.length} 堂：通過 {count('ok')}、錯誤 {count('error')}、檢查中{' '}
        {count('wait')}、還沒有腳本 {count('missing')}。兒童課子腳本 {subs.length} 份：錯誤 {badSubs.length}。
      </p>
      {badSubs.map((p) => (
        <p key={p} className={ui.small}>
          {p}：{results[p].error}
        </p>
      ))}
      {courses.map((c) => (
        <section key={c}>
          <h2>{c}</h2>
          <div className={`${ui.card} ${ui['table-scroll']}`}>
            <table className={ui['lesson-table']}>
              <thead>
                <tr>
                  <th>課</th>
                  <th>狀態</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                {LAB_TRIALS.filter((t) => t.course === c).map((t) => {
                  const r = results[t.script]
                  return (
                    <tr key={t.path} data-status={r.status}>
                      <td>
                        {r.status === 'missing' ? (
                          <span>
                            {t.code} {t.title}
                          </span>
                        ) : (
                          <Link to={t.path}>
                            {t.code} {t.title}
                          </Link>
                        )}
                      </td>
                      <td className={ui.small}>{STATUS[r.status]}</td>
                      <td className={ui.small}>{r.status === 'ok' ? `約 ${Math.round((r.ms ?? 0) / 1000)} 秒` : (r.error ?? '')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </ProposalLayout>
  )
}
