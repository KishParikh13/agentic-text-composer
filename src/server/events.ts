import type { Comment, CommentReply } from './comments'

export type DocEvent = { seq: number; ts: number } & (
  | { kind: 'human-edit'; summary: string }
  | { kind: 'comment-added'; comment: Comment }
  | { kind: 'comment-replied'; commentId: string; reply: CommentReply }
  | { kind: 'comment-resolved'; commentId: string }
)

export type NewDocEvent =
  | { kind: 'human-edit'; summary: string }
  | { kind: 'comment-added'; comment: Comment }
  | { kind: 'comment-replied'; commentId: string; reply: CommentReply }
  | { kind: 'comment-resolved'; commentId: string }

interface Waiter {
  seq: number
  resolve: (events: DocEvent[]) => void
  timer: ReturnType<typeof setTimeout>
}

export class EventLog {
  private logs = new Map<string, DocEvent[]>()
  private waiters = new Map<string, Set<Waiter>>()

  append(docId: string, event: NewDocEvent): DocEvent {
    const log = this.logs.get(docId) ?? []
    const stamped: DocEvent = { ...event, seq: log.length + 1, ts: Date.now() }
    log.push(stamped)
    this.logs.set(docId, log)
    for (const w of this.waiters.get(docId) ?? new Set()) {
      const events = this.since(docId, w.seq)
      if (events.length) {
        clearTimeout(w.timer)
        this.waiters.get(docId)!.delete(w)
        w.resolve(events)
      }
    }
    return stamped
  }

  since(docId: string, seq: number): DocEvent[] {
    return (this.logs.get(docId) ?? []).filter(e => e.seq > seq)
  }

  latest(docId: string): number {
    return this.logs.get(docId)?.length ?? 0
  }

  waitFor(docId: string, seq: number, waitMs: number): Promise<DocEvent[]> {
    const existing = this.since(docId, seq)
    if (existing.length) return Promise.resolve(existing)
    return new Promise(resolve => {
      const waiter: Waiter = {
        seq,
        resolve,
        timer: setTimeout(() => {
          this.waiters.get(docId)?.delete(waiter)
          resolve([])
        }, waitMs),
      }
      if (!this.waiters.has(docId)) this.waiters.set(docId, new Set())
      this.waiters.get(docId)!.add(waiter)
    })
  }
}
