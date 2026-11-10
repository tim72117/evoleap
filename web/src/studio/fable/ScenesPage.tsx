import { Link, useSearchParams } from "react-router-dom";
import { LivePlayer } from "../../courses/LivePlayer";
import { ProposalLayout } from "../proposal/ProposalLayout";
import ui from "../proposal/proposal.module.css";
import { RULES as KID_DAY_RULES } from "../promo/actors/kid-day-scene/actor";
import { RULES as FABLE_SCENE_RULES } from "./actors/fable-scene/actor";
import { SCENES } from "./registerActors";

// 開發 › 場景:場景是把背景與前景包在一起的一層,背景依「場景狀態」自動變化,腳本只寫劇情、不用逐步同步背景。
// 目前是研發基地的試作(不改舞台引擎:場景是一位把兩層包在一起的演員,登記在 registerActors.ts 的 SCENES),
// 網址 ?scene=<名稱> 直接開某一個場景。

/** 每個場景的「狀態 → 背景」規則表(給這一頁列出來) */
const RULES: Record<string, { look: string; when: string; ms: number }[]> = {
  "fable-scene": FABLE_SCENE_RULES,
  "kid-day-scene": KID_DAY_RULES,
};

/** 每個場景的程式位置與用在哪裡(連到實際使用它的頁面) */
const WHERE: Record<
  string,
  { code: string; use: { to: string; label: string } }
> = {
  "fable-scene": {
    code: "web/src/studio/fable/actors/fable-scene/",
    use: {
      to: "/studio/fable-trial?v=scene",
      label: "從做好到上線 0.1 畫面試作（場景版）→",
    },
  },
  "kid-day-scene": {
    code: "web/src/studio/promo/actors/kid-day-scene/",
    use: {
      to: "/materials/promo?script=promo/kid-life.json&aspect=portrait",
      label: "宣傳片：孩子的一天，交給小管家（直式）→",
    },
  },
};

export function ScenesPage() {
  const [params, setParams] = useSearchParams();
  const scene = SCENES.find((s) => s.name === params.get("scene")) ?? SCENES[0];
  const rules = RULES[scene.name] ?? [];
  const where = WHERE[scene.name];
  return (
    <ProposalLayout
      title="場景"
      footer={`研發基地 · 場景在 ${where?.code ?? "web/src/studio/"}，展示腳本在 web/src/content/live/${scene.script}`}
      wide
    >
      <h1>場景</h1>
      <p className={ui.lead}>
        場景是同一個世界的背景與前景。前景的演員照腳本演劇情；背景不跟腳本逐步同步，而是依場景狀態自動變化：狀態在哪一步改變，就從那一步開始過場。只有敘事上的變化（例如天亮）才由導演指令決定。
      </p>
      <span className={`${ui.chip} ${ui.out} ${ui["draft-banner"]}`}>
        試作 · 不改舞台引擎，場景暫時是一位把兩層包在一起的演員
      </span>

      {SCENES.length > 1 && (
        <div
          role="group"
          aria-label="選擇場景"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            margin: "12px 0",
          }}
        >
          {SCENES.map((s) => (
            <button
              key={s.name}
              type="button"
              className={
                s.name === scene.name ? ui.btn : `${ui.btn} ${ui.ghost}`
              }
              aria-pressed={s.name === scene.name}
              onClick={() => setParams({ scene: s.name })}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      <h2>{scene.title}</h2>
      <p>{scene.summary}</p>
      <div className={ui["live-video"]} style={{ maxWidth: "none" }}>
        <LivePlayer
          key={scene.name}
          script={scene.script}
          title={scene.title}
          onTime={() => {}}
          saveProgress={false}
        />
      </div>

      <h2>狀態 → 背景的規則</h2>
      <section className={ui.card}>
        <p>
          寫腳本的人看這張表就知道哪些事不用自己同步。規則寫在場景裡，場景本身沒有狀態，只從演員的狀態推算，拖曳、倒轉到任何時間點畫面都一樣。
        </p>
        <table>
          <tbody>
            {rules.map((r) => (
              <tr key={r.look}>
                <td className={ui.nowrap}>
                  <code>{r.look}</code>
                </td>
                <td>{r.when}</td>
                <td className={ui.nowrap}>{r.ms / 1000} 秒過場</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {scene.name === "fable-scene" && (
        <>
          <h2>和兩位演員分開演的差別</h2>
          <section className={ui.card}>
            <ul>
              <li>
                <strong>腳本只寫劇情：</strong>原本背景要在腳本裡用{" "}
                <code>mood</code>{" "}
                逐步下指令（網路亮起、天亮），伺服器關機時光纖也不會自己暗；場景版只剩一個導演指令{" "}
                <code>sky: dawn</code>，其他都依狀態自動變化。
              </li>
              <li>
                <strong>背景讀得到前景的狀態：</strong>
                兩層在同一個場景裡，背景知道網站上線了沒、伺服器開著沒、大家打開了沒。
              </li>
              <li>
                <strong>視差：</strong>
                前景推近時，背景只推近三成、以同一個焦點縮放，做出景深。
              </li>
              <li>
                <strong>之後搬進引擎：</strong>
                讓舞台的場景層讀所有演員的狀態，就不用把演員包在一起（記在即時教學影像頁的「引擎優化構想」）。
              </li>
            </ul>
          </section>
        </>
      )}

      {where && (
        <>
          <h2>用在哪裡</h2>
          <p>
            <Link className={`${ui.btn} ${ui.ghost}`} to={where.use.to}>
              {where.use.label}
            </Link>
          </p>
        </>
      )}
    </ProposalLayout>
  );
}
