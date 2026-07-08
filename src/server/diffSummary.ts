import DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch()
const MAX_LINES = 12
const MAX_SNIPPET = 120

const clip = (s: string) => {
  const t = s.trim().replace(/\n+/g, ' ⏎ ')
  return t.length > MAX_SNIPPET ? `${t.slice(0, MAX_SNIPPET)}…` : t
}

export function summarizeDiff(oldText: string, newText: string): string {
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)
  const lines: string[] = []
  for (const [op, text] of diffs) {
    if (op === 0 || !text.trim()) continue
    lines.push(`${op === 1 ? '+' : '-'} "${clip(text)}"`)
    if (lines.length === MAX_LINES) {
      lines.push('… (more changes)')
      break
    }
  }
  return lines.join('\n')
}
