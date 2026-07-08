import { mkdtempSync, writeFileSync } from 'node:fs'
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

const api = (path: string, body?: unknown) =>
  fetch(`http://localhost:${port}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const openDoc = async (text: string) => {
  const p = join(dir, 'a.md')
  writeFileSync(p, text)
  const r = await api('/api/open', { path: p })
  return { p, id: (await r.json()).id }
}

it('ui save emits a human-edit event; external write does not', async () => {
  const { p, id } = await openDoc('start\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await once(ws, m => m.type === 'init')
  ws.send(JSON.stringify({ type: 'save', text: 'start\nhuman line\n' }))
  await once(ws, m => m.type === 'saved')
  const { events, latest } = await (await api(`/api/docs/${id}/events?since=0&waitMs=0`)).json()
  expect(latest).toBe(1)
  expect(events[0]).toMatchObject({ kind: 'human-edit' })
  expect(events[0].summary).toContain('human line')
  // external (agent) write: no new event
  writeFileSync(p, 'start\nhuman line\nagent line\n')
  await new Promise(r => setTimeout(r, 500))
  const after = await (await api(`/api/docs/${id}/events?since=0&waitMs=0`)).json()
  expect(after.latest).toBe(1)
  ws.close()
}, 10000)

it('long-poll resolves when a save lands mid-wait', async () => {
  const { id } = await openDoc('v1\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await once(ws, m => m.type === 'init')
  const pending = api(`/api/docs/${id}/events?since=0&waitMs=8000`).then(r => r.json())
  setTimeout(() => ws.send(JSON.stringify({ type: 'save', text: 'v2\n' })), 100)
  const { events } = await pending
  expect(events).toHaveLength(1)
  expect(events[0].kind).toBe('human-edit')
  ws.close()
}, 10000)

it('comments round-trip with events and ws broadcast', async () => {
  const { id } = await openDoc('anchor me please\n')
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await once(ws, m => m.type === 'init')
  const commentsMsg = once(ws, m => m.type === 'comments')
  const comment = await (
    await api(`/api/docs/${id}/comments`, { anchorText: 'anchor me', body: 'expand this', author: 'you' })
  ).json()
  expect(comment.id).toMatch(/^[0-9a-f]{8}$/)
  expect((await commentsMsg).comments).toHaveLength(1)
  await api(`/api/docs/${id}/comments/${comment.id}/replies`, { body: 'done', author: 'agent' })
  await api(`/api/docs/${id}/comments/${comment.id}/resolve`, {})
  const list = await (await api(`/api/docs/${id}/comments`)).json()
  expect(list[0].replies[0]).toMatchObject({ body: 'done', author: 'agent' })
  expect(list[0].resolved).toBe(true)
  const { events } = await (await api(`/api/docs/${id}/events?since=0&waitMs=0`)).json()
  expect(events.map((e: any) => e.kind)).toEqual(['comment-added', 'comment-replied', 'comment-resolved'])
  ws.close()
}, 10000)
