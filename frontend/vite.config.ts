import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: srcDir }],
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'local-alias',
          setup(build) {
            build.onResolve({ filter: /^@\// }, (args) => ({
              path: args.path.replace('@/', srcDir + '/'),
            }))
          },
        },
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:8000',
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
