import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function getBasePath(): string {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH
  if (process.env.GITHUB_ACTIONS !== 'true') return '/'

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
  return repositoryName && !repositoryName.endsWith('.github.io') ? `/${repositoryName}/` : '/'
}

export default defineConfig({
  base: getBasePath(),
  plugins: [react()],
  build: {
    // The full offline roster is intentionally bundled; gzip keeps the transfer compact.
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: { reporter: ['text', 'html'] },
  },
})
