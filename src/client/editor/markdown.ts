import { Editor } from '@tiptap/core'
import { buildExtensions } from './extensions'

export function createEditor(container: HTMLElement | null, opts: { onUpdate: (ed: Editor) => void }): Editor {
  return new Editor({
    ...(container ? { element: container } : {}),
    extensions: buildExtensions(),
    content: '',
    onUpdate: ({ editor }) => opts.onUpdate(editor as Editor),
  })
}

export const getMarkdown = (ed: Editor): string => ed.storage.markdown.getMarkdown()

export const setMarkdown = (ed: Editor, md: string) => ed.commands.setContent(md, false)
