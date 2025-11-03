import { type HttpBindings, serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
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

const withDevRequest = (server: ViteDevServer) =>
  createMiddleware<{ Bindings: HttpBindings }>(async (c) => {
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

const withProdRequest = createMiddleware<{ Bindings: HttpBindings }>(
  async (c) => {
    const { default: handler } = await import('./dist/server/server.js')

    return await handler.fetch(c.req.raw)
  },
)

if (DEVELOPMENT) {
  const vite = await import('vite')
  const server = await vite.createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  app.use(withMiddlewares(server))
  app.use(withDevRequest(server))
} else {
  app.use(compress())
  app.use(
    '*',
    serveStatic({
      root: './dist/client',
    }),
  )
  app.use(withProdRequest)
}

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
