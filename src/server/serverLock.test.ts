import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readServerLock, isServerAlive } from './serverLock'
import { buildServer } from './app'

beforeEach(() => {
  process.env.COMPOSE_STATE_DIR = mkdtempSync(join(tmpdir(), 'compose-'))
})

it('null when missing', async () => {
  expect(await readServerLock()).toBeNull()
})

it('dead lock is not alive', async () => {
  writeFileSync(join(process.env.COMPOSE_STATE_DIR!, 'server.json'), JSON.stringify({ port: 1, pid: 999999 }))
  expect(await isServerAlive((await readServerLock())!)).toBe(false)
})

it('live server is alive', async () => {
  const srv = await buildServer()
  await srv.start(0)
  expect(await isServerAlive((await readServerLock())!)).toBe(true)
  await srv.fastify.close()
})
