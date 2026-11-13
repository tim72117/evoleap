// rpc.mjs — 最小的 MCP stdio 伺服器(JSON-RPC 2.0,一行一則訊息),不依賴 SDK。
// 支援 initialize、notifications/initialized、ping、tools/list、tools/call。
//
//   const server = createMcpServer({ name, version, tools })
//   server.listen(process.stdin, process.stdout)
//   await server.handle(message)   單元測試用:回傳要送出的回應(通知回傳 null)
//
// tools:[{ name, description, inputSchema, run(args) }];run 回傳 MCP content 陣列或 { content, isError }。
// run 丟出的錯誤變成 isError 的工具結果(訊息原樣給 Claude 看),不是 JSON-RPC 錯誤。

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

export function createMcpServer({ name, version, tools, instructions }) {
  const byName = new Map(tools.map((t) => [t.name, t]))

  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid Request' } }
    }
    const isRequest = 'id' in msg && msg.id !== null && typeof msg.method === 'string'
    if (!isRequest) return null // 通知(initialized、cancelled…)或對方的回應:不回
    const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result })
    const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })
    switch (msg.method) {
      case 'initialize': {
        const asked = msg.params?.protocolVersion
        return ok({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name, version },
          ...(instructions ? { instructions } : {}),
        })
      }
      case 'ping':
        return ok({})
      case 'tools/list':
        return ok({ tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
      case 'tools/call': {
        const tool = byName.get(msg.params?.name)
        if (!tool) return fail(-32602, `Unknown tool: ${msg.params?.name}`)
        try {
          const out = await tool.run(msg.params?.arguments ?? {})
          return ok(Array.isArray(out) ? { content: out } : out)
        } catch (e) {
          return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true })
        }
      }
      default:
        return fail(-32601, `Method not found: ${msg.method}`)
    }
  }

  function listen(input, output) {
    let buf = ''
    const send = (obj) => output.write(JSON.stringify(obj) + '\n')
    input.setEncoding('utf8')
    input.on('data', (chunk) => {
      buf += chunk
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let msg
        try {
          msg = JSON.parse(line)
        } catch {
          send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
          continue
        }
        // 每則請求各自處理(不互相等),回應帶 id 對得上
        Promise.resolve(handle(msg)).then((res) => res && send(res))
      }
    })
  }

  return { handle, listen }
}

// 工具結果的小幫手
export const text = (t) => ({ type: 'text', text: t })
export const png = (buf) => ({ type: 'image', data: Buffer.from(buf).toString('base64'), mimeType: 'image/png' })
