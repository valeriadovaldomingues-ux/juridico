import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Node environment: sem polyfills, usa Web APIs nativas do Node 18+
    environment: 'node',

    // Não usar globals (imports explícitos = melhor rastreabilidade)
    globals: false,

    // Cobertura para o proxy (único arquivo coberto por este suite)
    coverage: {
      provider:   'v8',
      include:    ['src/proxy.ts'],
      reporter:   ['text', 'json-summary'],
      thresholds: { lines: 90, functions: 100, branches: 85 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
