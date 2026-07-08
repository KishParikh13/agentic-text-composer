---
name: collab-doc
description: Use when the user wants to work on a markdown doc together in a live editor instead of chat — "open this in a collab doc", "let's edit this together", "hand me the draft to edit", or when a draft is ready for the user's review and edits.
---

# Collab Doc

Open a markdown file in Compose, the local live editor from this repo. The user edits in a browser, you edit the file on disk; both sync live. Your job after opening: stay responsive to their edits and comments.

## Setup check

`compose` is on PATH via npm link. If missing: build and `npm link` the agentic-text-composer repo.

## Workflow

1. Resolve the file path. If the content only exists in chat, write it to a sensible `.md` file first.
2. Run `compose <file>`. It prints the doc URL and opens their browser. Tell them it's open.
3. Start the watch loop as a BACKGROUND task (it blocks up to an hour; foreground would hang your turn):
   `compose wait <file>` with run_in_background. Arming the wait is NOT the end of the job: when
   the background task exits you get woken with its output. Ending your turn here is fine and
   expected; the loop continues when you wake.
4. On wake, read the task output and act on it:
   - Edit summaries: context only. Act only if the edit asks for something.
   - Comments: do what the comment asks (edit the file directly), then
     `compose reply <file> <id> <short reply>` and `compose resolve <file> <id>`.
5. Re-arm using the printed `compose wait <file> --since N` line, again in the background. Keep looping until the user says stop or the session ends.

## Rules

- Edit the doc by editing the file normally. Changes appear in their editor live, highlighted.
- Not sure about a change, or have a question or suggestion? Do not edit. Leave a comment instead:
  `compose comment <file> --on "<exact text from the doc>" <your question or suggestion>`
  (omit `--on` for a whole-doc note). Their reply in the UI wakes your wait loop.
- Edit directly only when the change was asked for or is safe to assume.
- Your own file writes emit no events, so you will not wake yourself.
- Reply before resolving. Resolve only after the work is done.
- Exit code 2 means timeout with no activity: re-arm silently, do not message the user.
- `compose comments <file>` lists open comment ids if you lose track.
