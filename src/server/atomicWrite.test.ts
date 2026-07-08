import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atomicWrite } from './atomicWrite'

it('writes content and leaves no temp files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'compose-'))
  await atomicWrite(join(dir, 'a.md'), 'hello')
  expect(readFileSync(join(dir, 'a.md'), 'utf8')).toBe('hello')
  expect(readdirSync(dir)).toEqual(['a.md'])
})
