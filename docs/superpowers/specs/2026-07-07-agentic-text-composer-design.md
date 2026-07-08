# compose — local agentic markdown composer

Date: 2026-07-07
Status: Approved

## Purpose

A local, open source (MIT) alternative to usecomposer.md. Opening a markdown file
launches a browser-based WYSIWYG editor. The human edits in the UI; the agent
(Claude Code or any tool that can edit files) edits the same file on disk with its
normal file tools. Both views stay live-merged, so doc collaboration stops going
through agent chat.

Core decisions (made with Kish, 2026-07-07):

- **Agent link: file-sync only.** The .md file on disk is the single source of
  truth. No MCP server in v1. Any agent that can write files works.
- **Editor: WYSIWYG markdown.** Notion/Composer-style rich editing, serialized to
  markdown on disk.
- **Launch: CLI + macOS default-app wrapper.** `compose notes.md` opens a browser
  tab; a tiny .app wrapper lets Finder open .md files with it.
- **Sync engine: diff-merge.** Plain-text diffing, no CRDT.
- **V1 extras:** agent-edit highlights, outline sidebar, snapshot history.
  (Slash-command menu explicitly deferred.)

## Stack

One TypeScript package.

- Server: Node 20+, Fastify + `@fastify/websocket`, chokidar (file watching),
  diff-match-patch (text diffing), gray-matter (frontmatter split).
- Client: React + Tiptap (ProseMirror) with markdown serialization, built with
  Vite. Static build served by the server, so a global/`npx` install needs no
  build step.
- Tests: Vitest for units, Playwright for one end-to-end flow.

## Components

### 1. CLI (`compose`)

- `compose <file.md>` — ensure server is running (lockfile + port + PID in
  `~/.compose/server.json`; spawn detached if absent or dead), POST the absolute
  path to the server's `/api/open` endpoint to get a doc id, open
  `http://localhost:<port>/doc/<id>` in the default browser.
- `compose install-app` — generate `Compose.app` (a shell-script .app bundle
  whose executable calls the CLI with the dropped file) into `/Applications`,
  and print instructions for "Open With / default app" assignment.
- Port selection: default 4300, walk upward if taken.

### 2. Server

- Registry of open docs: `{ id, absPath, canonicalText, canonicalHash }`.
  Doc id = short hash of the absolute path (stable across restarts).
- Watches each open doc's file with chokidar (`awaitWriteFinish`) so partially
  written agent saves don't produce flicker or corrupt diffs.
- WebSocket per doc: broadcasts patches to clients, receives saves from clients.
- Writes are atomic: write temp file in the same directory, rename over target.
- Echo suppression: after writing, record the written content hash; watcher
  events whose content hash matches the last write are ignored.

### 3. Client (editor UI)

- Tiptap WYSIWYG: headings, bold/italic/code, lists, tables, code blocks,
  blockquotes, links, horizontal rules. Markdown in/out via
  prosemirror-markdown with conservative serializer settings.
- YAML frontmatter: split with gray-matter before the editor sees the body;
  shown as a collapsible card above the doc containing a plain-text editor
  (edits allowed, but as raw YAML — no rich fields in v1); re-joined on save.
- Outline sidebar: heading tree for the open doc + recent docs list (persisted
  in `~/.compose/recent.json` so it survives server restarts).
- Agent-edit highlights: ranges inserted by remote patches get a decoration that
  fades after ~3 seconds.
- History panel: list snapshots, preview, restore.

## Sync protocol (the heart)

Rule: **the live editor is where merging happens.**

- **Agent → human:** watcher fires → read file → if hash differs from canonical,
  compute diff-match-patch patches canonical→new → broadcast over WebSocket →
  client maps text-offset patches into ProseMirror transactions (positions
  remapped through any concurrent local edits) applied with a `remote` meta →
  decorations highlight inserted ranges. Server updates canonical to the new
  file text.
- **Human → disk:** editor serializes body to markdown, rejoins frontmatter,
  debounce-saves (~500 ms idle) over WebSocket → server writes atomically,
  updates canonical + last-write hash.
- **Simultaneous edits:** file patches apply *into* the live editor doc (which
  still holds unsaved local edits); the merged doc then saves back on the next
  debounce tick. No locks, no reload banners, no lost keystrokes.
- **Patch failure:** diff-match-patch fuzzy apply almost always succeeds; when a
  hunk cannot apply, keep the local version of that region and show a
  non-blocking conflict flag on the affected block. As a last resort the user
  can restore either side from history.

### Mapping text patches into the editor

The server diffs plain markdown text, but the client edits a ProseMirror doc.
The client keeps the last markdown text it produced/received; incoming patches
apply to that text, then the client computes a minimal ProseMirror transaction
by re-parsing changed regions (block-level granularity: re-parse and replace
only the blocks whose source text changed). This is the trickiest unit and gets
the densest tests.

## Snapshot history

- On every external change (before applying) and before every save-back, append
  the prior canonical text to `~/.compose/history/<doc-id>/<ISO-timestamp>.md`.
- Cap 200 snapshots per doc; delete oldest beyond the cap. Skip a snapshot when
  identical to the newest existing one.
- History panel: list with timestamps + source ("you" / "external"), preview
  diff vs current, one-click restore (restore = normal save, so it is itself
  snapshotted and broadcast).

## Round-trip fidelity trade-off

Markdown that round-trips through the WYSIWYG serializer can be normalized
(bullet markers, emphasis markers, wrapping). Agent-only changes never
round-trip. Normalization happens only when the human actually edits.
Serializer configured to be as conservative as possible; document this in the
README.

## Error handling

- File deleted or renamed: non-blocking banner with "re-link to a file" and
  "save current buffer as…" actions; editor stays usable.
- Port in use: walk to next free port; CLI reads actual port from lockfile.
- File > 2 MB or not UTF-8 text: refuse to open with a clear message.
- Server crash: CLI detects dead PID in lockfile and respawns; client reconnects
  with exponential backoff and re-syncs from a fresh snapshot (full text) on
  reconnect.

## Testing

- Vitest units: patch mapping (text diff → editor transaction, including
  concurrent-local-edit remapping), echo suppression, atomic write, snapshot
  rotation/dedupe, frontmatter split/rejoin, markdown round-trip on a corpus of
  fixture docs.
- Playwright e2e: start server, open a doc, (1) append to the file externally →
  editor shows the new text with a highlight; (2) type in the editor → file on
  disk contains the typed text after the debounce; (3) simultaneous external
  write while typing → both changes present in file and editor.

## Out of scope for v1

- MCP server layer (tracked suggestions, comments, agent presence) — the
  architecture keeps the server as the single sync point so this can be added
  as a v2 without rework.
- Multi-user human collaboration (would motivate Yjs).
- Slash-command menu / floating toolbar.
- Non-macOS default-app wrappers (CLI itself is cross-platform).
- Rich frontmatter editing.
- Images/attachment management beyond rendering relative image paths.
