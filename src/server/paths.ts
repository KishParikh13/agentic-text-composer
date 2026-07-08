import os from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export const stateDir = () => process.env.COMPOSE_STATE_DIR || join(os.homedir(), '.compose')

export const historyDir = (docId: string) => {
  const d = join(stateDir(), 'history', docId)
  mkdirSync(d, { recursive: true })
  return d
}
