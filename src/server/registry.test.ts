import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DocRegistry } from './registry'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'compose-'))
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-state-'))
})

it('opens and registers a doc', async () => {
  const p = join(dir, 'a.md')
  writeFileSync(p, '# Hello\n\nworld\n')
  const reg = new DocRegistry()
  const doc = await reg.openDoc(p)
  expect(doc.canonicalText).toBe('# Hello\n\nworld\n')
  expect(reg.get(doc.id)).toBe(doc)
  expect((await reg.recent())[0]).toMatchObject({ path: p, title: 'Hello' })
})

it('same path same doc', async () => {
  const p = join(dir, 'a.md')
  writeFileSync(p, 'x')
  const reg = new DocRegistry()
  expect(await reg.openDoc(p)).toBe(await reg.openDoc(p))
})

it('falls back to basename title', async () => {
  const p = join(dir, 'plain.md')
  writeFileSync(p, 'no heading here\n')
  const reg = new DocRegistry()
  await reg.openDoc(p)
  expect((await reg.recent())[0].title).toBe('plain.md')
})

it('rejects binary', async () => {
  const p = join(dir, 'b.md')
  writeFileSync(p, 'a\0b')
  await expect(new DocRegistry().openDoc(p)).rejects.toThrow(/text/i)
})

it('rejects oversized', async () => {
  const p = join(dir, 'c.md')
  writeFileSync(p, 'x'.repeat(2 * 1024 * 1024 + 1))
  await expect(new DocRegistry().openDoc(p)).rejects.toThrow(/2 MB/i)
})
