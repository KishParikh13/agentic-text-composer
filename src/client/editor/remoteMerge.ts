import DiffMatchPatch from 'diff-match-patch'
import type { Editor } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
import { createEditor, getMarkdown, setMarkdown } from './markdown'

const dmp = new DiffMatchPatch()

// Fuzzy-apply a text patch onto the editor's current markdown (which may hold
// unsaved local edits), then splice the result into the live doc as a single
// block-level replace. Cursor positions outside the replaced range survive via
// ProseMirror mapping; the replaced range is tagged for highlighting.
export function applyRemotePatch(
  editor: Editor,
  patchText: string,
  fullText: string,
): { failures: number; changed: boolean } {
  const localMd = getMarkdown(editor)
  const patches = dmp.patch_fromText(patchText)
  const [merged, results] = dmp.patch_apply(patches, localMd) as [string, boolean[]]
  const failures = results.filter(ok => !ok).length
  if (merged === localMd) return { failures, changed: false }

  // Parse the merged markdown in a scratch editor, then rehydrate the result
  // into the live editor's schema: each Editor has its own Schema instance,
  // and ProseMirror node comparison/splicing requires type identity.
  const scratch = createEditor(null, { onUpdate: () => {} })
  setMarkdown(scratch, merged)
  const newDoc = PMNode.fromJSON(editor.schema, scratch.state.doc.toJSON())
  scratch.destroy()
  const oldDoc = editor.state.doc

  let P = 0
  const maxP = Math.min(oldDoc.childCount, newDoc.childCount)
  while (P < maxP && oldDoc.child(P).eq(newDoc.child(P))) P++
  let S = 0
  while (
    S < Math.min(oldDoc.childCount, newDoc.childCount) - P &&
    oldDoc.child(oldDoc.childCount - 1 - S).eq(newDoc.child(newDoc.childCount - 1 - S))
  )
    S++

  let fromPos = 0
  for (let i = 0; i < P; i++) fromPos += oldDoc.child(i).nodeSize
  let toPos = fromPos
  for (let i = P; i < oldDoc.childCount - S; i++) toPos += oldDoc.child(i).nodeSize
  const newNodes = []
  let insertedSize = 0
  for (let i = P; i < newDoc.childCount - S; i++) {
    newNodes.push(newDoc.child(i))
    insertedSize += newDoc.child(i).nodeSize
  }

  const tr = editor.state.tr.replaceWith(fromPos, toPos, newNodes)
  tr.setMeta('remoteMerge', { from: fromPos, to: fromPos + insertedSize })
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return { failures, changed: true }
}
