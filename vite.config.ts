import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { timelineApi } from './server/plugin.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), timelineApi()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    allowedHosts: ['citadel.tail72b88e.ts.net', '.ts.net', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '127.0.0.1',
    port: 5190,
    strictPort: true,
    allowedHosts: ['citadel.tail72b88e.ts.net', '.ts.net', 'localhost', '127.0.0.1'],
  },
})
