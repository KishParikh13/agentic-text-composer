import { spawn, execFile } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readServerLock, isServerAlive } from './server/serverLock'
import { installApp } from './server/installApp'

const here = dirname(fileURLToPath(import.meta.url))

async function ensureServer(): Promise<number> {
  const lock = await readServerLock()
  if (lock && (await isServerAlive(lock))) return lock.port
  const child = spawn(process.execPath, [join(here, 'server-entry.js')], { detached: true, stdio: 'ignore' })
  child.unref()
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100))
    const l = await readServerLock()
    if (l && (await isServerAlive(l))) return l.port
  }
  throw new Error('compose server failed to start')
}

const openBrowser = (url: string) => {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  execFile(cmd, [url], () => {})
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--serve') {
    if (args.includes('--port')) process.env.COMPOSE_PORT = args[args.indexOf('--port') + 1]
    const { buildServer } = await import('./server/app')
    const srv = await buildServer()
    const actual = await srv.start(Number(process.env.COMPOSE_PORT || 4300))
    console.log(`compose server on http://127.0.0.1:${actual}`)
    return
  }
  if (args[0] === 'install-app') {
    await installApp()
    return
  }
  const file = args[0]
  if (!file || file.startsWith('-')) {
    console.log('usage: compose <file.md> | compose --serve [--port N] | compose install-app')
    process.exit(1)
  }
  const port = await ensureServer()
  const r = await fetch(`http://127.0.0.1:${port}/api/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: resolve(file) }),
  })
  const body = (await r.json()) as { id?: string; error?: string }
  if (!r.ok) {
    console.error(`compose: ${body.error}`)
    process.exit(1)
  }
  const url = `http://127.0.0.1:${port}/doc/${body.id}`
  console.log(url)
  openBrowser(url)
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
