import { readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { historyDir } from './paths'

const SAFE = /^[\w.-]+\.md$/
// Filename: <timestampMs>-<seq>-<source>.md. The monotonic seq disambiguates
// snapshots written within the same millisecond and gives a total order.
const NAME = /^(\d+)-(\d+)-(you|external)\.md$/
const CAP = 200

let seq = 0

export interface SnapshotEntry {
  file: string
  mtimeMs: number
  source: 'you' | 'external'
}

const orderKey = (file: string): [number, number] => {
  const m = file.match(NAME)
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}

export async function listSnapshots(docId: string): Promise<SnapshotEntry[]> {
  const dir = historyDir(docId)
  const files = (await readdir(dir)).filter(f => SAFE.test(f) && NAME.test(f))
  return files
    .map(file => {
      const m = file.match(NAME)!
      return { file, mtimeMs: Number(m[1]), source: m[3] as 'you' | 'external' }
    })
    .sort((a, b) => {
      const [ta, sa] = orderKey(a.file)
      const [tb, sb] = orderKey(b.file)
      return tb - ta || sb - sa
    })
}

export async function readSnapshot(docId: string, file: string): Promise<string> {
  if (!SAFE.test(file)) throw new Error('invalid snapshot name')
  return readFile(join(historyDir(docId), file), 'utf8')
}

export async function snapshot(docId: string, text: string, source: 'you' | 'external'): Promise<void> {
  const list = await listSnapshots(docId)
  if (list[0] && (await readSnapshot(docId, list[0].file)) === text) return
  const name = `${Date.now()}-${seq++}-${source}.md`
  await writeFile(join(historyDir(docId), name), text, 'utf8')
  for (const e of list.slice(CAP - 1)) await unlink(join(historyDir(docId), e.file))
}
