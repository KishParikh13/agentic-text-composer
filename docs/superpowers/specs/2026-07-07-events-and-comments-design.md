# compose v1.5 — agent wake-ups and comments

Date: 2026-07-07
Status: Approved

## Purpose

Close the loop in the human direction. v1 lets the agent write and the human
see it live. v1.5 lets the agent block on human activity: UI edits and
anchored comments both wake a waiting `compose wait` process, and the agent
can reply to and resolve comments from the CLI.

## Event log

- Per-doc, in-memory, ordered list with monotonically increasing `seq` from 1.
- Producers:
  - `human-edit` — emitted when a UI client save changes the doc
    (`handleClientSave` returns a patch). Carries `summary`: a readable diff
    (capped `+ "inserted"` / `- "deleted"` lines from diff-match-patch).
  - `comment-added` { comment }, `comment-replied` { commentId, reply },
    `comment-resolved` { commentId }.
- Agent (external file) writes emit NO events.
- Edit events are session-only. Comments persist to
  `~/.compose/comments/<docId>.json`.

## Comments model

```ts
interface CommentReply { author: 'you' | 'agent'; body: string; ts: number }
interface Comment {
  id: string            // 8 hex chars
  anchorText: string    // the selected text, search-anchored in the UI
  body: string
  author: 'you' | 'agent'
  ts: number
  resolved: boolean
  replies: CommentReply[]
}
```

Anchoring is search-based: the UI scrolls to and flashes the first occurrence
of `anchorText`; if the text no longer exists the comment shows as unanchored
in the rail. No position tracking.

## HTTP API

- `GET /api/docs/:id/events?since=N&waitMs=25000` — long-poll. Returns
  `{ events, latest }` immediately when events newer than N exist, else holds
  until an event lands or waitMs expires (then `{ events: [], latest }`).
  waitMs capped at 30000.
- `GET /api/docs/:id/comments` — full list.
- `POST /api/docs/:id/comments` `{ anchorText, body, author }` → comment.
- `POST /api/docs/:id/comments/:cid/replies` `{ body, author }` → reply.
- `POST /api/docs/:id/comments/:cid/resolve` → `{ ok }`.
- WS: any comment change broadcasts `{ type: 'comments', comments }` to the
  doc's clients so the rail updates live.

## CLI

- `compose wait <file.md> [--timeout <sec>] [--since N]` — ensure server +
  doc open, long-poll in a loop from `--since` (default: latest at start).
  On first nonempty batch: print events as markdown (diff summaries, comment
  bodies with quoted anchor and id), print `next: compose wait <file> --since N`,
  exit 0. On timeout (default 3600 s): print nothing useful, exit 2.
- `compose comments <file.md>` — open comments as markdown with ids.
- `compose reply <file.md> <commentId> <text...>` — reply as `agent`.
- `compose resolve <file.md> <commentId>` — resolve.

## UI

- Selection bubble: selecting text in the editor shows a small Comment button
  positioned near the selection; clicking opens a compose box in the right
  rail with the anchor quoted.
- Comments rail (right column): open comments with quoted anchor, body,
  threaded replies, reply input, resolve button. Resolved comments hidden
  behind a toggle. Clicking a comment scrolls to the anchor occurrence and
  flashes it.

## Agent workflow (README)

Open doc → run `compose wait <file>` as a background task → on exit read its
output → edit the file and/or `compose reply` / `compose resolve` → run
`compose wait` again with the printed `--since`.

## Out of scope

- Position-tracked anchors / CRDT comment ranges.
- Suggestion (tracked-change) objects — still v2, likely MCP.
- Multi-agent identity (single 'agent' author label).
