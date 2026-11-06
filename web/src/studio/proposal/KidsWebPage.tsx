import { Link } from 'react-router-dom'
import { KIDS_COMPONENTS, KIDS_DEMOS, KIDS_OPEN, KIDS_POSITIONING, KIDS_PRINCIPLES, KIDS_UNITS } from './kidsWeb'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 課程：給 9 歲孩子的網頁程式設計基礎課。資料在 kidsWeb.ts。

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

export function KidsWebPage() {
  const lessonCount = KIDS_UNITS.reduce((n, u) => n + u.lessons.length, 0)
  return (
    <ProposalLayout title="兒童網頁課" footer="課程 · 資料：src/studio/proposal/kidsWeb.ts">
      <h1>兒童網頁課 · 給孩子的網頁程式設計</h1>
      <span className={`${ui.chip} ${ui.out} ${ui['draft-banner']}`}>大綱草稿 · 待評估</span>
      <p className={ui.lead}>
        讓 9 歲的孩子看懂網頁怎麼運作、說得出正確的名詞，最後能把目標說清楚、請 AI 幫忙做出來；不教語法，每課都讓孩子自己動手。共 {KIDS_UNITS.length} 個單元、
        {lessonCount} 課（暫定）。
      </p>

      <h2>定位</h2>
      <section className={ui.card}>
        <Pairs items={KIDS_POSITIONING} />
      </section>

      <h2>設計原則</h2>
      <section className={ui.card}>
        <Pairs items={KIDS_PRINCIPLES} />
      </section>

      <h2>課程大綱</h2>
      {KIDS_UNITS.map((unit) => (
        <section key={unit.id} className={ui.card}>
          <h3>{unit.title}</h3>
          <p>
            <strong>比喻：</strong>
            {unit.metaphor}
          </p>
          <ul>
            {unit.lessons.map((l) => (
              <li key={l.id}>
                <strong>
                  {l.id}　{l.title}
                </strong>
                {KIDS_DEMOS[l.id] && (
                  <>
                    {' '}
                    <Link to={KIDS_DEMOS[l.id]}>看試做 →</Link>
                  </>
                )}
                <br />
                看：{l.show}
                <br />
                做：{l.try}
                <br />
                學會：{l.learn}
                <br />
                名詞：{l.words.join('、')}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>展示與互動的元件</h2>
      <section className={ui.card}>
        <ul>
          {KIDS_COMPONENTS.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong>（{c.status}）：{c.use}
            </li>
          ))}
        </ul>
      </section>

      <h2>待決定</h2>
      <section className={ui.card}>
        <Pairs items={KIDS_OPEN} />
      </section>
    </ProposalLayout>
  )
}
