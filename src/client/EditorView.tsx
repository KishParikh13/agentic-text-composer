import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { createEditor } from './editor/markdown'
import { createSyncController, type SyncStatus } from './useSync'

export interface EditorHandle {
  editor: Editor
  setFrontmatter: (fm: string | null) => void
}

export function EditorView({
  docId,
  onReady,
  onStatus,
  onFrontmatter,
}: {
  docId: string
  onReady: (h: EditorHandle) => void
  onStatus: (s: SyncStatus) => void
  onFrontmatter: (fm: string | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const editor = createEditor(host.current!, { onUpdate: () => {} })
    const ctl = createSyncController({
      editor,
      makeSocket: () => new WebSocket(`ws://${location.host}/ws/${docId}`) as any,
      onStatus,
      onFrontmatter,
    })
    editor.on('transaction', ({ transaction }) => {
      if (transaction.docChanged && !transaction.getMeta('remoteMerge')) ctl.noteLocalEdit()
    })
    ctl.start()
    onReady({ editor, setFrontmatter: fm => ctl.setFrontmatter(fm) })
    return () => {
      ctl.stop()
      editor.destroy()
    }
  }, [docId])

  return <div className="editor-host" ref={host} />
}
