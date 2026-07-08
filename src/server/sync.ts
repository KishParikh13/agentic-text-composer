import DiffMatchPatch from 'diff-match-patch'
import { sha256Hex } from '../shared/hash'
import type { ServerMsg } from '../shared/protocol'
import type { Doc } from './registry'
import { snapshot } from './history'
import { atomicWrite } from './atomicWrite'

const dmp = new DiffMatchPatch()

export function makePatchText(oldText: string, newText: string): string {
  return dmp.patch_toText(dmp.patch_make(oldText, newText))
}

export function applyPatchText(patchText: string, text: string): { merged: string; failures: number } {
  const patches = dmp.patch_fromText(patchText)
  const [merged, results] = dmp.patch_apply(patches, text)
  return { merged, failures: results.filter(ok => !ok).length }
}

// Snapshots store the PRIOR canonical text; `source` is the origin of the
// incoming change that made it history ('external' = agent, 'you' = client).
export async function handleExternalChange(doc: Doc, newFileText: string): Promise<ServerMsg | null> {
  const newHash = sha256Hex(newFileText)
  if (newHash === doc.lastWriteHash || newHash === doc.canonicalHash) return null
  await snapshot(doc.id, doc.canonicalText, 'external')
  const patchText = makePatchText(doc.canonicalText, newFileText)
  doc.canonicalText = newFileText
  doc.canonicalHash = newHash
  return { type: 'patch', patchText, fullText: newFileText, hash: newHash, source: 'external' }
}

export async function handleClientSave(doc: Doc, text: string): Promise<ServerMsg> {
  const newHash = sha256Hex(text)
  if (newHash === doc.canonicalHash) return { type: 'saved', hash: newHash }
  await snapshot(doc.id, doc.canonicalText, 'you')
  const patchText = makePatchText(doc.canonicalText, text)
  await atomicWrite(doc.path, text)
  doc.lastWriteHash = newHash
  doc.canonicalText = text
  doc.canonicalHash = newHash
  return { type: 'patch', patchText, fullText: text, hash: newHash, source: 'client' }
}
