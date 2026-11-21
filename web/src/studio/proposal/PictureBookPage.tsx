import { useState } from 'react'
import type { Aspect } from '../../live/types'
import { PromoPlayer } from '../materials/PromoPage'
import { ProposalLayout } from './ProposalLayout'
import ui from './proposal.module.css'

// 開發中:兒童動畫繪本。主角是演員 bobo(小熊波波,web/src/live/actors/bobo/),腳本在 content/live/lab/book/。
// 繪本不用字卡,全用動畫說故事;旁白是大姊姊講故事的聲音(腳本的 voice 設定)。

const BOOKS: { script: string; title: string; topic: string }[] = [
  { script: 'lab/book/bobo-bath.json', title: '波波今天不想洗澡', topic: '自我衛生管理：洗澡、刷牙' },
  // 英文朗讀:用原始錄音(只在本機,public/local/),每一句在錄音的停頓處切開,畫面的字與圖對齊錄音的秒數
  { script: 'lab/read-along/u8-foods.json', title: 'My Favorite Foods（英文朗讀）', topic: '英文朗讀：跟著錄音一起讀' },
  // 孩子的學習單改寫版:彩色字(題目)不動、填入的字挪過位置;午餐、晚餐、夜晚、飲料。小女孩慢速朗讀(Gemini TTS Zephyr,錄音只在本機)
  { script: 'lab/read-along/u8-foods-girl.json', title: 'My Favorite Foods（孩子的版本）', topic: '英文朗讀：孩子自己寫的版本' },
]

const POSITIONING: [string, string][] = [
  ['對象', '4–6 歲的孩子，家長陪著看或睡前播放。'],
  ['形式', '動畫繪本：沒有字卡，畫面、角色的表情與動作說故事；旁白是大姊姊講故事的聲音，字幕在下方。橫式、直式都能播。'],
  ['講法', '不威脅（不說會生病、會蛀牙）、不利誘（沒有貼紙、點心）。讓孩子從身體的感覺發現需要，自己決定去照顧自己；玩髒沒關係。'],
]

const STORY: [string, string][] = [
  ['愛玩的波波', '在公園跳水坑、挖沙、在草地上打滾，變成一隻泥巴熊。'],
  ['晚餐時間', '吃蜂蜜鬆餅，嘴角、牙齒黏黏的；說今天不要洗澡刷牙。媽媽沒有生氣：「你仔細聽聽看，身體想跟你說什麼。」'],
  ['睡不著的晚上', '皮膚癢、床單上的沙刺刺的、舌頭舔到牙齒毛毛的；自己發現「原來是我的身體在跟我說話」。'],
  ['自己照顧身體', '照鏡子、脫衣服放洗衣籃、淋濕 → 肥皂泡泡 → 沖乾淨 → 擦乾；刷上排、下排、裡面、咬東西的那一面，再漱口；換睡衣。'],
  ['睡個好覺', '把床單上的沙拍掉，一下子就睡著了。'],
  ['第二天', '照樣去跳水坑，玩完自己說「換我照顧我的身體！」，然後去洗澡。'],
]

const NEXT = ['決定要不要掛到兒童課底下（目前在研發基地專用的 lab/，正式站拿不到）。', '說話泡泡裡的台詞還沒有配音，只有旁白。', '同一位主角可以接著做其他生活習慣的繪本（上廁所、收玩具、好好吃飯）。']

export function PictureBookPage() {
  const [book, setBook] = useState(BOOKS[0].script)
  const [aspect, setAspect] = useState<Aspect>('landscape')
  return (
    <ProposalLayout title="兒童繪本" footer="開發 · 第一本試做">
      <h1>開發 · 兒童動畫繪本</h1>
      <span className={`${ui.chip} ${ui.todo} ${ui['draft-banner']}`}>試做</span>

      <h2>播放</h2>
      <div className={ui.links} role="group" aria-label="繪本">
        {BOOKS.map((b) => (
          <button key={b.script} type="button" className={book === b.script ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={book === b.script} onClick={() => setBook(b.script)}>
            {b.title}
          </button>
        ))}
      </div>
      <div className={ui.links} role="group" aria-label="舞台方向" style={{ marginTop: 8 }}>
        {(['landscape', 'portrait'] as const).map((a) => (
          <button key={a} type="button" className={aspect === a ? ui.btn : `${ui.btn} ${ui.ghost}`} aria-pressed={aspect === a} onClick={() => setAspect(a)}>
            {a === 'portrait' ? '直式 9:16' : '橫式 16:9'}
          </button>
        ))}
      </div>
      <PromoPlayer key={`${book}|${aspect}`} script={book} aspect={aspect} />

      <h2>定位</h2>
      <section className={ui.card}>
        <table>
          <tbody>
            {POSITIONING.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '6em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>《{BOOKS[0].title}》的故事</h2>
      <p className={ui.lead}>主題：{BOOKS[0].topic}。主角是小熊波波（演員 bobo），四個場景：公園、餐桌、浴室、臥室。</p>
      <section className={ui.card}>
        <table>
          <tbody>
            {STORY.map(([k, v]) => (
              <tr key={k}>
                <td className={ui.nowrap} style={{ width: '8em' }}>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2>待決定與下一步</h2>
      <section className={ui.card}>
        <ul>
          {NEXT.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    </ProposalLayout>
  )
}
