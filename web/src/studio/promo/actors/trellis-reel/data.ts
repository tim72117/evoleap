// trellis-reel 的事實與數字(來源:github.com/microsoft/TRELLIS.2 與 arXiv 2512.14692;星數與 fork 為抓取當下,不代表現在)。
export const FACTS = {
  repo: { owner: 'microsoft', name: 'TRELLIS.2', stars: 13200, forks: 1600, license: 'MIT', params: '4B' },
  hf: { owner: 'microsoft', name: 'TRELLIS.2-4B' },
  /** H100,形狀 + 材質,秒數 */
  speed: [
    { res: '512³', shape: 2, tex: 1 },
    { res: '1024³', shape: 10, tex: 7 },
    { res: '1536³', shape: 35, tex: 25 },
  ],
  pbr: ['Base Color', 'Roughness', 'Metallic', 'Alpha'],
  /** 畫面上用的中文名稱(順序同 pbr) */
  pbrZh: ['底色', '粗糙度', '金屬度', '不透明度'],
  stages: [
    { name: '稀疏結構', res: '64³' },
    { name: '形狀', res: '512' },
    { name: '貼圖', res: '以形狀為條件' },
  ],
  vramGB: 24,
} as const

export const total = (s: { shape: number; tex: number }): number => s.shape + s.tex
export const fmtK = (n: number): string => `${(Math.round(n / 100) / 10).toFixed(1)}k`
