import { useEffect, useState } from 'react'

interface SnapshotEntry {
  file: string
  mtimeMs: number
  source: 'you' | 'external'
}

export function HistoryPanel({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [list, setList] = useState<SnapshotEntry[]>([])
  const [selected, setSelected] = useState<SnapshotEntry | null>(null)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    fetch(`/api/docs/${docId}/history`)
      .then(r => r.json())
      .then(setList)
      .catch(() => {})
  }, [docId])

  const pick = async (e: SnapshotEntry) => {
    setSelected(e)
    const r = await fetch(`/api/docs/${docId}/history/${e.file}`)
    setPreview((await r.json()).text)
  }

  const restore = async () => {
    if (!selected) return
    await fetch(`/api/docs/${docId}/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: selected.file }),
    })
    onClose()
  }

  return (
    <div className="history-panel">
      {list.length === 0 && <p>No snapshots yet. They appear as you and the agent edit.</p>}
      <ul>
        {list.map(e => (
          <li key={e.file}>
            <button onClick={() => pick(e)}>{new Date(e.mtimeMs).toLocaleString()}</button>
            <span className="snap-source">before {e.source === 'you' ? 'your edit' : 'external change'}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <>
          <pre>{preview}</pre>
          <button className="restore" onClick={restore}>
            Restore this version
          </button>
        </>
      )}
    </div>
  )
}
