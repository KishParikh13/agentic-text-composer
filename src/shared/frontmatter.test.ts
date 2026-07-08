import { splitFrontmatter, joinFrontmatter } from './frontmatter'

const withFm = '---\ntitle: Hi\ntags: [a]\n---\n\n# Body\n'

it('splits frontmatter verbatim', () => {
  const { frontmatter, body } = splitFrontmatter(withFm)
  expect(frontmatter).toBe('title: Hi\ntags: [a]')
  expect(body).toBe('\n\n# Body\n')
})

it('round-trips exactly', () => {
  for (const t of [withFm, '# No fm\n', '---\na: 1\n---', '', '--\nnot fm\n']) {
    const { frontmatter, body } = splitFrontmatter(t)
    expect(joinFrontmatter(frontmatter, body)).toBe(t)
  }
})

it('no frontmatter yields null', () => {
  expect(splitFrontmatter('# Hey\n').frontmatter).toBeNull()
})
