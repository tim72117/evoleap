import { useState } from 'react'
import styles from './practice.module.css'

// 序章練習:同一件事「把首頁標題改成小森烘焙」,左邊是聊天式 AI(每一步都要自己動手),右邊是 AI Agent(說一句就做完)。
// 左邊故意讓第一次貼上少了結尾,要學員自己發現畫面壞掉、再回去問,感受「手還是你的」。

const GOOD = '<h1>小森烘焙</h1>'
const BAD = '<h1>小森烘焙'

export function IntroCompare() {
  const [taps, setTaps] = useState(0)
  const [reply, setReply] = useState<'none' | 'bad' | 'good'>('none')
  const [clip, setClip] = useState('')
  const [editor, setEditor] = useState('')
  const [saved, setSaved] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const [agent, setAgent] = useState<string[]>([])

  const tap = (fn: () => void) => () => { setTaps((n) => n + 1); fn() }
  const asked = reply !== 'none'
  const broken = shown !== null && shown !== GOOD

  const reset = () => { setTaps(0); setReply('none'); setClip(''); setEditor(''); setSaved(''); setShown(null); setAgent([]) }
  const runAgent = () => {
    setAgent(['讀取 index.html', '修改標題 → 小森烘焙', '開啟瀏覽器檢查：標題正確 ✓', '完成。動手前有問你，你按了允許。'])
  }

  return (
    <div className={styles.compare}>
      <section aria-label="聊天式 AI">
        <header><strong>聊天式 AI</strong><span className={styles.badge}>你動手 {taps} 次</span><button type="button" className={styles.link} onClick={reset}>重來</button></header>
        <div className={styles.steps}>
          <div>
            <span>① 在聊天視窗問</span>
            <button type="button" onClick={tap(() => { setReply(reply === 'none' ? 'bad' : 'good') })}>{asked ? '把錯誤貼回去問' : '問：把首頁標題改成小森烘焙'}</button>
            {asked && <pre>{reply === 'bad' ? BAD : GOOD}</pre>}
          </div>
          <div>
            <span>② 複製程式碼</span>
            <button type="button" disabled={!asked} onClick={tap(() => setClip(reply === 'bad' ? BAD : GOOD))}>複製</button>
          </div>
          <div>
            <span>③ 貼到編輯器</span>
            <button type="button" disabled={!clip} onClick={tap(() => setEditor(clip))}>貼上</button>
            <pre className={styles.editor}>{editor || '(編輯器是空的)'}</pre>
          </div>
          <div>
            <span>④ 存檔</span>
            <button type="button" disabled={!editor} onClick={tap(() => setSaved(editor))}>存檔</button>
          </div>
          <div>
            <span>⑤ 到瀏覽器重新整理，自己檢查</span>
            <button type="button" disabled={!saved} onClick={tap(() => setShown(saved))}>重新整理</button>
            <div className={styles.browser}>
              {shown === null ? '(還沒打開)' : broken ? <><b style={{ fontSize: 22 }}>小森烘焙</b><em>　← 後面整頁都跟著變大了，因為少了結尾標籤</em></> : <b style={{ fontSize: 22 }}>小森烘焙</b>}
            </div>
            {broken && <p className={styles.warn}>畫面不對。你得自己發現，再回到 ① 把問題貼回去問，從頭來一輪。</p>}
            {shown === GOOD && <p className={styles.ok}>終於對了。一個小改動，你動手了 {taps} 次。</p>}
          </div>
        </div>
      </section>

      <section aria-label="AI Agent">
        <header><strong>AI Agent</strong><span className={styles.badge}>你動手 {agent.length ? 1 : 0} 次</span></header>
        <div className={styles.steps}>
          <div>
            <span>說一句話</span>
            <button type="button" onClick={runAgent} disabled={agent.length > 0}>送出：把首頁標題改成小森烘焙</button>
          </div>
          {agent.map((a, i) => (
            <div key={a} className={styles.agentStep} style={{ animationDelay: `${i * 0.25}s` }}><code>{a}</code></div>
          ))}
          {agent.length > 0 && <div className={styles.browser}><b style={{ fontSize: 22 }}>小森烘焙</b></div>}
          {agent.length > 0 && <p className={styles.ok}>讀檔、修改、存檔、打開檢查都是它做的。你要負責的是：說清楚、看懂確認提示、親眼檢查成果。</p>}
        </div>
      </section>
    </div>
  )
}
