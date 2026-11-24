import { Link } from 'react-router-dom'
import { useScriptPaths } from '../../live/scripts'
import { STUDIO_DATA } from '../studioData'
import { KIND_LABEL, MODE_LABEL, fullScriptPath, fullTrialPath, type FullCourseData, type FullCourseKind, type FullStage, type Mode } from './fullCourse'
import { WithStudioData } from './WithStudioData'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

const MODES: { mode: Mode; desc: string }[] = [
  { mode: 'once', desc: '交代清楚（含怎樣算完成），AI 自己做完並驗證。' },
  { mode: 'rounds', desc: '要來回幾次：看結果、指出問題、再改。' },
  { mode: 'tool', desc: '先請 AI 做一個腳本、小工具或技能來協助完成。' },
  { mode: 'manual', desc: 'AI 碰不到的頁面（網域商、雲端主控台、付款）：AI 寫操作步驟，你照做並回報。' },
]

// 全環節課程清單：單元依環節連續編號（1、2、3…），環節編號為「單元.第幾項」；每個環節是基礎知識與用 AI 完成兩堂課。
const FOOTER = '資料：src/content/live/data/full-course.json（研發基地的資料，進資料庫）'

export function FullCoursePage() {
  return (
    <WithStudioData<FullCourseData> path={STUDIO_DATA.fullCourse} title="全環節課程清單" footer={FOOTER}>
      {(d) => <FullCourseView stages={d.stages} />}
    </WithStudioData>
  )
}

function FullCourseView({ stages: FULL_STAGES }: { stages: FullStage[] }) {
  let unitNum = 0
  const units = FULL_STAGES.flatMap((s) => s.units)
  const lessons = units.flatMap((u) => u.lessons)
  const fromL2 = lessons.filter((l) => l.from).length
  const modeCount = (m: Mode) => lessons.filter((l) => l.mode.includes(m)).length
  // 有哪些試做腳本要向伺服器問,問到之前先不列試做連結
  const have = new Set(useScriptPaths() ?? [])
  const trials = (code: string) =>
    (['know', 'ai'] as FullCourseKind[]).filter((k) => have.has(fullScriptPath(code, k)))
  return (
    <ProposalLayout title="全環節課程清單" footer={FOOTER}>
      <h1>全環節課程清單</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待選主題</span>
      <p className={ui.lead}>
        做出一個網站服務，從準備、規劃、開發、測試、上線、營運到行銷，每個環節都交給 AI 程式助手完成。共 {FULL_STAGES.length} 個階段、{units.length} 個單元、{lessons.length} 個環節；每個環節兩堂課：<strong>基礎知識</strong>（先懂概念）與 <strong>用 AI 完成</strong>。{fromL2} 個環節沿用{' '}
        <Link to="/studio/vibe-coding">L2 Vibe Coding 入門</Link>（標出 L2 課號），其餘是新增的；和現有課程重疊沒關係，之後再決定主題怎麼組。
      </p>
      <p className={ui.lead}>
        試做腳本的載入檢查見 <Link to="/studio/full-course/check">腳本檢查</Link>。最後的「讓 AI 順利工作」接續 <Link to="/studio/ai-scenarios">AI 自動化情境清單</Link>，教怎麼讓 AI 看得到、自己檢查、自己做工具。「自己來」是 AI 不該代做的部分：付款、密碼與身分驗證、法律責任、對外送出前的確認。
      </p>

      <section className={ui.card}>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>用 AI 完成的方式（不固定，一個環節可能混用）：</p>
          <ul className={ui['plain-list']}>
            {MODES.map((m) => (
              <li key={m.mode}>
                <strong>{MODE_LABEL[m.mode]}</strong>（{modeCount(m.mode)}）：{m.desc}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {FULL_STAGES.map((stage) => (
        <section key={stage.id} id={stage.id}>
          <h2>{stage.title}</h2>
          {stage.units.map((unit) => {
            unitNum += 1
            const n = unitNum
            return (
              <section className={ui.card} key={unit.title}>
                <div className={ui['card-head']}>
                  <div className={ui['head-left']}>
                    <span className={ui['head-num']}>{n}</span>
                    <div>
                      <h3>{unit.title}</h3>
                      <div className={ui.meta}>
                        {unit.lessons.length} 個環節 · {unit.lessons.length * 2} 堂課
                      </div>
                    </div>
                  </div>
                </div>
                <div className={ui['table-scroll']}>
                  <table className={ui['lesson-table']}>
                    <thead>
                      <tr>
                        <th>環節</th>
                        <th>基礎知識</th>
                        <th>用 AI 完成</th>
                        <th>自己來</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unit.lessons.map((l, i) => (
                        <tr key={l.title}>
                          <td>
                            <strong>
                              {n}.{i + 1} {l.title}
                            </strong>
                            {trials(`${n}.${i + 1}`).length > 0 && (
                              <div className={ui.small}>
                                試做：
                                {trials(`${n}.${i + 1}`).map((k) => (
                                  <Link key={k} to={fullTrialPath(`${n}.${i + 1}`, k)} style={{ marginRight: 8 }}>
                                    ▶ {KIND_LABEL[k]}
                                  </Link>
                                ))}
                              </div>
                            )}
                            {l.from && (
                              <>
                                {' '}
                                <span className={`${ui.chip} ${ui.done}`}>L2 {l.from}</span>
                              </>
                            )}
                          </td>
                          <td className={ui.small}>{l.know}</td>
                          <td className={ui.small}>
                            {l.mode.map((m) => (
                              <span key={m} className={`${ui.chip} ${ui.todo}`} style={{ marginRight: 4 }}>
                                {MODE_LABEL[m]}
                              </span>
                            ))}
                            <div>{l.ai}</div>
                            <div>成果：{l.result}</div>
                          </td>
                          {/* 窄螢幕表格排成卡片,沒有就留空格 */}
                          <td className={ui.small}>{l.human}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </section>
      ))}
    </ProposalLayout>
  )
}
