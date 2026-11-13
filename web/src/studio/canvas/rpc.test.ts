import { describe, expect, it } from 'vitest'
import { createMcpServer, text } from '../../../scripts/canvas/rpc.mjs'

const server = createMcpServer({
  name: 't',
  version: '0',
  tools: [
    { name: 'echo', description: 'echo', inputSchema: { type: 'object' }, run: async (a) => [text(String(a.v))] },
    { name: 'boom', description: 'boom', inputSchema: { type: 'object' }, run: async () => { throw new Error('第 3 步:找不到演員') } },
  ],
})
const req = (id: number, method: string, params?: unknown) => server.handle({ jsonrpc: '2.0', id, method, params })

describe('canvas MCP 的 JSON-RPC', () => {
  it('initialize 回傳協定版本與工具能力', async () => {
    const r = await req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'c', version: '1' } })
    expect(r?.result.protocolVersion).toBe('2025-06-18')
    expect(r?.result.capabilities.tools).toBeTruthy()
    expect((await req(2, 'initialize', { protocolVersion: '1999-01-01' }))?.result.protocolVersion).toBe('2025-06-18')
  })
  it('通知不回應;ping、tools/list', async () => {
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    expect((await req(3, 'ping'))?.result).toEqual({})
    expect((await req(4, 'tools/list'))?.result.tools.map((t: { name: string }) => t.name)).toEqual(['echo', 'boom'])
  })
  it('tools/call:結果、工具錯誤(isError)、不認得的工具與方法', async () => {
    expect((await req(5, 'tools/call', { name: 'echo', arguments: { v: 7 } }))?.result.content).toEqual([{ type: 'text', text: '7' }])
    const e = await req(6, 'tools/call', { name: 'boom', arguments: {} })
    expect(e?.result.isError).toBe(true)
    expect(e?.result.content[0].text).toContain('第 3 步')
    expect((await req(7, 'tools/call', { name: 'nope' }))?.error.code).toBe(-32602)
    expect((await req(8, 'nope'))?.error.code).toBe(-32601)
  })
  it('stdio:一行一則,斷在中間的訊息也能接起來,壞掉的 JSON 回 parse error', async () => {
    let feed: (chunk: string) => void = () => {}
    const input = { setEncoding: () => {}, on: (_ev: 'data', cb: (chunk: string) => void) => (feed = cb) }
    const lines: unknown[] = []
    const output = { write: (s: string) => s.split('\n').filter(Boolean).forEach((l) => lines.push(JSON.parse(l))) }
    server.listen(input, output)
    feed('{"jsonrpc":"2.0","id":1,"me')
    feed('thod":"ping"}\n{oops}\n')
    await new Promise((r) => setTimeout(r, 20))
    expect(lines).toContainEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect(lines).toContainEqual({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  })
})
