import { writeFile, rename } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { randomBytes } from 'node:crypto'

export async function atomicWrite(absPath: string, text: string): Promise<void> {
  const tmp = join(dirname(absPath), `.${basename(absPath)}.${randomBytes(4).toString('hex')}.tmp`)
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, absPath)
}
