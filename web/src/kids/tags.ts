// 兒童網頁課的標籤配色:每個 HTML 標籤一個顏色,積木、字幕裡的小積木都用這一份。
// color 是積木本體的顏色;shade 是印標籤那一塊的深色,白字要夠清楚。

export type TagColor = { color: string; shade: string }

export const TAG_COLORS: Record<string, TagColor> = {
  h1: { color: '#f6a03c', shade: '#9a4a00' },
  img: { color: '#4fb3e8', shade: '#155f8a' },
  p: { color: '#5cc477', shade: '#23703a' },
  button: { color: '#b48af0', shade: '#5b2a9e' },
}
