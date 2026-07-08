import { createEditor, getMarkdown, setMarkdown } from './markdown'

const CORPUS = [
  '# Title\n\nA paragraph with **bold** and *italic* and `code`.',
  '- one\n- two\n- three',
  '1. first\n2. second',
  '> a quote',
  '```js\nconst x = 1\n```',
  '| a | b |\n| --- | --- |\n| 1 | 2 |',
  '[link](https://example.com)',
  '---',
]

it('round-trips a markdown corpus stably', () => {
  const ed = createEditor(null, { onUpdate: () => {} })
  for (const md of CORPUS) {
    setMarkdown(ed, md)
    const once = getMarkdown(ed)
    setMarkdown(ed, once)
    expect(getMarkdown(ed)).toBe(once)
  }
  ed.destroy()
})

it('preserves heading + paragraph structure', () => {
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, '# H\n\npara')
  expect(getMarkdown(ed)).toContain('# H')
  expect(getMarkdown(ed)).toContain('para')
  ed.destroy()
})
