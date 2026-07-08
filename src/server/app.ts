import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import chokidar, { type FSWatcher } from 'chokidar'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WebSocket } from 'ws'
import { DocRegistry, type Doc } from './registry'
import { handleClientSave, handleExternalChange } from './sync'
import { listSnapshots, readSnapshot } from './history'
import { stateDir } from './paths'
import type { ClientMsg } from '../shared/protocol'

export async function buildServer() {
  const fastify = Fastify({ logger: false })
  const registry = new DocRegistry()
  const sockets = new Map<string, Set<WebSocket>>()
  const watchers = new Map<string, FSWatcher>()

  const send = (ws: WebSocket, msg: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }
  const broadcast = (docId: string, msg: unknown, except?: WebSocket) => {
    for (const ws of sockets.get(docId) ?? []) if (ws !== except) send(ws, msg)
  }

  const watchDoc = (doc: Doc) => {
    if (watchers.has(doc.id)) return
    const w = chokidar.watch(doc.path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 20 },
    })
    w.on('change', async () => {
      try {
        const text = await readFile(doc.path, 'utf8')
        const msg = await handleExternalChange(doc, text)
        if (msg) broadcast(doc.id, msg)
      } catch {
        // transient read error; the next change event retries
      }
    })
    w.on('unlink', () => broadcast(doc.id, { type: 'file-missing' }))
    watchers.set(doc.id, w)
  }

  await fastify.register(websocket)

  const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public')
  if (existsSync(publicDir)) {
    await fastify.register(fastifyStatic, { root: publicDir })
    fastify.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/ws'))
        return reply.type('text/html').sendFile('index.html')
      reply.code(404).send({ error: 'not found' })
    })
  }

  fastify.get('/api/health', async () => ({ ok: true, pid: process.pid }))

  fastify.post<{ Body: { path: string } }>('/api/open', async (req, reply) => {
    try {
      const doc = await registry.openDoc(req.body.path)
      watchDoc(doc)
      return { id: doc.id }
    } catch (e: any) {
      return reply.code(400).send({ error: e.message })
    }
  })

  fastify.get('/api/recent', async () => registry.recent())

  fastify.get<{ Params: { id: string } }>('/api/docs/:id/history', async (req, reply) => {
    if (!registry.get(req.params.id)) return reply.code(404).send({ error: 'unknown doc' })
    return listSnapshots(req.params.id)
  })

  fastify.get<{ Params: { id: string; file: string } }>('/api/docs/:id/history/:file', async (req, reply) => {
    try {
      return { text: await readSnapshot(req.params.id, req.params.file) }
    } catch (e: any) {
      return reply.code(400).send({ error: e.message })
    }
  })

  fastify.post<{ Params: { id: string }; Body: { file: string } }>('/api/docs/:id/restore', async (req, reply) => {
    const doc = registry.get(req.params.id)
    if (!doc) return reply.code(404).send({ error: 'unknown doc' })
    const text = await readSnapshot(req.params.id, req.body.file)
    const msg = await handleClientSave(doc, text)
    if (msg.type === 'patch') broadcast(doc.id, msg)
    return { ok: true }
  })

  fastify.register(async f => {
    f.get<{ Params: { id: string } }>('/ws/:id', { websocket: true }, (socket, req) => {
      const doc = registry.get(req.params.id)
      if (!doc) {
        socket.close(4004, 'unknown doc')
        return
      }
      if (!sockets.has(doc.id)) sockets.set(doc.id, new Set())
      sockets.get(doc.id)!.add(socket)
      send(socket, { type: 'init', docId: doc.id, path: doc.path, text: doc.canonicalText, hash: doc.canonicalHash })
      socket.on('message', async (raw: Buffer) => {
        const msg = JSON.parse(raw.toString()) as ClientMsg
        if (msg.type === 'save') {
          const out = await handleClientSave(doc, msg.text)
          send(socket, { type: 'saved', hash: out.type === 'patch' || out.type === 'saved' ? out.hash : '' })
          if (out.type === 'patch') broadcast(doc.id, out, socket)
        }
      })
      socket.on('close', () => sockets.get(doc.id)?.delete(socket))
    })
  })

  const start = async (port = 4300): Promise<number> => {
    let p = port
    for (;;) {
      try {
        await fastify.listen({ port: p, host: '127.0.0.1' })
        break
      } catch (e: any) {
        if (e.code === 'EADDRINUSE' && p !== 0) p++
        else throw e
      }
    }
    const actual = (fastify.server.address() as any).port as number
    mkdirSync(stateDir(), { recursive: true })
    await writeFile(join(stateDir(), 'server.json'), JSON.stringify({ port: actual, pid: process.pid }), 'utf8')
    return actual
  }

  return { fastify, registry, start }
}
