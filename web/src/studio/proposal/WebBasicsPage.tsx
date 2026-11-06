import { Link } from 'react-router-dom'
import { WEB_COMPONENTS, WEB_DEMOS, WEB_OPEN, WEB_PITCH, WEB_POSITIONING, WEB_PRINCIPLES, WEB_UNITS } from './webBasics'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 構想：給大人的「網頁運作知識」獨立課程。資料在 webBasics.ts。

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

export function WebBasicsPage() {
  const lessonCount = WEB_UNITS.reduce((n, u) => n + u.lessons.length, 0)
  return (
    <ProposalLayout title="網頁運作知識" footer="獨立課程構想 · 資料：src/studio/proposal/webBasics.ts">
      <h1>構想 · 網頁怎麼運作</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>架構草稿 · 待評估</span>
      <p className={ui.lead}>
        AI 時代的網頁基礎課：語法交給 AI，你要懂的是網頁怎麼運作。共 {WEB_UNITS.length} 個單元、{lessonCount} 課（暫定）。
      </p>

      <h2>課程說明</h2>
      <section className={ui.card}>
        {WEB_PITCH.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <h2>定位</h2>
      <section className={ui.card}>
        <Pairs items={WEB_POSITIONING} />
      </section>

      <h2>設計原則</h2>
      <section className={ui.card}>
        <Pairs items={WEB_PRINCIPLES} />
      </section>

      <h2>課程大綱</h2>
      {WEB_UNITS.map((unit) => (
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
                {WEB_DEMOS[l.id] && (
                  <>
                    {' '}
                    <Link to={WEB_DEMOS[l.id]}>看試做 →</Link>
                  </>
                )}
                <br />
                看：{l.show}
                <br />
                做：{l.try}
                <br />
                學會：{l.learn}
                <br />
                名詞：{l.terms.join('、')}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>展示與互動的元件</h2>
      <section className={ui.card}>
        <ul>
          {WEB_COMPONENTS.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong>（{c.status}）：{c.use}
            </li>
          ))}
        </ul>
      </section>

      <h2>待決定</h2>
      <section className={ui.card}>
        <Pairs items={WEB_OPEN} />
      </section>
    </ProposalLayout>
  )
}
