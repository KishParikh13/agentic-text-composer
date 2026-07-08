import { useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { Comment } from '../server/comments'

const findInDoc = (editor: Editor, text: string): { from: number; to: number } | null => {
  let hit: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (hit) return false
    if (node.isText && node.text) {
      const i = node.text.indexOf(text)
      if (i >= 0) hit = { from: pos + i, to: pos + i + text.length }
    }
    return !hit
  })
  return hit
}

export function CommentsRail({
  docId,
  comments,
  editor,
  pendingAnchor,
  onClearPendingAnchor,
}: {
  docId: string
  comments: Comment[]
  editor: Editor | null
  pendingAnchor: string | null
  onClearPendingAnchor: () => void
}) {
  const [draft, setDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [showResolved, setShowResolved] = useState(false)

  const post = (path: string, body: unknown) =>
    fetch(`/api/docs/${docId}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  const submitComment = async () => {
    if (!draft.trim() || !pendingAnchor) return
    await post('/comments', { anchorText: pendingAnchor, body: draft.trim(), author: 'you' })
    setDraft('')
    onClearPendingAnchor()
  }

  const submitReply = async (id: string) => {
    const body = replyDrafts[id]?.trim()
    if (!body) return
    await post(`/comments/${id}/replies`, { body, author: 'you' })
    setReplyDrafts(d => ({ ...d, [id]: '' }))
  }

  const jumpTo = (c: Comment) => {
    if (!editor) return
    const hit = findInDoc(editor, c.anchorText)
    if (!hit) return
    editor.chain().focus().setTextSelection(hit.from).scrollIntoView().run()
    editor.view.dispatch(editor.state.tr.setMeta('remoteMerge', hit))
  }

  const visible = comments.filter(c => showResolved || !c.resolved)

  return (
    <aside className="comments-rail">
      <h3>
        Comments
        {comments.some(c => c.resolved) && (
          <button className="rail-toggle" onClick={() => setShowResolved(v => !v)}>
            {showResolved ? 'hide resolved' : 'show resolved'}
          </button>
        )}
      </h3>
      {pendingAnchor && (
        <div className="comment-compose">
          <blockquote>{pendingAnchor.length > 120 ? `${pendingAnchor.slice(0, 120)}…` : pendingAnchor}</blockquote>
          <textarea
            autoFocus
            placeholder="Comment for the agent…"
            value={draft}
            rows={3}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
            }}
          />
          <div className="compose-actions">
            <button className="restore" onClick={submitComment}>
              Comment
            </button>
            <button className="rail-toggle" onClick={onClearPendingAnchor}>
              cancel
            </button>
          </div>
        </div>
      )}
      {visible.length === 0 && !pendingAnchor && <p className="rail-empty">Select text in the doc to leave a comment.</p>}
      <ul className="comment-list">
        {visible.map(c => {
          const anchored = editor ? !!findInDoc(editor, c.anchorText) : true
          return (
            <li key={c.id} className={[c.resolved ? 'resolved' : '', c.author === 'agent' ? 'from-agent' : ''].join(' ')}>
              {c.anchorText ? (
                <blockquote onClick={() => jumpTo(c)} title={anchored ? 'jump to text' : 'original text was edited away'}>
                  {c.anchorText.length > 80 ? `${c.anchorText.slice(0, 80)}…` : c.anchorText}
                  {!anchored && <span className="unanchored"> (text changed)</span>}
                </blockquote>
              ) : (
                <blockquote className="general">whole doc</blockquote>
              )}
              <p>
                <strong className={`author-${c.author}`}>{c.author}:</strong> {c.body}
              </p>
              {c.replies.map((r, i) => (
                <p key={i} className="reply">
                  <strong className={`author-${r.author}`}>{r.author}:</strong> {r.body}
                </p>
              ))}
              {!c.resolved && (
                <div className="comment-actions">
                  <input
                    placeholder="Reply…"
                    value={replyDrafts[c.id] ?? ''}
                    onChange={e => setReplyDrafts(d => ({ ...d, [c.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitReply(c.id)
                    }}
                  />
                  <button className="rail-toggle" onClick={() => post(`/comments/${c.id}/resolve`, { author: 'you' })}>
                    resolve
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
