// Verbatim frontmatter split/join: join(split(t)) === t for any input.
// The newline after the closing fence stays in `body`, so join is exact even
// when the fence has no trailing newline.
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/

export function splitFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const m = text.match(FM_RE)
  if (!m) return { frontmatter: null, body: text }
  return { frontmatter: m[1], body: text.slice(m[0].length) }
}

export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (frontmatter === null) return body
  return `---\n${frontmatter}\n---${body}`
}
