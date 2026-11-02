import { Link } from 'react-router-dom'
import { Article, Callout, DataTable, Ext, Section, SourceList } from '../Article'

// 旁白語音(Gemini TTS)的費用評估。價格與條款查詢日期 2026-11-02;用量依 l0 即時教學腳本實測字數與課程大綱推估。
// 計算:音訊 25 token/秒;旁白每秒約 4.2 字(stage.ts speakMs 的值)。數字改動時請一併更新 DATE 與假設。

const DATE = '2026-11-02'
const PRICING = 'https://ai.google.dev/gemini-api/docs/pricing'
const RATE_LIMITS = 'https://ai.google.dev/gemini-api/docs/rate-limits'
const SPEECH = 'https://ai.google.dev/gemini-api/docs/speech-generation'
const CLOUD_TTS = 'https://cloud.google.com/text-to-speech/pricing'
const ELEVEN = 'https://elevenlabs.io/pricing/api'

type Row = [string, string, string]

const PRICES: Row[] = [
  ['gemini-3.8-flash-tts（Standard）', '輸入文字 US$0.50／百萬 token；輸出音訊 US$9.00／百萬 token（約 US$0.00225／10 秒）', '2027-01-01 起調為 US$1.00／US$18.00'],
  ['gemini-3.8-flash-lite-tts（Standard）', '輸入文字 US$0.50／百萬 token；輸出音訊 US$6.00／百萬 token（約 US$0.0015／10 秒）', '2027-01-01 起調為 US$1.00／US$12.00'],
  ['Batch／Flex（兩個模型）', '輸入、輸出都是 Standard 的一半（Flash 音訊 US$4.50、Flash-Lite 音訊 US$3.00）', '免費層級不提供'],
  ['音訊 token 換算', '每秒音訊 25 token', '定價頁註腳；Cloud TTS 定價頁相同'],
  ['中文文字的 token 數', '官方未列出', '本文假設每字 1 token；輸入費用很小，影響不大'],
]

const FREE: [string, string][] = [
  ['免費層級能否用 TTS', '可以：兩個模型的 Standard 在免費層級都標示「Free of charge」；Batch、Flex 在免費層級為「Not available」。'],
  ['資料是否用於改善產品', '免費層級「Used to improve our products：Yes」，付費層級為「No」。課程旁白是要公開的內容，用免費層級試聽影響不大；未公開的稿件建議用付費層級。'],
  ['速率限制（RPM／TPM／RPD）', '官方未列出：速率限制頁沒有這兩個模型的數字，只說明可在 Google AI Studio 查看自己專案的限制。'],
  ['輸出格式', '非串流請求回傳 WAV（24 kHz、單聲道、16-bit PCM）；轉成 MP3 是我們自己的步驟，計費只看音訊秒數。'],
  ['經 Google Cloud 使用', 'Cloud Text-to-Speech 也提供 Gemini 3.8 Flash TTS（標示 Preview），單價相同，但免費用量為「Not available」。'],
]

// 用量:0.0、0.1 為實測字數;其餘依影片分鐘數 × 旁白比例推估。
const USAGE: string[][] = [
  ['L0 第 0 課（實測）', '25 段、1,065 字', '4.2 分', 'US$0.06', 'US$0.11'],
  ['L0 第 1 課（實測）', '26 段、1,038 字', '4.1 分', 'US$0.06', 'US$0.11'],
  ['L0 第 2 課（推估，影片 31 分）', '約 6,250 字', '24.8 分', 'US$0.34', 'US$0.67'],
  ['L1 全部 8 課（影片 140 分）', '約 28,200 字', '112 分', 'US$1.51', 'US$3.02'],
  ['L2 全部 36 課（學習時間 1,045 分）', '約 105,300 字', '418 分', 'US$5.64', 'US$11.29'],
  ['合計 L0–L2', '約 141,900 字', '563 分（約 9.4 小時）', 'US$7.60', 'US$15.20'],
]

