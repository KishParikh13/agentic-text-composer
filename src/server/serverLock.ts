import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stateDir } from './paths'

export interface ServerLock {
  port: number
  pid: number
}

export async function readServerLock(): Promise<ServerLock | null> {
  try {
    return JSON.parse(await readFile(join(stateDir(), 'server.json'), 'utf8'))
  } catch {
    return null
  }
}

export async function isServerAlive(lock: ServerLock): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${lock.port}/api/health`, { signal: AbortSignal.timeout(500) })
    return r.ok && (await r.json()).pid === lock.pid
  } catch {
    return false
  }
}
