import { Link } from 'react-router-dom'
import { Article, Callout, DataTable, Section, SourceList } from '../Article'

// 文字轉語音(TTS)工具現況的整理。2026-11-02 整理自網路搜尋結果(搜尋於 2026-10-30)。
// 來源多為第三方部落格與廠商文章,型號名稱、日期、價格互有出入;沒有找到可信的中文(台灣口音)獨立評測。
// 價格以 research/voice-cost 查到的官方頁面為準,本篇不列價格數字。

type Row = [string, string]

const CLOUD: Row[] = [
  ['Cartesia Sonic 3.6', '9 月底 Artificial Analysis Speech Arena（聽眾投票）排名第一，Elo 約 1279；Sonic 系列常因低延遲被推薦給即時語音代理。'],
  ['Google Gemini Flash TTS', 'Gemini 3.1 Flash TTS 於 2026-04-15 推出，支援 70 多種語言，可在文字中下風格指示。有來源提到 9 月底的 3.8 Flash TTS 排名第二；本站目前使用 gemini-3.8-flash-tts。'],
  ['Inworld TTS', 'TTS-1.5 於 2026-01-21 推出，Realtime TTS-2 排名接近前段；適合即時語音。'],
  ['ElevenLabs', 'v3 已正式上線，擅長表現力強的長篇旁白。有來源提到 v4，但說法不一，官方是否已發布尚未確認。'],
  ['MiniMax Speech 2.8 HD', '常被推薦用於旁白。'],
  ['OpenAI gpt-4o-mini-tts', '按 token 計價，可用提示控制語氣。'],
  ['阿里 Qwen-Audio-3.0-TTS-Plus', '排行榜前段，中文場景值得留意。'],
]

const OPEN: Row[] = [
  ['Qwen3-TTS（阿里，2026-01，Apache 2.0）', '1.7B 參數；有報導稱約 3 秒音檔即可複製聲音，支援普通話與多種方言。多個來源認為它是最全面的開源選擇。'],
  ['IndexTTS-2', '有來源認為中日文品質最好，可精確控制時長。'],
  ['F5-TTS', '有測試說普通話最好，但與上一項互相矛盾；需要約 12 GB VRAM。'],
  ['VoxCPM2（OpenBMB）', '整合多語言合成、聲音設計與聲音複製。'],
  ['GPT-SoVITS、CosyVoice2', '中文社群常用，分別強調少量樣本複製與串流。'],
  ['Kokoro-82M（Apache 2.0）', '輕量，適合在本機執行。'],
  ['Chatterbox（MIT）', '擅長聲音複製；Multilingual v3 於 2026-06-10 推出。'],
  ['Mistral Voxtral TTS、Hume TADA', '2026-03 新出現的模型，尚未看到中文表現的資料。'],
]

const PICKS: Row[] = [
  ['課程旁白（中文，預先產生）', '維持 Gemini Flash TTS：價格最低、語言多、可用文字指示語氣；若要更有情感，再拿同一段腳本和 ElevenLabs 比較。費用見「旁白語音的費用評估」。'],
  ['想免費、自架', 'Qwen3-TTS 或 IndexTTS-2；各產一段實際腳本試聽，並確認授權與 GPU 需求。'],
  ['即時互動的語音', 'Cartesia 或 Inworld（低延遲）。目前課程是預先產生旁白，用不到。'],
]

const toc = [
  { id: 'cloud', title: '商用雲端服務' },
  { id: 'open', title: '開源／可自架' },
  { id: 'picks', title: '對本課程的建議' },
  { id: 'caveat', title: '資料可信度' },
]

export function TtsLandscapePage() {
  return (
    <Article slug="research/tts-landscape" toc={toc}>
      <p>
        整理 2026 年下半年可用的文字轉語音（TTS）工具，供評估課程旁白是否換用其他方案。目前旁白由 Gemini TTS 預先產生，費用估算見
        <Link to="/docs/research/voice-cost">旁白語音的費用評估</Link>。
      </p>
      <Callout title="資料可信度" tone="warn">
        <p>
          以下資料來自網路搜尋，多數是第三方部落格與廠商文章，型號名稱、日期、排名互有矛盾（例如 Gemini 3.1 與 3.8 Flash TTS 的說法），
          我沒有逐一對照官方頁面。選用前請到各家官方頁面核對；排名請直接看 Artificial Analysis 的榜單。
        </p>
      </Callout>

      <Section id="cloud" title="商用雲端服務">
        <DataTable head={['服務', '重點']} rows={CLOUD} />
      </Section>

      <Section id="open" title="開源／可自架">
        <DataTable head={['模型', '重點']} rows={OPEN} />
      </Section>

      <Section id="picks" title="對本課程的建議">
        <DataTable head={['情境', '建議']} rows={PICKS} />
        <p>
          選型最可靠的做法是拿同一段講稿丟進候選模型，直接聽。研究指出自然人聲的學習效果比機器合成聲好，所以聽過整課後，也要考慮是否改成真人錄音（見
          <Link to="/docs/research/recording">影音錄製實務</Link>）。
        </p>
      </Section>

      <Section id="caveat" title="尚未確認的事項">
        <ul>
          <li>沒有找到獨立的中文（尤其台灣口音）head-to-head 評測；各家對普通話的排名互相矛盾。</li>
          <li>ElevenLabs v4、Gemini 3.8 Flash TTS 的發布時間與排名只見於第三方來源。</li>
          <li>開源模型的聲音複製需注意授權與被複製者的同意。</li>
        </ul>
      </Section>

      <SourceList
        sources={[
          { label: 'Best Text-to-Speech Models, September 2026: Ranked, Priced', href: 'https://www.digitalapplied.com/blog/best-text-to-speech-models-september-2026-ranked-priced' },
          { label: 'Best Text-to-Speech TTS Models in 2026: A Benchmark-Based Comparison（MarkTechPost）', href: 'https://www.marktechpost.com/2026/05/30/best-text-to-speech-tts-models-in-2026-a-benchmark-based-comparison/' },
          { label: 'Best AI Text to Speech Models in 2026: Ranked by Job', href: 'https://www.eachlabs.ai/blog/best-ai-text-to-speech-models-2026' },
          { label: 'Qwen3-TTS: The Complete 2026 Guide', href: 'https://medium.com/@zh.milo/qwen3-tts-the-complete-2026-guide-to-open-source-voice-cloning-and-ai-speech-generation-1a2efca05cd6' },
          { label: 'Alibaba Open-Sources Qwen3-TTS', href: 'https://winbuzzer.com/2026/01/23/alibaba-open-sources-qwen3-tts-voice-cloning-3-seconds-xcxwbn/' },
          { label: 'VoxCPM: Open-Source Multilingual Speech Synthesis', href: 'https://silenceper.com/en/article/2026-06-19-voxcpm-open-source-tts-voice-cloning/' },
          { label: 'Google Launches Gemini 3.1 Flash TTS', href: 'https://datanorth.ai/news/google-gemini-3-1-flash-tts-release' },
          { label: 'ElevenLabs vs OpenAI vs Google Gemini TTS 2026', href: 'https://tech-insider.org/ca/elevenlabs-vs-openai-vs-google-gemini-tts-2026/' },
          { label: '10 Best Text-to-Speech APIs in 2026（fal.ai）', href: 'https://fal.ai/learn/tools/best-text-to-speech-apis' },
        ]}
      />
    </Article>
  )
}
