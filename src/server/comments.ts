import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { stateDir } from './paths'

export interface CommentReply {
  author: 'you' | 'agent'
  body: string
  ts: number
}

export interface Comment {
  id: string
  anchorText: string
  body: string
  author: 'you' | 'agent'
  ts: number
  resolved: boolean
  replies: CommentReply[]
}

export class CommentStore {
  private cache = new Map<string, Comment[]>()

  private fileFor(docId: string) {
    return join(stateDir(), 'comments', `${docId}.json`)
  }

  async list(docId: string): Promise<Comment[]> {
    if (this.cache.has(docId)) return this.cache.get(docId)!
    try {
      const list = JSON.parse(await readFile(this.fileFor(docId), 'utf8')) as Comment[]
      this.cache.set(docId, list)
      return list
    } catch {
      const empty: Comment[] = []
      this.cache.set(docId, empty)
      return empty
    }
  }

  private async persist(docId: string) {
    await mkdir(join(stateDir(), 'comments'), { recursive: true })
    await writeFile(this.fileFor(docId), JSON.stringify(this.cache.get(docId) ?? [], null, 2), 'utf8')
  }

  async add(
    docId: string,
    input: { anchorText: string; body: string; author: 'you' | 'agent' },
  ): Promise<Comment> {
    const list = await this.list(docId)
    const comment: Comment = {
      id: randomBytes(4).toString('hex'),
      anchorText: input.anchorText,
      body: input.body,
      author: input.author,
      ts: Date.now(),
      resolved: false,
      replies: [],
    }
    list.push(comment)
    await this.persist(docId)
    return comment
  }

  private async find(docId: string, commentId: string): Promise<Comment> {
    const c = (await this.list(docId)).find(c => c.id === commentId)
    if (!c) throw new Error(`unknown comment id: ${commentId}`)
    return c
  }

  async reply(docId: string, commentId: string, input: { body: string; author: 'you' | 'agent' }): Promise<CommentReply> {
    const c = await this.find(docId, commentId)
    const reply: CommentReply = { author: input.author, body: input.body, ts: Date.now() }
    c.replies.push(reply)
    await this.persist(docId)
    return reply
  }

  async resolve(docId: string, commentId: string): Promise<void> {
    const c = await this.find(docId, commentId)
    c.resolved = true
    await this.persist(docId)
  }
}
