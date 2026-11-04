import { Link } from 'react-router-dom'
import { L1_IDEAS } from './l1Ideas'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// L1 構想區：還沒排進 L1 課程的構想。選題條件見生活小工具頁的「設計依據」。
export function L1IdeasPage() {
  return (
    <ProposalLayout title="L1 構想區" footer="資料：src/studio/proposal/l1Ideas.ts">
      <h1>L1 · 構想區</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>構想 · 待評估</span>
      <p className={ui.lead}>
        還沒排進 L1 課程的構想，目前都來自 <Link to="/studio/life-tools">生活小工具</Link>{' '}
        的選題：需要外部函式庫、結果難以驗證、或和已選的課重複的工具先放在這裡。要排進課程時，移到 src/content/l1Tools/。
      </p>

      <section className={`${ui.card} ${ui['table-scroll']}`}>
        <table className={ui['lesson-table']}>
          <thead>
            <tr>
              <th>構想</th>
              <th>情境</th>
              <th>會用到的能力</th>
              <th>先放構想區的原因</th>
              <th>可能的去向</th>
            </tr>
          </thead>
          <tbody>
            {L1_IDEAS.map((x) => (
              <tr key={x.title}>
                <td className={ui.nowrap}>
                  <strong>{x.title}</strong>
                </td>
                <td className={ui.small}>{x.scenario}</td>
                <td className={ui.small}>{x.capability}</td>
                <td className={ui.small}>{x.reason}</td>
                <td className={ui.small}>{x.fate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </ProposalLayout>
  )
}
