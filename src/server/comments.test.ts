import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CommentStore } from './comments'

beforeEach(() => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-'))
})

it('adds and persists across store instances', async () => {
  const a = new CommentStore()
  const c = await a.add('doc1', { anchorText: 'some text', body: 'tighten this', author: 'you' })
  expect(c.id).toMatch(/^[0-9a-f]{8}$/)
  const b = new CommentStore()
  const list = await b.list('doc1')
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ body: 'tighten this', resolved: false })
})

it('replies append to the thread', async () => {
  const s = new CommentStore()
  const c = await s.add('doc1', { anchorText: 'x', body: 'q', author: 'you' })
  await s.reply('doc1', c.id, { body: 'done', author: 'agent' })
  expect((await s.list('doc1'))[0].replies).toEqual([expect.objectContaining({ body: 'done', author: 'agent' })])
})

it('resolve flips the flag', async () => {
  const s = new CommentStore()
  const c = await s.add('doc1', { anchorText: 'x', body: 'q', author: 'you' })
  await s.resolve('doc1', c.id)
  expect((await s.list('doc1'))[0].resolved).toBe(true)
})

it('unknown id throws', async () => {
  const s = new CommentStore()
  await expect(s.reply('doc1', 'deadbeef', { body: 'x', author: 'agent' })).rejects.toThrow(/unknown/)
})
