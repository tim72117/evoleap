import { STUDIO_DATA } from '../studioData'
import type { AiScenariosData } from './aiScenarios'
import { WithStudioData } from './WithStudioData'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// AI 自動化情境清單：之後決定主題時，從這裡挑情境組合成單元。
const FOOTER = '資料：src/content/live/data/ai-scenarios.json（研發基地的資料，進資料庫）'

export function AiScenariosPage() {
  return (
    <WithStudioData<AiScenariosData> path={STUDIO_DATA.aiScenarios} title="AI 自動化情境" footer={FOOTER}>
      {(d) => <AiScenariosView data={d} />}
    </WithStudioData>
  )
}

function AiScenariosView({ data: { stages: SCENARIO_STAGES, themes: SCENARIO_THEMES } }: { data: AiScenariosData }) {
  const total = SCENARIO_STAGES.reduce((n, s) => n + s.scenarios.length, 0)
  return (
    <ProposalLayout title="AI 自動化情境" footer={FOOTER}>
      <h1>AI 自動化情境清單</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待選主題</span>
      <p className={ui.lead}>
        開發、偵錯、部署、營運、行銷過程中，原本繁雜或困難、可以交給 AI 自動處理的情境，共 {total} 項。還沒排進任何課程；之後決定主題時，從這裡挑情境組合成單元。「本站實例」是做這個網站時實際遇過的，可以直接當教材。
      </p>

      {SCENARIO_STAGES.map((stage) => (
        <section key={stage.id} id={stage.id}>
          <h2>
            {stage.title}（{stage.scenarios.length}）
          </h2>
          <div className={`${ui.card} ${ui['table-scroll']}`}>
            <table className={ui['lesson-table']}>
              <thead>
                <tr>
                  <th>情境</th>
                  <th>原本難在哪</th>
                  <th>AI 自動處理</th>
                  <th>本站實例</th>
                </tr>
              </thead>
              <tbody>
                {stage.scenarios.map((x) => (
                  <tr key={x.title}>
                    <td>
                      <strong>{x.title}</strong>
                    </td>
                    <td className={ui.small}>{x.hard}</td>
                    <td className={ui.small}>{x.ai}</td>
                    {/* 窄螢幕表格排成卡片,沒有實例時留空格,不顯示佔位符號 */}
                    <td className={ui.small}>{x.ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2>可以先組的主題（建議）</h2>
      {SCENARIO_THEMES.map((t) => (
        <section className={ui.card} key={t.title}>
          <div className={ui['card-head']}>
            <div className={ui['head-left']}>
              <h3>{t.title}</h3>
            </div>
          </div>
          <div className={ui['card-body']}>
            <p className={ui['kv-lead']}>{t.why}</p>
            <ul className={ui['plain-list']}>
              {t.picks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </ProposalLayout>
  )
}
