export type ServerMsg =
  | { type: 'init'; docId: string; path: string; text: string; hash: string }
  | { type: 'patch'; patchText: string; fullText: string; hash: string; source: 'external' | 'client' }
  | { type: 'saved'; hash: string }
  | { type: 'file-missing' }

export type ClientMsg = { type: 'save'; text: string }

export interface DocInfo {
  id: string
  path: string
  title: string
}
