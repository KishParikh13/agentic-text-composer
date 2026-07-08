import { EventLog } from './events'
import { summarizeDiff } from './diffSummary'

it('appends with increasing seq and filters by since', () => {
  const log = new EventLog()
  log.append('d', { kind: 'human-edit', summary: 'a' })
  log.append('d', { kind: 'human-edit', summary: 'b' })
  expect(log.latest('d')).toBe(2)
  const events = log.since('d', 1)
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ seq: 2, kind: 'human-edit', summary: 'b' })
})

it('waitFor resolves immediately when events exist', async () => {
  const log = new EventLog()
  log.append('d', { kind: 'human-edit', summary: 'a' })
  expect(await log.waitFor('d', 0, 50)).toHaveLength(1)
})

it('waitFor resolves on a later append', async () => {
  const log = new EventLog()
  const p = log.waitFor('d', 0, 5000)
  setTimeout(() => log.append('d', { kind: 'human-edit', summary: 'late' }), 20)
  const events = await p
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ summary: 'late' })
})

it('waitFor times out empty', async () => {
  const log = new EventLog()
  expect(await log.waitFor('d', 0, 30)).toEqual([])
})

it('summarizeDiff shows insertions and deletions', () => {
  const s = summarizeDiff('keep this old line here\n', 'keep this new line here\n')
  expect(s).toContain('-')
  expect(s).toContain('+')
  expect(s).toContain('new')
})

it('summarizeDiff caps snippet length', () => {
  const s = summarizeDiff('short', 'short' + 'x'.repeat(500))
  for (const line of s.split('\n')) expect(line.length).toBeLessThan(140)
})
