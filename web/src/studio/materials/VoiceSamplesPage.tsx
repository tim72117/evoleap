import { useEffect, useState } from 'react'
import { ProposalLayout } from '../proposal/ProposalLayout'
import ui from '../proposal/proposal.module.css'

// 試聽語音:列出 web/recordings/voice-samples/ 底下的 mp3(npm run voice -- --sample 的輸出),每個加播放器。
// 檔案只在本機(recordings/ 不進版控),由開發站的 /__studio/voice-samples 提供,所以只有本機開發站看得到。

type Sample = { path: string; bytes: number; mtime: number }

const BASE = '/__studio/voice-samples/'
const groupOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(根目錄)')

export function VoiceSamplesPage() {
  const [files, setFiles] = useState<Sample[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void fetch(BASE)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { files: Sample[] }) => setFiles(d.files))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const groups = new Map<string, Sample[]>()
  for (const f of files ?? []) groups.set(groupOf(f.path), [...(groups.get(groupOf(f.path)) ?? []), f])

  return (
    <ProposalLayout title="試聽語音" footer="研發基地 · 試聽檔在 web/recordings/voice-samples/（不進版控）">
      <h1>試聽語音</h1>
      <p className={ui.lead}>試聽檔只存在這台電腦（web/recordings/ 不進 git，也不會部署）。下面是產生語音的步驟。</p>
      <section className={ui.card}>
        <div className={ui['card-head']}>
          <div className={ui['head-left']}>
            <h3>語音產生指引</h3>
          </div>
        </div>
        <div className={ui['card-body']}>
          <p className={ui['kv-lead']}><strong>前置：</strong>環境變數 GEMINI_API_KEY（或寫在 web/.env.local），上傳用本機 gcloud 登入身分。以下指令都在 web/ 執行。</p>
          <p className={ui['kv-lead']}><strong>1. 試聽不同聲音</strong>（輸出到 recordings/voice-samples/，重新整理本頁就會出現）：</p>
          <pre><code>npm run voice -- --sample "一句旁白" --voices Charon,Kore,Orus --profile news</code></pre>
          <p className={ui['kv-lead']}>
            語氣設定檔 <code>--profile</code>：<code>default</code>（教學，預設 Sulafat）、<code>kids</code>（兒童，活潑）、<code>showcase</code>（行銷展示，預設 Zephyr）、
            <code>news</code>（科技新聞播報，沉穩俐落）。可試聽的聲音如 Charon、Kore、Orus、Sadaltager、Schedar、Zephyr、Aoede、Puck、Sulafat。
          </p>
          <p className={ui['kv-lead']}><strong>2. 在腳本指定語氣與聲音</strong>（腳本頂層，位於 web/src/content/live/ 底下）：</p>
          <pre><code>{'"voice": { "profile": "news", "voice": "Charon" }'}</code></pre>
          <p className={ui['kv-lead']}>profile 決定語氣；<code>voice</code>、<code>style</code>、<code>model</code> 可再覆寫。沒寫時 kids/ 底下用兒童版，其他用預設。</p>
          <p className={ui['kv-lead']}><strong>3. 產生整份腳本的旁白</strong>（每個 step 的 narration 一段；沒改過的段落不會重複計費）：</p>
          <pre><code>npm run voice -- promo/檔名.json</code></pre>
          <p className={ui['kv-lead']}>
            結果寫進腳本旁的 <code>.voice.json</code>（旁白文字 → 音檔與毫秒數，進版控），mp3 放在 GCS shuttle-voice；舞台依毫秒數排時間。只想先試開頭可加 <code>--limit 10</code> 或 <code>--max-sec 20</code>；
            大量課程用 <code>--batch</code> 送批次（約半價，之後 <code>--collect</code> 收回）。換聲音或語氣後重跑即可，舊音檔不會被刪。
          </p>
          <p className={ui['kv-lead']}><strong>4. 錄成影片</strong>（有 .voice.json 時旁白會混進音軌）：</p>
          <pre><code>npm run record:live -- promo/檔名.json --aspect portrait</code></pre>
          <p className={ui['kv-lead']}>完整說明見 web/scripts/voice.mjs 檔頭。</p>
        </div>
      </section>
      {error && <p className={ui.lead}>讀不到試聽檔（只有本機開發站提供）：{error}</p>}
      {!files && !error && <p className={ui.lead}>讀取中…</p>}
      {files && !files.length && <p className={ui.lead}>web/recordings/voice-samples/ 底下還沒有 mp3。</p>}
      {[...groups].map(([group, items]) => (
        <section className={ui.card} key={group}>
          <div className={ui['card-head']}>
            <div className={ui['head-left']}>
              <div>
                <h3>{group}</h3>
                <div className={ui.meta}>{items.length} 個檔案</div>
              </div>
            </div>
          </div>
          <div className={ui['card-body']}>
            {items.map((f) => (
              <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
                <span style={{ minWidth: 220 }}>{f.path.slice(group.length + 1) || f.path}</span>
                <audio controls preload="none" src={BASE + f.path.split('/').map(encodeURIComponent).join('/')} data-testid="voice-sample" />
                <span className={ui.meta}>{Math.round(f.bytes / 1024)} KB · {new Date(f.mtime).toLocaleString('zh-TW')}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </ProposalLayout>
  )
}
