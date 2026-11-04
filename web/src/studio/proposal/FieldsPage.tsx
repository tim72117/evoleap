import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ProposalLayout } from './ProposalLayout'
import { charCount, useCopy } from '../../site/useCopy'
import ui from './proposal.module.css'

const TITLE = '打造你的第一個 AI Agent 整合應用'

const DESC =
  '跟著真實開源專案，打造一個用自然語言操作的 AI 助理：讓使用者打字問問題，Agent 自動判讀問題、跑分析、繪製合適的統計圖表，做出一個能上線的整合應用。'

const AUDIENCE = `這堂課適合：
- 具備 JavaScript/TypeScript 基礎、想把 LLM 工具呼叫（tool calling）整合進自己產品的前端或全端工程師
- 想了解 AI Agent 如何「真正動手做事」而不只是聊天機器人的開發者
- 需要在工作中評估或導入 AI Agent 整合方案的技術主管
- 想徹底搞懂工具呼叫（tool calling）的底層原理，學完後能快速為自己的產品打造自然語言驅動介面的學員

這堂課較不適合：
- 完全沒有 Web 開發經驗、不熟悉 JavaScript 基礎語法的初學者
- 想學習 LLM 模型訓練或底層原理的學員（本課程專注在應用整合層，不涉及模型訓練）`

const OUTCOMES = `完成這堂課後，你將能夠：
- 把一個操作畫面改造成「打字就能用」的自然語言介面，讓 AI 自動理解使用者的問題、選對工具並執行
- 設計一個 LLM 可呼叫的工具介面，寫出 LLM 能準確理解、正確呼叫的參數 Schema
- 最終獨立完成一個涵蓋多種工具類型、並已上線的完整 AI Agent 整合應用（期末專案）
- 掌握工具呼叫的共通設計邏輯，這套能力能直接用來快速打造自然語言驅動的介面，不被單一工具綁住`

const TOOLS = `- 電腦（Mac / Windows / Linux 皆可）與終端機（Terminal）
- Git（版本控制）
- Node.js（建議 LTS 版本）與 npm
- Docker（用於部署單元的實作練習）
- 一個可用的程式碼編輯器（建議 VS Code）
- Claude Code（課程採 Vibe Coding 方式實作，會用 AI 輔助寫程式）
- onagent 帳號與 API key（課程中會引導註冊）`

const PREREQ = `- 熟悉 JavaScript / TypeScript 基本語法與基礎 Web 前端開發（DOM、fetch/WebSocket、npm 套件管理）
- 會使用終端機與 Git 進行基本版本控制操作
- 不需要具備機器學習或 LLM 模型訓練相關背景知識`

function CopyButton({ text, label = '複製' }: { text: string; label?: string }) {
  const { state, copy } = useCopy()
  const shown = state === 'copied' ? '已複製 ✓' : state === 'failed' ? '複製失敗，請手動選取' : label
  return (
    <button type="button" className={state === 'copied' ? `${ui.copy} ${ui.copied}` : ui.copy} onClick={() => copy(text)}>
      {shown}
    </button>
  )
}

function Count({ text, max }: { text: string; max?: number }) {
  const n = charCount(text)
  return <span className={ui.count}>{max ? `${n} 字 / ${max}` : `${n} 字`}</span>
}

function FieldCard({
  title,
  meta,
  chip,
  chipClass,
  children,
  foot,
}: {
  title: string
  meta?: string
  chip: string
  chipClass: 'done' | 'todo'
  children: ReactNode
  foot?: ReactNode
}) {
  return (
    <section className={ui.card}>
      <div className={ui['card-head']}>
        <div>
          <h3>{title}</h3>
          {meta && <div className={ui.meta}>{meta}</div>}
        </div>
        <span className={`${ui.chip} ${ui[chipClass]}`}>{chip}</span>
      </div>
      <div className={ui['card-body']}>{children}</div>
      {foot && <div className={ui['card-foot']}>{foot}</div>}
    </section>
  )
}

export function FieldsPage() {
  return (
    <ProposalLayout title="L3 提案內容" footer="web/src/studio/proposal/FieldsPage.tsx">
      <h1>提案內容</h1>
      <p className={ui.lead}>
        整理課程平台「標題與封面」「課程目標」兩頁需要的欄位。每欄右下角按「複製」就能貼進平台的表單。
      </p>

      <h2>標題與封面頁</h2>

      <FieldCard
        title="課程標題"
        meta="上限 40 字"
        chip="已定稿"
        chipClass="done"
        foot={
          <>
            <Count text={TITLE} max={40} />
            <CopyButton text={TITLE} />
          </>
        }
      >
        <div className={ui.text}>{TITLE}</div>
      </FieldCard>

      <FieldCard title="封面圖" meta="長形 1000×620、方形 800×800" chip="待上傳" chipClass="todo">
        兩種尺寸的封面見{' '}
        <Link to="/studio/ai-agent/cover" style={{ color: 'var(--accent)' }}>
          封面圖
        </Link>{' '}
        頁。
      </FieldCard>

      <h2>課程目標頁</h2>

      <FieldCard
        title="課程描述"
        meta="建議約 64 字"
        chip="已定稿"
        chipClass="done"
        foot={
          <>
            <Count text={DESC} />
            <CopyButton text={DESC} />
          </>
        }
      >
        <div className={ui.text}>{DESC}</div>
      </FieldCard>

      <FieldCard title="哪些人適合這堂課？" chip="已定稿" chipClass="done" foot={<CopyButton text={AUDIENCE} />}>
        <div className={ui.text}>{AUDIENCE}</div>
      </FieldCard>

      <FieldCard title="你可以學到" chip="已定稿" chipClass="done" foot={<CopyButton text={OUTCOMES} />}>
        <div className={ui.text}>{OUTCOMES}</div>
      </FieldCard>

      <FieldCard
        title="上課前的準備"
        meta="工具／軟體與背景知識分兩欄填入"
        chip="待定稿"
        chipClass="todo"
        foot={
          <>
            <CopyButton text={TOOLS} label="複製工具／軟體" />
            <CopyButton text={PREREQ} label="複製背景知識" />
          </>
        }
      >
        <div className={ui['sub-label']}>(1) 需要準備的工具 / 軟體</div>
        <div className={ui.text}>{TOOLS}</div>
        <div className={ui['sub-label']}>(2) 需要具備的背景知識</div>
        <div className={ui.text}>{PREREQ}</div>
      </FieldCard>

      <div className={ui.note}>
        <strong>待確認</strong>
        工具清單裡的「Docker（用於部署單元的實作練習）」與「onagent 帳號與 API key」，是依較早的課程架構寫的。部署單元已不在目前範圍內，這兩項是否保留，請決定後我再改。
      </div>
    </ProposalLayout>
  )
}
