import { useState } from 'react'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { AgentSandbox } from './AgentSandbox'
import { IntroCompare } from './IntroCompare'
import { SiteSandbox } from './SiteSandbox'
import { dir, file } from './sim'

// 開發 › 動手練習:起步階段(courses/software)可以自由操作介面的練習試作。
// 現有課程的互動點是「選一個選項」;這裡改成自己打字、點選、拖曳,畫面即時回應。全部是模擬環境(規則比對),不接真的 AI。

const L0_ROOT = dir({
  Documents: dir({ practice: dir(), 報價單草稿: dir({ 'quote.xlsx': file('(重要的檔案)') }) }),
})

const L1_ROOT = dir({
  Documents: dir({
    practice: dir({ bakery: dir() }),
    桌面: dir({ '首頁.html': file('v1'), '首頁-新.html': file('v2'), '首頁-最終.html': file('v3') }),
  }),
})

const TABS = [
  { id: 'intro', label: '序章 · 聊天式 AI vs Agent', note: '同一件小事,左邊每一步都要你動手,右邊說一句就做完。' },
  { id: 'l0', label: '第 1 課 · 確認提示', note: '自己下指令,AI 動手前會問你。試試允許、拒絕、刪除,也試試切到「自動允許」。' },
  { id: 'l1', label: '第 2 課 · 工作目錄', note: '點資料夾上的「在這裡開啟工具」,換工作目錄;點檔案看相對路徑;把檔案拖到資料夾就是移動。' },
  { id: 'l2', label: '第 3 課 · 需求與預覽', note: '先送出模糊的需求,再送出清楚的;點預覽區塊指名要改哪裡;拖寬度看手機版。' },
] as const

export function PracticePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('l0')
  const cur = TABS.find((t) => t.id === tab)!
  return (
    <ProposalLayout title="動手練習" footer="開發 · 試作(模擬環境,尚未放進課程頁)" wide>
      <h1>開發 · 動手練習</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>試作</span>
      <p className={ui.lead}>起步課四課各一個「自由操作」的練習。不問答、沒有分數:想怎麼試都行,做錯會看到後果,「重來」可以還原。AI 的部分是規則比對(只聽得懂建立、改名、移動、刪除、讀取等幾種說法),聽不懂會提示。</p>
      <div className={ui.links} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} className={`${ui.btn} ${t.id === tab ? '' : ui.ghost}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p>{cur.note}</p>
      {tab === 'intro' && <IntroCompare />}
      {tab === 'l0' && <AgentSandbox key="l0" initialRoot={L0_ROOT} initialCwd="/Documents/practice" modeToggle hints={['建立 hello.txt，寫一句問候', '建立一個檔案', '刪除 hello.txt', '列出檔案', '刪除 ../報價單草稿/quote.xlsx']} />}
      {tab === 'l1' && <AgentSandbox key="l1" initialRoot={L1_ROOT} initialCwd="/Documents/practice/bakery" cwdPickable hints={['目前的工作目錄是哪裡？', '產生網頁專案基本檔案：index.html 和 styles.css', '在 drafts/idea.txt 記下：首頁要有預約按鈕', '把 drafts/idea.txt 改名為 homepage-idea.txt，移到 notes 資料夾', '刪除空的 drafts 資料夾', '列出檔案']} />}
      {tab === 'l2' && <SiteSandbox />}
    </ProposalLayout>
  )
}
