import type { Editor } from '@tiptap/core'

export interface OutlineEntry {
  level: number
  text: string
  pos: number
}

export function extractOutline(editor: Editor): OutlineEntry[] {
  const out: OutlineEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      out.push({ level: node.attrs.level, text: node.textContent, pos })
      return false
    }
    return true
  })
  return out
}
