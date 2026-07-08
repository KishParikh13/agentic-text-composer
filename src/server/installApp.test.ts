import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installApp } from './installApp'

it('generates a Finder-openable app bundle', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'compose-app-'))
  const app = await installApp(dir)
  expect(app).toBe(join(dir, 'Compose.app'))
  const plist = readFileSync(join(app, 'Contents', 'Info.plist'), 'utf8')
  expect(plist).toContain('dev.kish.compose')
  expect(plist).toContain('markdown')
  const exe = join(app, 'Contents', 'MacOS', 'compose-open')
  const mode = statSync(exe).mode & 0o777
  expect(mode).toBe(0o755)
  expect(readFileSync(exe, 'utf8')).toContain('cli.js')
})
