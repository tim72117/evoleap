import { AI_TIPS, AI_TIPS_DEMO, AI_TIPS_VERDICT } from './aiTips'
import { LiveVideoPreview } from './OpeningPreviewPlayer'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// AI 工具技巧構想：怎麼跟會操作檔案的 AI 工具一起工作（換裝置、分岔、接續對話等），以及是否開成新主題的評估。
export function AiTipsPage() {
  return (
    <ProposalLayout title="AI 工具技巧" footer="資料：src/studio/proposal/aiTips.ts">
      <h1>AI 工具技巧</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待評估</span>
      <p className={ui.lead}>
        跟會操作檔案的 AI 工具一起工作的技巧：換裝置接著做、分岔同時試好幾種想法等。這些是做事的方法，不是做出來的成品，先放在構想區評估要放進哪一課。
      </p>

      <h2>適不適合開新主題</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>
            <strong>建議：</strong>
            {AI_TIPS_VERDICT.decision}
          </p>
          <ul className={ui['plain-list']}>
            {AI_TIPS_VERDICT.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className={ui['kv-lead']} style={{ marginTop: 8 }}>
            符合以下條件時，再升級成首頁主題：
          </p>
          <ul className={ui['plain-list']}>
            {AI_TIPS_VERDICT.upgradeWhen.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      <h2>技巧構想</h2>
      <section className={`${ui.card} ${ui['table-scroll']}`}>
        <table className={ui['lesson-table']}>
          <thead>
            <tr>
              <th>技巧</th>
              <th>情境</th>
              <th>學會之後</th>
              <th>適合放在哪</th>
              <th>要先確認</th>
            </tr>
          </thead>
          <tbody>
            {AI_TIPS.map((x) => (
              <tr key={x.title}>
                <td className={ui.nowrap}>
                  <strong>{x.title}</strong>
                  {x.found && (
                    <div>
                      <span className={`${ui.chip} ${ui.todo}`}>實際使用時發現</span>
                    </div>
                  )}
                  {x.demo && (
                    <div>
                      <a href="#tips-demo">看舞台示範</a>
                    </div>
                  )}
                </td>
                <td className={ui.small}>{x.scenario}</td>
                <td className={ui.small}>{x.outcome}</td>
                <td className={ui.small}>{x.placement}</td>
                <td className={ui.small}>{x.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 id="tips-demo">舞台示範：{AI_TIPS_DEMO.title}</h2>
      <section className={ui.card}>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}>{AI_TIPS_DEMO.summary}</p>
          <LiveVideoPreview script={AI_TIPS_DEMO.script} title={AI_TIPS_DEMO.title} />
        </div>
      </section>
    </ProposalLayout>
  )
}
