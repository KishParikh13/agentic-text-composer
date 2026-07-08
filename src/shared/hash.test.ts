import { sha256Hex, docIdForPath } from './hash'

it('hashes deterministically', () => expect(sha256Hex('a')).toBe(sha256Hex('a')))

it('docId is 12 hex chars and stable', () => {
  expect(docIdForPath('/tmp/x.md')).toMatch(/^[0-9a-f]{12}$/)
  expect(docIdForPath('/tmp/x.md')).toBe(docIdForPath('/tmp/x.md'))
})
