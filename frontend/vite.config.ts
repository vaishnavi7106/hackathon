import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: srcDir }],
  },
  server: {
    port: 5180,
    proxy: {
      '/v1': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/v2': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