const PER_LESSON: string[][] = [
  ['L0 平均一課', '11.0 分', 'US$0.15', 'US$0.30', 'US$0.10'],
  ['L1 平均一課', '14.0 分', 'US$0.19', 'US$0.38', 'US$0.13'],
  ['L2 平均一課', '11.6 分', 'US$0.16', 'US$0.31', 'US$0.10'],
]

const SCENARIOS: string[][] = [
  ['首次產生整套（L0–L2）', '563 分', 'US$7.60', 'US$15.20', 'US$5.07'],
  ['首次產生，每段平均重抽 0.5 次', '845 分', 'US$11.40', 'US$22.80', 'US$7.60'],
  ['改稿：每次改 10% 的段落', '56 分', 'US$0.76', 'US$1.52', 'US$0.51'],
  ['改稿：單一課改 10%', '約 1.1–1.4 分', '約 US$0.02', '約 US$0.04', '約 US$0.01'],
  ['試聽選聲音：30 種聲音 × 3 句 × 10 秒', '15 分', 'US$0.20', 'US$0.41', 'US$0.14'],
]

const ALTERNATIVES: string[][] = [
  ['Gemini 3.8 Flash TTS（目前方案）', '音訊 US$9.00／百萬 token（2027 年起 US$18.00）', '約 US$7.6（2027 年起約 US$15.2）', '可用文字指示語氣；免費層級可試聽'],
  ['Google Cloud TTS：Chirp 3 HD', 'US$30／百萬字元；每月前 100 萬字元免費', '約 US$4.3；若在免費額度內為 US$0', '依字元計費（含空白與換行）；是否有合適的台灣華語聲音需另外試聽確認'],
  ['Google Cloud TTS：WaveNet', 'US$4／百萬字元；每月前 400 萬字元免費', '約 US$0.6；通常在免費額度內', '舊一代模型，自然度較低'],
  ['ElevenLabs：Multilingual v2／v3', 'US$0.08／千字元（Flash／Turbo US$0.04）', '約 US$11.4（Flash 約 US$5.7）', '中文字元的計算方式官方未列出；Creator 方案每月 US$22 含 27.5 萬字元'],
]

const toc = [
  { id: 'price', title: '官方價格' },
  { id: 'free', title: '免費層級與限制' },
  { id: 'usage', title: '用量估算' },
  { id: 'cost', title: '費用試算' },
  { id: 'alt', title: '替代方案' },
  { id: 'conclusion', title: '結論' },
]

