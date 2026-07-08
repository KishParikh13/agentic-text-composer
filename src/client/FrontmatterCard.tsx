export function FrontmatterCard({
  frontmatter,
  onChange,
}: {
  frontmatter: string | null
  onChange: (fm: string | null) => void
}) {
  if (frontmatter === null) return null
  return (
    <details className="frontmatter-card">
      <summary>frontmatter</summary>
      <textarea
        value={frontmatter}
        rows={Math.min(12, frontmatter.split('\n').length + 1)}
        onChange={e => onChange(e.target.value || null)}
        spellCheck={false}
      />
    </details>
  )
}
