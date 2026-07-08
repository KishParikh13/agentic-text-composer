import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { buildServer } from './app'

const once = (ws: WebSocket, pred: (m: any) => boolean) =>
  new Promise<any>(res =>
    ws.on('message', d => {
      const m = JSON.parse(d.toString())
      if (pred(m)) res(m)
    }),
  )

let srv: Awaited<ReturnType<typeof buildServer>>
let port: number
let dir: string

beforeEach(async () => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-state-'))
  dir = mkdtempSync(join(tmpdir(), 'compose-docs-'))
  srv = await buildServer()
  port = await srv.start(0)
})

afterEach(async () => {
  await srv.fastify.close()
})

const openDoc = async (text: string) => {
  const p = join(dir, 'a.md')
  writeFileSync(p, text)
  const r = await fetch(`http://localhost:${port}/api/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: p }),
  })
  return { p, id: (await r.json()).id }
}

it('init carries file text; external write broadcasts patch', async () => {
  const { p, id } = await openDoc('# One\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  const init = await once(ws, m => m.type === 'init')
  expect(init.text).toBe('# One\n')
  writeFileSync(p, '# One\n\nagent line\n')
  const patch = await once(ws, m => m.type === 'patch')
  expect(patch.source).toBe('external')
  expect(patch.fullText).toContain('agent line')
  ws.close()
}, 10000)

it('client save lands on disk and does not echo back to sender', async () => {
  const { p, id } = await openDoc('start\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await once(ws, m => m.type === 'init')
  const msgs: any[] = []
  ws.on('message', d => msgs.push(JSON.parse(d.toString())))
  ws.send(JSON.stringify({ type: 'save', text: 'start\nsaved by human\n' }))
  await once(ws, m => m.type === 'saved')
  await new Promise(r => setTimeout(r, 400))
  expect(readFileSync(p, 'utf8')).toBe('start\nsaved by human\n')
  expect(msgs.filter(m => m.type === 'patch')).toHaveLength(0)
  ws.close()
}, 10000)

it('restore endpoint reverts the file', async () => {
  const { p, id } = await openDoc('v1\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await once(ws, m => m.type === 'init')
  ws.send(JSON.stringify({ type: 'save', text: 'v2\n' }))
  await once(ws, m => m.type === 'saved')
  const hist = await (await fetch(`http://localhost:${port}/api/docs/${id}/history`)).json()
  expect(hist.length).toBeGreaterThan(0)
  await fetch(`http://localhost:${port}/api/docs/${id}/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file: hist[0].file }),
  })
  expect(readFileSync(p, 'utf8')).toBe('v1\n')
  ws.close()
}, 10000)
