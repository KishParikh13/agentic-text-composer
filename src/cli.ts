import { spawn, execFile } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readServerLock, isServerAlive } from './server/serverLock'
import { installApp } from './server/installApp'
import { pollEvents, formatEvents, formatComments } from './server/eventsClient'

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

// Ensure the server is up and the doc is open+watched; returns its id.
async function openViaApi(file: string): Promise<{ port: number; id: string }> {
  const port = await ensureServer()
  const r = await fetch(`http://127.0.0.1:${port}/api/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: resolve(file) }),
  })
  const body = (await r.json()) as { id?: string; error?: string }
  if (!r.ok) throw new Error(body.error)
  return { port, id: body.id! }
}

const post = async (port: number, path: string, body: unknown) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(((await r.json()) as any).error)
  return r.json()
}

const flag = (args: string[], name: string): string | undefined =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === 'wait') {
    const file = args[1]
    if (!file) throw new Error('usage: compose wait <file.md> [--timeout <sec>] [--since <seq>]')
    const { port, id } = await openViaApi(file)
    const timeoutSec = Number(flag(args, '--timeout') ?? 3600)
    const sinceArg = flag(args, '--since')
    const since =
      sinceArg !== undefined
        ? Number(sinceArg)
        : ((await (await fetch(`http://127.0.0.1:${port}/api/docs/${id}/events?since=0&waitMs=0`)).json()) as any).latest
    const { events } = await pollEvents(port, id, since, timeoutSec * 1000)
    if (!events.length) {
      console.log(`no changes within ${timeoutSec}s`)
      process.exit(2)
    }
    console.log(formatEvents(events, file))
    return
  }
  if (args[0] === 'comments') {
    const file = args[1]
    if (!file) throw new Error('usage: compose comments <file.md>')
    const { port, id } = await openViaApi(file)
    const list = await (await fetch(`http://127.0.0.1:${port}/api/docs/${id}/comments`)).json()
    console.log(formatComments(list))
    return
  }
  if (args[0] === 'reply') {
    const [, file, commentId, ...words] = args
    if (!file || !commentId || !words.length) throw new Error('usage: compose reply <file.md> <commentId> <text...>')
    const { port, id } = await openViaApi(file)
    await post(port, `/api/docs/${id}/comments/${commentId}/replies`, { body: words.join(' '), author: 'agent' })
    console.log(`replied to ${commentId}`)
    return
  }
  if (args[0] === 'resolve') {
    const [, file, commentId] = args
    if (!file || !commentId) throw new Error('usage: compose resolve <file.md> <commentId>')
    const { port, id } = await openViaApi(file)
    await post(port, `/api/docs/${id}/comments/${commentId}/resolve`, {})
    console.log(`resolved ${commentId}`)
    return
  }
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
    console.log(
      'usage: compose <file.md> | compose wait <file.md> [--timeout <sec>] [--since <seq>] |\n' +
        '       compose comments <file.md> | compose reply <file.md> <id> <text...> | compose resolve <file.md> <id> |\n' +
        '       compose --serve [--port N] | compose install-app',
    )
    process.exit(1)
  }
  const { port, id } = await openViaApi(file)
  const url = `http://127.0.0.1:${port}/doc/${id}`
  console.log(url)
  openBrowser(url)
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
