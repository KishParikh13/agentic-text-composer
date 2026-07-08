import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { createEditor } from './editor/markdown'
import { createSyncController, type SyncStatus } from './useSync'

export interface EditorHandle {
  editor: Editor
  setFrontmatter: (fm: string | null) => void
}

interface Bubble {
  x: number
  y: number
  text: string
}

export function EditorView({
  docId,
  onReady,
  onStatus,
  onFrontmatter,
  onComments,
  onCommentAnchor,
}: {
  docId: string
  onReady: (h: EditorHandle) => void
  onStatus: (s: SyncStatus) => void
  onFrontmatter: (fm: string | null) => void
  onComments: (comments: unknown[]) => void
  onCommentAnchor: (text: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [bubble, setBubble] = useState<Bubble | null>(null)

  useEffect(() => {
    const editor = createEditor(host.current!, { onUpdate: () => {} })
    const ctl = createSyncController({
      editor,
      makeSocket: () => new WebSocket(`ws://${location.host}/ws/${docId}`) as any,
      onStatus,
      onFrontmatter,
      onComments,
    })
    editor.on('selectionUpdate', ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection
      if (empty || to - from < 2) {
        setBubble(null)
        return
      }
      const text = ed.state.doc.textBetween(from, to, '\n').trim()
      if (!text) {
        setBubble(null)
        return
      }
      const coords = (ed as Editor).view.coordsAtPos(from)
      setBubble({ x: coords.left, y: coords.top - 38, text })
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

  return (
    <>
      {bubble && (
        <button
          className="comment-bubble"
          style={{ left: bubble.x, top: bubble.y }}
          onMouseDown={e => {
            e.preventDefault()
            onCommentAnchor(bubble.text)
            setBubble(null)
          }}
        >
          💬 Comment
        </button>
      )}
      <div className="editor-host" ref={host} />
    </>
  )
}
