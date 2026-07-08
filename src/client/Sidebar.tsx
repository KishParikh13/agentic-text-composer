import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { DocInfo } from '../shared/protocol'
import { extractOutline, type OutlineEntry } from './outline'
import { openAndGo } from './App'

export function Sidebar({ editor }: { editor: Editor | null }) {
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [recent, setRecent] = useState<DocInfo[]>([])

  useEffect(() => {
    fetch('/api/recent')
      .then(r => r.json())
      .then(setRecent)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editor) return
    const update = () => setOutline(extractOutline(editor))
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])

  const jump = (pos: number) => {
    editor?.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
  }

  return (
    <>
      {outline.length > 0 && (
        <>
          <h3>Outline</h3>
          <ul className="outline">
            {outline.map((h, i) => (
              <li key={i}>
                <button className={`lvl-${h.level}`} onClick={() => jump(h.pos)}>
                  {h.text || '(untitled)'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {recent.length > 0 && (
        <>
          <h3>Recent</h3>
          <ul className="outline">
            {recent.map(d => (
              <li key={d.id}>
                <button onClick={() => openAndGo(d.path)} title={d.path}>
                  {d.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
