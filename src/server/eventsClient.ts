import type { DocEvent } from './events'
import type { Comment } from './comments'

// Loops long-polls until events arrive or timeoutMs elapses.
export async function pollEvents(
  port: number,
  docId: string,
  since: number,
  timeoutMs: number,
): Promise<{ events: DocEvent[]; latest: number }> {
  const deadline = Date.now() + timeoutMs
  let latest = since
  for (;;) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return { events: [], latest }
    const waitMs = Math.min(remaining, 25000)
    const r = await fetch(`http://127.0.0.1:${port}/api/docs/${docId}/events?since=${since}&waitMs=${waitMs}`)
    const body = (await r.json()) as { events: DocEvent[]; latest: number }
    latest = body.latest
    if (body.events.length) return body
  }
}

const fmtComment = (c: Comment) => {
  const lines = [`comment ${c.id} (${c.author}${c.resolved ? ', resolved' : ''}):`, `> ${c.anchorText}`, c.body]
  for (const r of c.replies) lines.push(`  ↳ ${r.author}: ${r.body}`)
  return lines.join('\n')
}

export function formatEvents(events: DocEvent[], file: string): string {
  const out: string[] = []
  for (const e of events) {
    if (e.kind === 'human-edit') out.push(`## The human edited the doc\n${e.summary || '(formatting-only change)'}`)
    if (e.kind === 'comment-added') out.push(`## New comment\n${fmtComment(e.comment as Comment)}`)
    if (e.kind === 'comment-replied') out.push(`## Reply on comment ${e.commentId}\n${(e as any).reply.author}: ${(e as any).reply.body}`)
    if (e.kind === 'comment-resolved') out.push(`## Comment ${e.commentId} resolved`)
  }
  const latest = events.length ? events[events.length - 1].seq : 0
  out.push(`\nnext: compose wait ${file} --since ${latest}`)
  return out.join('\n\n')
}

export function formatComments(comments: Comment[]): string {
  const open = comments.filter(c => !c.resolved)
  if (!open.length) return 'no open comments'
  return open.map(fmtComment).join('\n\n')
}
