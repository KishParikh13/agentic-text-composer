import { createEditor, setMarkdown } from './editor/markdown'
import { extractOutline } from './outline'

it('extracts headings with levels and ascending positions', () => {
  const ed = createEditor(null, { onUpdate: () => {} })
  setMarkdown(ed, '# A\n\npara\n\n## B\n\nmore')
  const outline = extractOutline(ed)
  expect(outline).toHaveLength(2)
  expect(outline[0]).toMatchObject({ level: 1, text: 'A' })
  expect(outline[1]).toMatchObject({ level: 2, text: 'B' })
  expect(outline[1].pos).toBeGreaterThan(outline[0].pos)
  ed.destroy()
})
