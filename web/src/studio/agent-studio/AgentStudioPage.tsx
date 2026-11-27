import { useSearchParams } from 'react-router-dom'
import { ensureActors } from '../../live/actors/lazy'
import { useEffect, useState } from 'react'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'
import { ADULT_DEMO, KIDS_DEMO } from './demo'
import { DemoPlayer } from './DemoPlayer'
import { PlayArea } from './PlayArea'
import styles from './agentStudio.module.css'

// 開發 › 虛擬開發介面(試作):模擬「請 AI Agent 開發軟體」的過程,不接真的 AI。先用在兒童。
const TABS = [
  { id: 'play', label: '兒童：自己玩', note: '點卡片請小幫手做網頁，自己走一遍：說想法、試一試、檢查修好、存起來、分享。' },
  { id: 'kids', label: '兒童：看示範', note: '照腳本播放的示範（還沒有語音，只有字幕）。' },
  { id: 'adult', label: '成人版外觀', note: '同一個演員的另一種外觀：打字說需求、指著區塊改。目前只能看示範。' },
] as const

export function AgentStudioPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]
  // 自己玩要直接讀演員定義,所以先載入(播放器那邊由舞台自己載入)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void ensureActors(['agent-studio']).then(() => setReady(true))
  }, [])

  return (
    <ProposalLayout title="虛擬開發介面" footer="開發 · 試作（模擬環境，尚未放進課程頁）· 演員：src/live/actors/agent-studio/" wide>
      <h1>虛擬開發介面</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>試作</span>
      <p className={ui.lead}>模擬「請 AI Agent 開發軟體」的過程，不接真的 AI：小幫手照卡片寫好的做法改網頁，檢查結果依網頁內容推算。</p>
      <div className={styles.tabs} role="group" aria-label="版本">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab.id ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={t.id === tab.id} onClick={() => setParams({ tab: t.id })}>
            {t.label}
          </button>
        ))}
      </div>
      <p>{tab.note}</p>
      {!ready ? <p>載入中…</p> : tab.id === 'play' ? <PlayArea /> : <DemoPlayer key={tab.id} script={tab.id === 'kids' ? KIDS_DEMO : ADULT_DEMO} />}
    </ProposalLayout>
  )
}
