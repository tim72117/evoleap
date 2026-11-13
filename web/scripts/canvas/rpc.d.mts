// rpc.mjs 的型別(單元測試 src/studio/canvas/rpc.test.ts 用)
export type McpContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
export type McpTool = { name: string; description: string; inputSchema: object; run(args: Record<string, unknown>): Promise<McpContent[] | { content: McpContent[]; isError?: boolean }> }
export const PROTOCOL_VERSIONS: string[]
export function createMcpServer(opts: { name: string; version: string; tools: McpTool[]; instructions?: string }): {
  handle(msg: unknown): Promise<Record<string, any> | null>
  listen(input: { setEncoding(e: string): unknown; on(ev: 'data', cb: (chunk: string) => void): unknown }, output: { write(s: string): unknown }): void
}
export function text(t: string): McpContent
export function png(buf: Uint8Array): McpContent
