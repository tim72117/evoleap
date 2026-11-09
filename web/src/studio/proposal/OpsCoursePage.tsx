import { OPS_OPEN, OPS_PITCH, OPS_POSITIONING, OPS_UNITS } from './opsCourse'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 構想：主題「從上線到維運」。資料在 opsCourse.ts。

/** 「名稱：說明」的直向清單,手機上也不會擠成窄欄 */
function Pairs({ items }: { items: [string, string][] }) {
  return (
    <ul>
      {items.map(([k, v]) => (
        <li key={k}>
          <strong>{k}</strong>：{v}
        </li>
      ))}
    </ul>
  )
}

export function OpsCoursePage() {
  const lessonCount = OPS_UNITS.reduce((n, u) => n + u.lessons.length, 0)
  return (
    <ProposalLayout title="從上線到維運" footer="構想 · 資料：src/studio/proposal/opsCourse.ts">
      <h1>構想 · 從上線到維運</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>大綱草稿 · 待評估</span>
      <p className={ui.lead}>接在「從做好到上線」之後，讓上線的服務長期穩定地運作。共 {OPS_UNITS.length} 段、{lessonCount} 課（暫定）。</p>

      <h2>課程說明</h2>
      <section className={ui.card}>
        {OPS_PITCH.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <h2>定位</h2>
      <section className={ui.card}>
        <Pairs items={OPS_POSITIONING} />
      </section>

      <h2>課程大綱</h2>
      {OPS_UNITS.map((unit) => (
        <section key={unit.id} className={ui.card}>
          <h3>{unit.title}</h3>
          <p>
            <strong>這個單元回答：</strong>
            {unit.question}
          </p>
          <ul>
            {unit.lessons.map((l) => (
              <li key={l.id}>
                <strong>
                  {l.id}　{l.title}
                </strong>
                <br />
                學會：{l.learn}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>待決定</h2>
      <section className={ui.card}>
        <Pairs items={OPS_OPEN} />
      </section>
    </ProposalLayout>
  )
}
