import { readFile, writeFile, stat } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { docIdForPath, sha256Hex } from '../shared/hash'
import type { DocInfo } from '../shared/protocol'
import { stateDir } from './paths'

export interface Doc {
  id: string
  path: string
  canonicalText: string
  canonicalHash: string
  lastWriteHash: string | null
}

const titleOf = (text: string, path: string) => text.match(/^#\s+(.+)$/m)?.[1].trim() ?? basename(path)

export class DocRegistry {
  private docs = new Map<string, Doc>()

  get(id: string) {
    return this.docs.get(id)
  }

  all() {
    return [...this.docs.values()]
  }

  async openDoc(absPath: string): Promise<Doc> {
    absPath = resolve(absPath)
    const id = docIdForPath(absPath)
    const existing = this.docs.get(id)
    if (existing) return existing
    const s = await stat(absPath)
    if (s.size > 2 * 1024 * 1024) throw new Error('File is larger than 2 MB; compose only opens small text files.')
    const text = await readFile(absPath, 'utf8')
    if (text.includes('\0')) throw new Error('File does not look like text; compose only opens UTF-8 markdown.')
    const doc: Doc = { id, path: absPath, canonicalText: text, canonicalHash: sha256Hex(text), lastWriteHash: null }
    this.docs.set(id, doc)
    await this.recordRecent({ id, path: absPath, title: titleOf(text, absPath) })
    return doc
  }

  private recentPath() {
    return join(stateDir(), 'recent.json')
  }

  async recent(): Promise<DocInfo[]> {
    try {
      return JSON.parse(await readFile(this.recentPath(), 'utf8'))
    } catch {
      return []
    }
  }

  private async recordRecent(info: DocInfo) {
    const list = [info, ...(await this.recent()).filter(d => d.path !== info.path)].slice(0, 30)
    mkdirSync(stateDir(), { recursive: true })
    await writeFile(this.recentPath(), JSON.stringify(list, null, 2), 'utf8')
  }
}
