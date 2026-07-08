// Server-side only: node:crypto. The client never hashes; the server includes
// a hash in every message it sends.
import { createHash } from 'node:crypto'

export const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

export const docIdForPath = (absPath: string) => sha256Hex(absPath).slice(0, 12)
