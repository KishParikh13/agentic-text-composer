import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { buildServer } from './app'
import { pollEvents, formatEvents, formatComments } from './eventsClient'
import type { DocEvent } from './events'

it('pollEvents resolves when a save lands mid-wait, times out otherwise', async () => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-state-'))
  const dir = mkdtempSync(join(tmpdir(), 'compose-docs-'))
  const srv = await buildServer()
  const port = await srv.start(0)
  const p = join(dir, 'a.md')
  writeFileSync(p, 'v1\n')
  const r = await fetch(`http://localhost:${port}/api/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: p }),
  })
  const { id } = await r.json()
  const ws = new WebSocket(`ws://localhost:${port}/ws/${id}`)
  await new Promise(res => ws.on('message', d => JSON.parse(d.toString()).type === 'init' && res(null)))

  const pending = pollEvents(port, id, 0, 8000)
  setTimeout(() => ws.send(JSON.stringify({ type: 'save', text: 'v2\n' })), 100)
  const { events, latest } = await pending
  expect(events).toHaveLength(1)
  expect(latest).toBe(1)

  const empty = await pollEvents(port, id, latest, 300)
  expect(empty.events).toEqual([])
  ws.close()
  await srv.fastify.close()
}, 15000)

it('formatEvents renders edits and comments with a chaining hint', () => {
  const events: DocEvent[] = [
    { seq: 1, ts: 1, kind: 'human-edit', summary: '+ "new line"' },
    {
      seq: 2,
      ts: 2,
      kind: 'comment-added',
      comment: {
        id: 'abcd1234',
        anchorText: 'some text',
        body: 'expand this',
        author: 'you',
        ts: 2,
        resolved: false,
        replies: [],
      },
    },
  ]
  const out = formatEvents(events, 'doc.md')
  expect(out).toContain('edited the doc')
  expect(out).toContain('+ "new line"')
  expect(out).toContain('abcd1234')
  expect(out).toContain('> some text')
  expect(out).toContain('--since 2')
})

it('formatComments lists open comments only', () => {
  const out = formatComments([
    { id: 'aa11aa11', anchorText: 'x', body: 'open one', author: 'you', ts: 1, resolved: false, replies: [] },
    { id: 'bb22bb22', anchorText: 'y', body: 'closed one', author: 'you', ts: 1, resolved: true, replies: [] },
  ])
  expect(out).toContain('open one')
  expect(out).not.toContain('closed one')
})