export function VoiceCostPage() {
  return (
    <Article slug="research/voice-cost" toc={toc}>
      <p>
        即時教學畫面的每個步驟可以有一段旁白文字。我們用 Gemini API 的 TTS（模型 gemini-3.8-flash-tts、聲音
        Sulafat，透過 Interactions API）預先產生語音並存成 MP3；旁白沒改的段落直接用快取，不重新產生。本篇估算這種做法的費用。
      </p>
      <Callout title="查詢日期與估算方式">
        <p>
          價格與條款查詢於 {DATE}，來自下方列出的官方頁面；之後可能變動，正式產生前請再確認。用量由第 0、1 課的實際腳本統計，其餘課程依影片分鐘數推估，假設寫在「用量估算」一節。
        </p>
      </Callout>

      <Section id="price" title="官方價格">
        <p>
          以下為 Gemini API 的<Ext href={PRICING}>定價頁</Ext>付費層級價格（美元）。價格分兩段：2026-12-31 前為下表價格，2027-01-01 起加倍。
        </p>
        <DataTable head={['項目', '價格', '備註']} rows={PRICES} />
        <p>
          換算：Flash 每分鐘音訊 1,500 token，約 US$0.0135（2027 年起 US$0.027）；Flash-Lite 約 US$0.009（2027 年起 US$0.018）。
          輸入文字以每字 1 token 計，整套課程約 14 萬 token，只要約 US$0.07，以下試算略過不計。
        </p>
      </Section>

      <Section id="free" title="免費層級與限制">
        <DataTable head={['項目', '內容']} rows={FREE} />
      </Section>

      <Section id="usage" title="用量估算">
        <p>
          統計方式：取腳本 <code>steps[]</code> 的 <code>narration</code>，去掉空白後計算字數，以每秒 4.2 字換算成秒數（與預覽頁計算旁白長度的值相同）。
          第 0、1 課旁白約 4.1–4.2 分，佔 5 分鐘影片的 82–85%。
        </p>
        <DataTable head={['範圍', '旁白量', '音訊長度', '費用（2026 價）', '費用（2027 價）']} rows={USAGE} />
        <Callout title="推估假設" tone="warn">
          <ul>
            <li>旁白約佔影片時間的 80%（依第 0、1 課實測的 82–85% 略為取低）。</li>
            <li>影片分鐘數取自 L0、L1 課程資料的 videos[].minutes：L0 共 41 分、L1 共 140 分。</li>
            <li>L2 只有大綱，沒有影片分鐘數。L0、L1 的影片約佔每課學習時間的 48–55%，所以 L2 以學習時間的 50% 當作影片時間（1,045 分 × 50% × 80% ≈ 418 分旁白）。</li>
            <li>實際語速可能和 4.2 字／秒不同；語速慢 20%，費用就多約 20%。</li>
          </ul>
        </Callout>
        <DataTable head={['每課平均', '音訊長度', 'Flash（2026 價）', 'Flash（2027 價）', 'Flash-Lite（2026 價）']} rows={PER_LESSON} />
      </Section>

      <Section id="cost" title="費用試算">
        <p>
          快取以段落為單位：一段旁白改了一個字，整段都要重新產生，所以改稿費用依「改到的段落」計算，不是依改動的字數。
        </p>
        <DataTable head={['情境', '音訊長度', 'Flash（2026 價）', 'Flash（2027 價）', 'Flash-Lite（2026 價）']} rows={SCENARIOS} />
        <p>
          試聽選聲音可以用免費層級；換成 Batch 或 Flex 可再省一半，但要等結果，比較適合整套一次產生。
        </p>
      </Section>

      <Section id="alt" title="替代方案">
        <p>以整套約 14.2 萬字（約 9.4 小時音訊）估算；價格查詢於 {DATE}。</p>
        <DataTable head={['方案', '單價', '整套首次產生', '備註']} rows={ALTERNATIVES} />
        <p>
          <strong>真人錄音</strong>：9.4 小時的成品旁白，實際錄製時間通常是成品的好幾倍（重錄、試讀），還要剪輯與降噪，總時間以天到週計。
          改稿時要回到相同的環境與語氣補錄，否則前後音色不一致；TTS 只需重新產生改到的段落。錄製流程見
          <Link to="/docs/research/recording">影音錄製實務</Link>。
        </p>
      </Section>

      <Section id="conclusion" title="結論">
        <Callout title="整套課程首次產生約 US$8" tone="key">
          <p>
            以 gemini-3.8-flash-tts 產生 L0–L2 全部旁白（約 9.4 小時），2026 年底前約 US$7.6，2027 年起約 US$15；含重抽緩衝也在 US$25 以內。
            每課約 US$0.15–0.40，每次改 10% 旁白不到 US$2，試聽選聲音不到 US$0.5。費用不是選擇方案的主要考量，聲音品質與改稿的方便性比較重要。
          </p>
        </Callout>
        <p>
          建議：試聽在免費層級進行；正式產生用付費層級（內容不會被用於改善產品），並在 2026-12-31 前先產生已定稿的課程。
        </p>
      </Section>

      <SourceList
        sources={[
          { label: `Gemini API：Pricing（查詢 ${DATE}）`, href: PRICING },
          { label: `Gemini API：Rate limits（查詢 ${DATE}）`, href: RATE_LIMITS },
          { label: `Gemini API：Speech generation（查詢 ${DATE}）`, href: SPEECH },
          { label: `Google Cloud：Text-to-Speech pricing（查詢 ${DATE}）`, href: CLOUD_TTS },
          { label: `ElevenLabs：API pricing（查詢 ${DATE}）`, href: ELEVEN },
        ]}
      />
    </Article>
  )
}
