import DiffMatchPatch from 'diff-match-patch'
import type { Editor } from '@tiptap/core'
import type { ServerMsg } from '../shared/protocol'
import { splitFrontmatter, joinFrontmatter } from '../shared/frontmatter'
import { getMarkdown, setMarkdown } from './editor/markdown'
import { applyRemotePatch } from './editor/remoteMerge'

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'offline' | 'file-missing' | 'conflict'

export interface WebSocketLike {
  send(d: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((ev: { data: string }) => void) | null
  onclose: (() => void) | null
}

export interface SyncOpts {
  editor: Editor
  makeSocket: () => WebSocketLike
  onStatus: (s: SyncStatus) => void
  onFrontmatter: (fm: string | null) => void
  debounceMs?: number
}

const dmp = new DiffMatchPatch()

export function createSyncController(opts: SyncOpts) {
  const debounceMs = opts.debounceMs ?? 500
  let socket: WebSocketLike | null = null
  let currentFm: string | null = null
  let lastKnownFullText = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let backoff = 500
  let stopped = false
  let initialized = false

  const localFullText = () => joinFrontmatter(currentFm, getMarkdown(opts.editor))

  const scheduleSave = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const text = localFullText()
      if (text === lastKnownFullText) return
      opts.onStatus('saving')
      socket?.send(JSON.stringify({ type: 'save', text }))
      lastKnownFullText = text
    }, debounceMs)
  }

  // Merge incoming full text into the live editor: fuzzy-apply the patch to
  // the local full text (keeping unsaved edits), update the frontmatter card,
  // splice the body diff into the editor, and save back if the merge produced
  // something beyond what the file already has.
  const mergeIncoming = (patchText: string, incomingFullText: string) => {
    const localFull = localFullText()
    const [mergedFull, results] = dmp.patch_apply(dmp.patch_fromText(patchText), localFull) as [string, boolean[]]
    let failures = results.filter(ok => !ok).length

    const { frontmatter: newFm, body: mergedBody } = splitFrontmatter(mergedFull)
    if (newFm !== currentFm) {
      currentFm = newFm
      opts.onFrontmatter(newFm)
    }
    const localBody = getMarkdown(opts.editor)
    if (mergedBody !== localBody) {
      const bodyPatch = dmp.patch_toText(dmp.patch_make(localBody, mergedBody))
      const r = applyRemotePatch(opts.editor, bodyPatch, mergedBody)
      failures += r.failures
    }
    lastKnownFullText = incomingFullText
    opts.onStatus(failures > 0 ? 'conflict' : 'synced')
    if (mergedFull !== incomingFullText) scheduleSave()
  }

  const handleMsg = (msg: ServerMsg) => {
    if (msg.type === 'init') {
      if (!initialized) {
        const { frontmatter, body } = splitFrontmatter(msg.text)
        currentFm = frontmatter
        opts.onFrontmatter(frontmatter)
        setMarkdown(opts.editor, body)
        lastKnownFullText = msg.text
        initialized = true
        opts.onStatus('synced')
      } else {
        // Reconnect resync: treat the fresh init as a patch from the last
        // known text so unsaved local edits survive.
        const patchText = dmp.patch_toText(dmp.patch_make(lastKnownFullText, msg.text))
        mergeIncoming(patchText, msg.text)
      }
      return
    }
    if (msg.type === 'patch') {
      mergeIncoming(msg.patchText, msg.fullText)
      return
    }
    if (msg.type === 'saved') {
      opts.onStatus('synced')
      return
    }
    if (msg.type === 'file-missing') {
      opts.onStatus('file-missing')
    }
  }

  const connect = () => {
    if (stopped) return
    opts.onStatus('connecting')
    socket = opts.makeSocket()
    socket.onopen = () => {
      backoff = 500
    }
    socket.onmessage = ev => handleMsg(JSON.parse(ev.data) as ServerMsg)
    socket.onclose = () => {
      if (stopped) return
      opts.onStatus('offline')
      const wait = backoff
      backoff = Math.min(backoff * 2, 10000)
      setTimeout(connect, wait)
    }
  }

  return {
    start() {
      connect()
    },
    stop() {
      stopped = true
      if (timer) clearTimeout(timer)
      socket?.close()
    },
    noteLocalEdit() {
      if (initialized) scheduleSave()
    },
    setFrontmatter(fm: string | null) {
      currentFm = fm
      scheduleSave()
    },
  }
}
