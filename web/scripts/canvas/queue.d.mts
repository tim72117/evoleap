// queue.mjs 的型別(單元測試 src/studio/canvas/queue.test.ts 用)
export const DEFAULT_TIMEOUT_MS: number
export class CanvasTimeoutError extends Error {
  constructor(ms: number)
}
export function createSerial(opts?: { timeoutMs?: number; onTimeout?: () => unknown }): <A, R>(fn: (args: A) => Promise<R> | R) => (args: A) => Promise<R>
export class CanvasCancelledError extends Error {}
export function assertNotCancelled(): void
