import { serve, type HttpBindings } from '@hono/node-server'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ViteDevServer } from 'vite'

const DEVELOPMENT = process.env.NODE_ENV === 'development'
const PORT = Number.parseInt(process.env.PORT || '3000')

const app = new Hono<{ Bindings: HttpBindings }>()

const withMiddlewares = (server: ViteDevServer) =>
  createMiddleware<{ Bindings: HttpBindings }>(async (c, next) => {
    return new Promise((resolve) => {
      server.middlewares(c.env.incoming, c.env.outgoing, () => {
        resolve(next())
      })
    })
  })

const withRequest = (server: ViteDevServer) =>
  createMiddleware<{ Bindings: HttpBindings }>(async (c, next) => {
    try {
      const { default: serverEntry } =
        await server.ssrLoadModule('./src/server.ts')

      return await serverEntry.fetch(c.req.raw)
    } catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        server.ssrFixStacktrace(error)
      }

      throw error
    }
  })

if (DEVELOPMENT) {
  const vite = await import('vite')
  const server = await vite.createServer({
    server: { middlewareMode: true },
    // appType: "custom"
  })

  app.use(withMiddlewares(server))
  app.use(withRequest(server))
} else {
}

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
