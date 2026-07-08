import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { snapshot, listSnapshots, readSnapshot } from './history'

beforeEach(() => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-'))
})

it('stores and lists snapshots newest first', async () => {
  await snapshot('abc', 'v1', 'external')
  await snapshot('abc', 'v2', 'you')
  const list = await listSnapshots('abc')
  expect(list).toHaveLength(2)
  expect(await readSnapshot('abc', list[0].file)).toBe('v2')
  expect(list[0].source).toBe('you')
})

it('skips duplicate of newest', async () => {
  await snapshot('abc', 'same', 'you')
  await snapshot('abc', 'same', 'you')
  expect(await listSnapshots('abc')).toHaveLength(1)
})

it('caps at 200', async () => {
  for (let i = 0; i < 205; i++) await snapshot('abc', `v${i}`, 'you')
  expect((await listSnapshots('abc')).length).toBe(200)
})

it('rejects traversal', async () => {
  await expect(readSnapshot('abc', '../evil.md')).rejects.toThrow()
})
