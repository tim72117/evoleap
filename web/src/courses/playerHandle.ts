// 課程頁播放器(LivePlayer、MockPlayer)共用的 ref 介面:課程頁透過 seekTo 跳到指定秒數。
export type PlayerHandle = { seekTo(seconds: number): void }
