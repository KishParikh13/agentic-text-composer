import { vi } from 'vitest'
import DiffMatchPatch from 'diff-match-patch'
import { createEditor, getMarkdown } from './editor/markdown'
import { createSyncController } from './useSync'

const dmp = new DiffMatchPatch()
const patchOf = (a: string, b: string) => dmp.patch_toText(dmp.patch_make(a, b))

class FakeSocket {
  sent: any[] = []
  onopen: any = null
  onmessage: any = null
  onclose: any = null
  send(d: string) {
    this.sent.push(JSON.parse(d))
  }
  close() {}
  open() {
    this.onopen?.()
  }
  msg(m: any) {
    this.onmessage?.({ data: JSON.stringify(m) })
  }
  drop() {
    this.onclose?.()
  }
}

const setup = () => {
  const editor = createEditor(null, { onUpdate: () => {} })
  const sockets: FakeSocket[] = []
  const statuses: string[] = []
  const fms: (string | null)[] = []
  const ctl = createSyncController({
    editor,
    makeSocket: () => {
      const s = new FakeSocket()
      sockets.push(s)
      return s as any
    },
    onStatus: s => statuses.push(s),
    onFrontmatter: fm => fms.push(fm),
  })
  ctl.start()
  sockets[0].open()
  return { editor, sockets, statuses, fms, ctl }
}

it('init populates editor and splits frontmatter', () => {
  const { editor, sockets, fms } = setup()
  sockets[0].msg({ type: 'init', docId: 'x', path: '/tmp/x.md', text: '---\nt: 1\n---\n\n# Hi\n', hash: 'h' })
  expect(getMarkdown(editor)).toContain('# Hi')
  expect(getMarkdown(editor)).not.toContain('t: 1')
  expect(fms[0]).toBe('t: 1')
  editor.destroy()
})

it('local edit debounces into a save with frontmatter rejoined', () => {
  vi.useFakeTimers()
  const { sockets, ctl, editor } = setup()
  sockets[0].msg({ type: 'init', docId: 'x', path: '/x', text: '---\nt: 1\n---\n\nbody\n', hash: 'h' })
  editor.commands.insertContentAt(editor.state.doc.content.size, '<p>typed</p>')
  ctl.noteLocalEdit()
  vi.advanceTimersByTime(600)
  const save = sockets[0].sent.find(m => m.type === 'save')
  expect(save).toBeDefined()
  expect(save.text.startsWith('---\nt: 1\n---')).toBe(true)
  expect(save.text).toContain('typed')
  vi.useRealTimers()
  editor.destroy()
})

it('remote patch merges into a clean editor', () => {
  const { sockets, editor, statuses } = setup()
  const v1 = '# Doc\n\nfirst\n'
  sockets[0].msg({ type: 'init', docId: 'x', path: '/x', text: v1, hash: 'h1' })
  const v2 = '# Doc\n\nfirst\n\nagent added\n'
  sockets[0].msg({ type: 'patch', patchText: patchOf(v1, v2), fullText: v2, hash: 'h2', source: 'external' })
  expect(getMarkdown(editor)).toContain('agent added')
  expect(statuses.at(-1)).toBe('synced')
  editor.destroy()
})

it('remote patch merges into a dirty editor and schedules save-back', () => {
  vi.useFakeTimers()
  const { sockets, editor, ctl } = setup()
  const v1 = '# Doc\n\nfirst para\n\nlast para\n'
  sockets[0].msg({ type: 'init', docId: 'x', path: '/x', text: v1, hash: 'h1' })
  editor.commands.insertContentAt(editor.state.doc.content.size, '<p>local unsaved</p>')
  ctl.noteLocalEdit()
  const v2 = v1.replace('first para', 'first para agent-touched')
  sockets[0].msg({ type: 'patch', patchText: patchOf(v1, v2), fullText: v2, hash: 'h2', source: 'external' })
  expect(getMarkdown(editor)).toContain('agent-touched')
  expect(getMarkdown(editor)).toContain('local unsaved')
  vi.advanceTimersByTime(600)
  const save = sockets[0].sent.find(m => m.type === 'save')
  expect(save).toBeDefined()
  expect(save.text).toContain('agent-touched')
  expect(save.text).toContain('local unsaved')
  vi.useRealTimers()
  editor.destroy()
})

it('file-missing sets status', () => {
  const { sockets, statuses, editor } = setup()
  sockets[0].msg({ type: 'init', docId: 'x', path: '/x', text: 'a\n', hash: 'h' })
  sockets[0].msg({ type: 'file-missing' })
  expect(statuses.at(-1)).toBe('file-missing')
  editor.destroy()
})

it('reconnects with a fresh socket after close', () => {
  vi.useFakeTimers()
  const { sockets, statuses, editor } = setup()
  sockets[0].msg({ type: 'init', docId: 'x', path: '/x', text: 'a\n', hash: 'h' })
  sockets[0].drop()
  expect(statuses.at(-1)).toBe('offline')
  vi.advanceTimersByTime(600)
  expect(sockets.length).toBe(2)
  vi.useRealTimers()
  editor.destroy()
})
