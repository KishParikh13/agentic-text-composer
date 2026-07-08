import DiffMatchPatch from 'diff-match-patch'
import { TextSelection } from '@tiptap/pm/state'
import { createEditor, getMarkdown, setMarkdown } from './markdown'
import { applyRemotePatch } from './remoteMerge'

const dmp = new DiffMatchPatch()
const patchOf = (a: string, b: string) => dmp.patch_toText(dmp.patch_make(a, b))

// Corpus text as the editor would serialize it, so patches align with the
// editor's own markdown output.
const norm = (md: string) => {
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, md)
  const out = getMarkdown(ed)
  ed.destroy()
  return out
}

const replaceInDoc = (ed: ReturnType<typeof createEditor>, find: string, replacement: string) => {
  let found: number | null = null
  ed.state.doc.descendants((node, pos) => {
    if (found === null && node.isText && node.text?.includes(find)) {
      found = pos + node.text.indexOf(find)
      return false
    }
    return true
  })
  expect(found).not.toBeNull()
  const tr = ed.state.tr.insertText(replacement, found!, found! + find.length)
  ed.view.dispatch(tr)
}

it('applies an external change to a clean editor', () => {
  const base = norm('# T\n\nfirst para\n\nsecond para')
  const next = base.replace('second para', 'second para, agent-edited')
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, base)
  const r = applyRemotePatch(ed, patchOf(base, next), next)
  expect(r).toMatchObject({ failures: 0, changed: true })
  expect(getMarkdown(ed)).toBe(next)
  ed.destroy()
})

it('merges when the editor has local unsaved edits elsewhere', () => {
  const base = norm('# T\n\nalpha para\n\nomega para')
  const remote = base.replace('omega para', 'omega para grown by agent')
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, base)
  replaceInDoc(ed, 'alpha', 'ALPHA-LOCAL')
  const r = applyRemotePatch(ed, patchOf(base, remote), remote)
  expect(r.failures).toBe(0)
  const out = getMarkdown(ed)
  expect(out).toContain('ALPHA-LOCAL')
  expect(out).toContain('grown by agent')
  ed.destroy()
})

it('cursor in an untouched block survives', () => {
  const base = norm('first\n\nsecond\n\nthird')
  const remote = base.replace('third', 'third CHANGED')
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, base)
  const sel = TextSelection.create(ed.state.doc, 3)
  ed.view.dispatch(ed.state.tr.setSelection(sel))
  applyRemotePatch(ed, patchOf(base, remote), remote)
  expect(ed.state.selection.from).toBe(3)
  ed.destroy()
})

it('reports failures on unpatchable hunks', () => {
  const base = norm('one two three')
  const remote = base.replace('two', 'TWO')
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, norm('totally different document body with nothing in common at all'))
  const r = applyRemotePatch(ed, patchOf(base, remote), remote)
  expect(r.failures).toBeGreaterThan(0)
  ed.destroy()
})
