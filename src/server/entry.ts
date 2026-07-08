import { buildServer } from './app'

const port = Number(process.env.COMPOSE_PORT || process.argv[2] || 4300)
const srv = await buildServer()
const actual = await srv.start(port)
console.log(`compose server on http://127.0.0.1:${actual}`)
