import { Link } from 'react-router-dom'
import type { CourseLesson } from '../../content/lessonTypes'
import {
  BRIDGE,
  CHECKLIST,
  MODULES,
  OPEN_QUESTIONS,
  TIER_INFO,
  TIER_LABEL,
  type Lesson,
  type Module,
  type ProductionPlan,
  type Tier,
} from './basicsData'
import { RESEARCH_REFS } from './researchRefs'
import { useCopy } from '../../site/useCopy'

function sumMinutes(mods: Module[]) {
  return mods.flatMap((m) => m.lessons).reduce((n, l) => n + (Number(l.length.match(/\d+/)?.[0]) || 0), 0)
}

const videoMinutes = (c: CourseLesson) => c.videos.reduce((n, v) => n + v.minutes, 0)

/** 「步驟 1–3」或「步驟 2、4」 */
function stepRange(steps: number[]) {
  if (steps.length === 0) return ''
  const contiguous = steps.every((s, i) => i === 0 || s === steps[i - 1] + 1)
  if (steps.length === 1) return `步驟 ${steps[0]}`
  return contiguous ? `步驟 ${steps[0]}–${steps[steps.length - 1]}` : `步驟 ${steps.join('、')}`
}

function CopyButton({ text }: { text: string }) {
  const { state, copy } = useCopy()
  const shown = state === 'copied' ? '已複製 ✓' : state === 'failed' ? '複製失敗，請手動選取' : '複製提示詞'
  return (
    <button type="button" className={state === 'copied' ? 'copy copied' : 'copy'} onClick={() => copy(text)}>
      {shown}
    </button>
  )
}

