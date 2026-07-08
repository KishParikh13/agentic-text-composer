import { useCallback, useState } from 'react'
import { EditorView, type EditorHandle } from './EditorView'
import { StatusPill } from './StatusPill'
import { FrontmatterCard } from './FrontmatterCard'
import type { SyncStatus } from './useSync'
import type { DocInfo } from '../shared/protocol'

export const openAndGo = async (path: string) => {
  const r = await fetch('/api/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const body = await r.json()
  if (r.ok) location.href = `/doc/${body.id}`
  else alert(`compose: ${body.error}`)
}

export function App({ docId }: { docId: string }) {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [frontmatter, setFrontmatter] = useState<string | null>(null)
  const [handle, setHandle] = useState<EditorHandle | null>(null)

  const onFrontmatter = useCallback((fm: string | null) => setFrontmatter(fm), [])

  return (
    <div className="app">
      <aside id="sidebar" className="sidebar" />
      <main className="doc-column">
        <header className="doc-header">
          <StatusPill status={status} />
        </header>
        {status === 'file-missing' && (
          <div className="banner">The file was deleted or renamed on disk. Your buffer is still here; copy anything you need.</div>
        )}
        <FrontmatterCard
          frontmatter={frontmatter}
          onChange={fm => {
            setFrontmatter(fm)
            handle?.setFrontmatter(fm)
          }}
        />
        <EditorView docId={docId} onReady={setHandle} onStatus={setStatus} onFrontmatter={onFrontmatter} />
      </main>
    </div>
  )
}

export function Landing() {
  const [recent, setRecent] = useState<DocInfo[] | null>(null)
  if (recent === null) {
    fetch('/api/recent')
      .then(r => r.json())
      .then(setRecent)
      .catch(() => setRecent([]))
    return null
  }
  return (
    <div className="landing">
      <h1>Compose</h1>
      <p>
        Open a doc from the terminal: <code>compose path/to/file.md</code>
      </p>
      {recent.length > 0 && (
        <>
          <h2>Recent</h2>
          <ul className="recent-list">
            {recent.map(d => (
              <li key={d.id}>
                <button onClick={() => openAndGo(d.path)}>{d.title}</button>
                <span className="recent-path">{d.path}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
