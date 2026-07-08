# Compose

A local, open source markdown composer for working on docs with a coding agent. You edit in a clean WYSIWYG editor in your browser. The agent edits the same file on disk with its normal file tools. Both stay in sync, live. No cloud, no accounts, no agent integration required.

Inspired by [usecomposer.md](https://usecomposer.md), rebuilt around one idea: the file on disk is the source of truth.

## Install

```bash
npm install
npm run build
npm link        # puts `compose` on your PATH
```

## Use

```bash
compose notes.md
```

A browser tab opens with the doc. Start editing. Point your agent at the file path. That's it. When the agent writes the file, the change appears in your editor within a moment, highlighted so you can see what it touched. When you type, the file on disk updates about half a second after you pause.

```bash
compose install-app
```

Generates `Compose.app` so Finder can open markdown files with it. Right-click a .md file, Get Info, Open with: Compose, Change All.

## How the sync works

The server watches the file and holds its last known text. When the file changes externally, it diffs old against new and streams a minimal patch to the editor. The patch applies into your live document, so your cursor and any unsaved typing survive. If you both edit at once, the merged result saves back to disk. No locks, no reload prompts.

Every change is snapshotted first. Click "history" in the doc header to preview and restore any of the last 200 versions.

One caveat: the WYSIWYG editor serializes markdown its own way. The first time you edit a doc, formatting may normalize (bullet style, emphasis markers). Agent-only changes never touch the serializer.

## Comments

Select text in the editor and click Comment. The note lands in a rail on the right, quoting the text you selected. The agent reads it, replies, and resolves it from the CLI. Threads update live.

## For agents

Read and write the markdown file like any other file. Writes should be atomic (write temp, rename) for clean diffs; most tools already do this.

To get woken up when the human edits or comments, block on:

```bash
compose wait doc.md            # exits when the human saves or comments, prints what happened
compose comments doc.md        # list open comments with ids
compose reply doc.md <id> your reply text
compose resolve doc.md <id>
```

`compose wait` prints a `--since` hint so the next wait picks up exactly where this one left off.

Claude Code users: copy the ready-made skill instead, then say "open this in a collab doc" in any session:

```bash
cp -r skills/collab-doc ~/.claude/skills/
```

Or paste this into your agent instructions (CLAUDE.md or similar):

```
When collaborating on a doc through compose, run `compose wait <file>` as a
background task. When it exits, read its output: apply requested edits to the
file, answer comments with `compose reply <file> <id> <text>`, and mark them
done with `compose resolve <file> <id>`. Then run the printed
`compose wait <file> --since N` again and keep the loop going.
```

## State

`~/.compose/` holds the server lockfile, recent docs list, and history snapshots. Delete it anytime.

## Development

```bash
npm test        # unit + integration
npm run e2e     # playwright, needs `npm run build` first
```

MIT