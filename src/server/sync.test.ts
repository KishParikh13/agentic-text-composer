import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makePatchText, applyPatchText, handleExternalChange, handleClientSave } from './sync'
import { sha256Hex } from '../shared/hash'
import type { Doc } from './registry'

const mkDoc = (text: string, path: string): Doc => ({
  id: 'testdoc12345',
  path,
  canonicalText: text,
  canonicalHash: sha256Hex(text),
  lastWriteHash: null,
})

beforeEach(() => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-'))
})

it('patch round-trip', () => {
  const p = makePatchText('hello world', 'hello brave world')
  expect(applyPatchText(p, 'hello world')).toEqual({ merged: 'hello brave world', failures: 0 })
})

it('fuzzy apply onto diverged text merges both edits', () => {
  const base = '# T\n\nalpha beta gamma\n\nsecond para\n'
  const p = makePatchText(base, base.replace('second para', 'second paragraph, expanded'))
  const local = base.replace('alpha', 'ALPHA')
  const { merged, failures } = applyPatchText(p, local)
  expect(failures).toBe(0)
  expect(merged).toContain('ALPHA')
  expect(merged).toContain('second paragraph, expanded')
})

it('external change updates canonical and emits patch', async () => {
  const doc = mkDoc('v1\n', '/tmp/x.md')
  const msg = await handleExternalChange(doc, 'v2\n')
  expect(msg).toMatchObject({ type: 'patch', fullText: 'v2\n', source: 'external' })
  expect(doc.canonicalText).toBe('v2\n')
})

it('echo suppressed', async () => {
  const doc = mkDoc('v1\n', '/tmp/x.md')
  doc.lastWriteHash = sha256Hex('v1-written\n')
  expect(await handleExternalChange(doc, 'v1-written\n')).toBeNull()
})

it('client save writes file, snapshots and updates canonical', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'compose-doc-'))
  const p = join(dir, 'x.md')
  writeFileSync(p, 'v1\n')
  const doc = mkDoc('v1\n', p)
  const msg = await handleClientSave(doc, 'v2\n')
  expect(readFileSync(p, 'utf8')).toBe('v2\n')
  expect(doc.lastWriteHash).toBe(sha256Hex('v2\n'))
  expect(msg).toMatchObject({ type: 'patch', source: 'client', fullText: 'v2\n' })
})

it('client save of identical text is a no-op saved ack', async () => {
  const doc = mkDoc('v1\n', '/tmp/never-written.md')
  const msg = await handleClientSave(doc, 'v1\n')
  expect(msg).toEqual({ type: 'saved', hash: sha256Hex('v1\n') })
})
