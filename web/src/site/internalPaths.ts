// 研發基地的內部路徑:只有管理員能進入,權限由 Go server 判定(server/cmd/server/static.go 的 internalPrefixes,兩邊要一致)。
// 內容打包在 src/studio/StudioApp.tsx 這個獨立 chunk,一般訪客下載不到。

export const INTERNAL_PREFIXES = ['/studio', '/docs', '/materials']

export const isInternalPath = (pathname: string): boolean =>
  INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