function LessonDetails({ lesson, course }: { lesson: Lesson; course: CourseLesson }) {
  const prompts = course.steps.filter((s) => s.prompt).length
  return (
    <details className="lesson-plan">
      <summary>
        <span className="lp-title">
          {course.id} {course.title}
        </span>
        <span className="lp-meta">
          {course.steps.length} 步（{prompts} 段提示詞）· 影片 {course.videos.length} 支 · {videoMinutes(course)} 分
          {lesson.status ? ` · ${lesson.status}` : ''}
        </span>
      </summary>
      <div className="lp-body">
        <div className="sub-label">1 · 目標</div>
        <p className="lp-goal">{course.goal}</p>
        <p className="lp-scenario">
          <strong>示範情境：</strong>
          {course.scenario}
        </p>

        <div className="sub-label">2 · 步驟拆解 → 3 · 實際操作展示（影片依步驟顯示提示詞）</div>
        <ol className="lp-steps">
          {course.steps.map((s, i) => (
            <li key={s.title}>
              <div className="lp-step-head">
                <span className="lp-step-num">{i + 1}</span>
                <strong>{s.title}</strong>
              </div>
              {s.prompt ? (
                <div className="lp-prompt">
                  <pre>{s.prompt}</pre>
                  <CopyButton text={s.prompt} />
                </div>
              ) : (
                <p className="lp-noprompt">介面操作，沒有提示詞</p>
              )}
              <p className="lp-expected">
                <strong>預期結果：</strong>
                {s.expected}
              </p>
              {s.note && (
                <p className="lp-note">
                  <strong>注意：</strong>
                  {s.note}
                </p>
              )}
            </li>
          ))}
        </ol>

        <div className="sub-label">影片切分（每課第一支以「目標 → 步驟拆解」開場）</div>
        <table className="lp-video-table">
          <tbody>
            {course.videos.map((v, i) => (
              <tr key={v.title}>
                <td className="nowrap lp-video-code">
                  {course.id}-{i + 1}
                </td>
                <td>
                  <strong>{v.title}</strong>
                  <div className="small lp-wrap">
                    {i === 0 ? '目標、步驟拆解 → ' : ''}展示{stepRange(v.steps)} → {v.wrap}
                  </div>
                </td>
                <td className="nowrap small">約 {v.minutes} 分</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="lp-grid">
          <div>
            <div className="sub-label">產出</div>
            <p className="lp-text">{course.deliverable}</p>
            <div className="sub-label">完成檢核</div>
            <List items={course.checkpoint} />
          </div>
          <div>
            <div className="sub-label">學員需要的素材</div>
            <List items={course.materials} />
            {course.tryYourOwn && (
              <>
                <div className="sub-label">換成自己的資料</div>
                <p className="lp-text">{course.tryYourOwn}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}

function ProductionSection({ plan, mods }: { plan: ProductionPlan; mods: Module[] }) {
  const batchOf = (code: string) => plan.order.find((b) => b.lessons.includes(code))?.batch ?? '—'
  const rows = mods.flatMap((m) =>
    m.lessons.map((l, i) => ({ code: l.course?.id ?? `${m.num}.${i + 1}`, lesson: l, course: l.course })),
  )
  return (
    <>
      <h2>製作規劃</h2>
      <p className="lead">
        影片不錄製，全部用即時教學畫面製作（做法與研究見<Link to="/proposal/visuals">即時教學影像</Link>，畫面可在
        <Link to="/proposal/visuals/preview">預覽頁</Link>檢查）。狀態只記到實際完成的程度：「腳本完成」指已有即時教學畫面腳本、課程頁可以播放。
      </p>

      <section className="card">
        <div className="card-head">
          <h3>各課製作狀態</h3>
        </div>
        <div className="table-scroll">
          <table className="lesson-table">
            <thead>
              <tr>
                <th>課</th>
                <th className="nowrap">步驟／影片</th>
                <th className="nowrap">製作順序</th>
                <th className="nowrap">狀態</th>
                <th className="nowrap">下一步</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td>
                    <strong>
                      {r.code} {r.lesson.title}
                    </strong>
                  </td>
                  <td className="nowrap small">{r.course ? `${r.course.steps.length} 步 · ${r.course.videos.length} 支 · ${videoMinutes(r.course)} 分` : '—'}</td>
                  <td className="nowrap small">{batchOf(r.code)}</td>
                  <td>
                    <span className={`chip ${r.lesson.status === '腳本完成' ? 'done' : 'todo'}`}>{r.lesson.status ?? '發想'}</span>
                  </td>
                  <td className="small">{r.lesson.next ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>製作順序</h3>
        </div>
        <div className="table-scroll">
          <table className="lesson-table">
            <thead>
              <tr>
                <th className="nowrap">批次</th>
                <th className="nowrap">課</th>
                <th>理由</th>
              </tr>
            </thead>
            <tbody>
              {plan.order.map((b) => (
                <tr key={b.batch}>
                  <td className="nowrap">
                    <strong>{b.batch}</strong>
                  </td>
                  <td className="nowrap small">{b.lessons.join('、')}</td>
                  <td className="small">{b.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>需要準備的素材</h3>
        </div>
        <div className="table-scroll">
          <table className="lesson-table">
            <thead>
              <tr>
                <th>素材</th>
                <th className="nowrap">用在</th>
                <th>內容</th>
              </tr>
            </thead>
            <tbody>
              {plan.assets.map((a) => (
                <tr key={a.name}>
                  <td>
                    <strong>{a.name}</strong>
                  </td>
                  <td className="nowrap small">{a.usedIn}</td>
                  <td className="small">{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>已做的設計決定</h3>
        </div>
        <div className="table-scroll">
          <table className="lesson-table">
            <thead>
              <tr>
                <th>決定</th>
                <th>理由</th>
              </tr>
            </thead>
            <tbody>
              {plan.decisions.map((d) => (
                <tr key={d.decision}>
                  <td>
                    <strong>{d.decision}</strong>
                  </td>
                  <td className="small">{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ModuleCard({ mod }: { mod: Module }) {
  const planned = mod.lessons.some((l) => l.course)
  return (
    <section className="card">
      <div className="card-head">
        <div className="head-left">
          <span className="head-num">{mod.num}</span>
          <div>
            <h3>{mod.title}</h3>
            <div className="meta">
              {mod.lessons.length} 課 · {mod.length}
            </div>
          </div>
        </div>
        <div className="chips">
          <span className="chip todo">{planned ? '大綱完成' : '發想'}</span>
        </div>
      </div>
      <p className="why">
        <strong>設計理由：</strong>
        {mod.why}
      </p>
      <div className="card-body table-scroll">
        <table className="lesson-table">
          <thead>
            <tr>
              <th>課</th>
              <th className="nowrap">時長</th>
              <th>學習目標</th>
              <th>實作成果</th>
            </tr>
          </thead>
          <tbody>
            {mod.lessons.map((l, i) => (
              <tr key={l.title}>
                <td>
                  <strong>
                    {l.course?.id ?? `${mod.num}.${i + 1}`} {l.title}
                  </strong>
                </td>
                <td className="nowrap small">{l.length}</td>
                <td className="small">{l.objective}</td>
                <td className="small">{l.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {planned && (
        <div className="lp-list">
          {mod.lessons.map(
            (l) => l.course && <LessonDetails key={l.title} lesson={l} course={l.course} />,
          )}
        </div>
      )}
    </section>
  )
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="plain-list">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function ResearchRefs() {
  return (
    <section className="card">
      <table>
        <tbody>
          {RESEARCH_REFS.map((r) => (
            <tr key={r.to}>
              <td className="nowrap">
                <Link to={r.to}>{r.label}</Link>
              </td>
              <td className="small">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** L1 / L2 等級頁：定位、設計依據、大綱、（L2）環境檢查表與銜接、待辦、風險、待決定。 */
export function TierOutline({ tier }: { tier: Tier }) {
  const info = TIER_INFO[tier]
  const mods = MODULES.filter((m) => m.tier === tier)
  const questions = OPEN_QUESTIONS.filter((q) => q.tier === tier)
  const lessonCount = mods.reduce((n, m) => n + m.lessons.length, 0)
  const hours = Math.round((sumMinutes(mods) / 60) * 10) / 10
  const plans = mods.flatMap((m) => m.lessons.flatMap((l) => (l.course ? [l.course] : [])))
  const stepCount = plans.reduce((n, p) => n + p.steps.length, 0)
  const promptCount = plans.reduce((n, p) => n + p.steps.filter((s) => s.prompt).length, 0)
  const videoCount = plans.reduce((n, p) => n + p.videos.length, 0)
  const videoTotal = plans.reduce((n, p) => n + videoMinutes(p), 0)
  // 橫幅依各課的製作狀態（basicsData.ts 的 PROGRESS）推導，與「各課製作狀態」表一致
  const planned = mods.flatMap((m) => m.lessons.filter((l) => l.course))
  const scripted = planned.filter((l) => l.status === '腳本完成').length
  const banner = !planned.length
    ? '草稿／發想 · 尚未定案'
    : scripted === planned.length
      ? '腳本完成'
      : scripted
        ? `大綱完成 · ${scripted} 課腳本完成`
        : '大綱完成 · 待寫腳本'

  return (
    <>
      <span className={`chip ${scripted ? 'done' : 'todo'} draft-banner`}>{banner}</span>
      <p className="lead">
        {TIER_LABEL[tier]} · {mods.length} 個單元、{lessonCount} 課，各課估計時長加總約 {hours} 小時。
      </p>

      <h2>定位</h2>
      <section className="card">
        <table>
          <tbody>
            {info.positioning.map(([k, v]) => (
              <tr key={k}>
                <td className="nowrap" style={{ width: '8em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>設計依據</h2>
      <section className="card">
        <div className="card-body">
          <List items={info.rationale} />
        </div>
      </section>

      <h2>大綱：單元 → 課</h2>
      <div className="flow" aria-label="單元進程">
        {mods.map((m, i) => (
          <span key={m.num} style={{ display: 'contents' }}>
            <span className="step">
              {m.num} {m.title}
            </span>
            {i < mods.length - 1 && <i>→</i>}
          </span>
        ))}
      </div>
      <p className="lead" style={{ fontSize: 13 }}>
        {plans.length
          ? `每課固定「目標 → 步驟拆解 → 實際操作展示」。共 ${stepCount} 個步驟（${promptCount} 段可複製的提示詞）、${videoCount} 支影片約 ${videoTotal} 分鐘。展開各課可看步驟、提示詞與影片切分。`
          : '每課約 30 分鐘，預計拆成 3–4 支 6–9 分鐘的影片，以「實作成果」欄的小練習收尾。'}
        單元編號 0–8 跨 L0／L1／L2 連續編排。
      </p>
      {mods.map((m) => (
        <ModuleCard key={m.num} mod={m} />
      ))}

      {info.production && <ProductionSection plan={info.production} mods={mods} />}

      {tier === 'L2' && (
        <>
          <h2>環境檢查表</h2>
          <p className="lead">單元 5 安裝、單元 8 總檢查時使用；也可作為 L3 開課前的環境確認。</p>
          {CHECKLIST.map((os) => (
            <section className="card" key={os.os}>
              <div className="card-head">
                <h3>{os.os}</h3>
              </div>
              <div className="table-scroll">
                <table className="lesson-table">
                  <thead>
                    <tr>
                      <th>工具</th>
                      <th>用途</th>
                      <th>驗證</th>
                      <th>常見問題</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.rows.map((r) => (
                      <tr key={r.tool}>
                        <td>
                          <strong>{r.tool}</strong>
                        </td>
                        <td className="small">{r.why}</td>
                        <td className="cmd">{r.verify}</td>
                        <td className="small">{r.pitfalls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <h2>與 L3 的銜接對照</h2>
          <p className="lead">
            L3 先備條件取自 <Link to="/docs/course-goals">課程目標</Link>（上課前的準備）。
          </p>
          <section className="card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>L3 要求</th>
                  <th>L2 涵蓋</th>
                  <th>狀態</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                {BRIDGE.map((b) => (
                  <tr key={b.need}>
                    <td>{b.need}</td>
                    <td className="small">{b.covered}</td>
                    <td>
                      <span className={`chip ${b.status}`}>{b.status === 'done' ? '已涵蓋' : '有落差'}</span>
                    </td>
                    <td className="small">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <h2>待辦</h2>
      <section className="card">
        <div className="card-body">
          <List items={info.todos} />
        </div>
      </section>

      <h2>風險</h2>
      <section className="card">
        <div className="card-body">
          <List items={info.risks} />
        </div>
      </section>

      <h2>待決定</h2>
      <div className="note">
        <ul style={{ margin: 0 }}>
          {questions.map((q) => (
            <li key={q.title}>
              <strong style={{ display: 'inline' }}>{q.title}</strong>：{q.body}
            </li>
          ))}
        </ul>
      </div>

      <h2>參考研究</h2>
      <ResearchRefs />
    </>
  )
}
