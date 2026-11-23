import type { Plugin } from 'vite'
import { createApi, type ApiOptions } from './api.js'

/**
 * Mounts the archive API on both the dev server and `vite preview`, so the
 * production build is exercised with the same handler as development.
 */
export function timelineApi(options: ApiOptions = {}): Plugin {
  const handler = createApi(options)
  return {
    name: 'growth-documentary-timeline-api',
    configureServer(server) {
      server.middlewares.use('/api', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', handler)
    },
  }
}
