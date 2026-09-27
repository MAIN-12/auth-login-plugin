import path from 'path'
import { loadEnv } from 'payload/node'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default defineConfig(() => {
  loadEnv(path.resolve(dirname, './dev'))

  return {
    test: {
      environment: 'node',
      include: ['tests/**/*.test.{ts,tsx}'],
      hookTimeout: 30_000,
      testTimeout: 30_000,
    },
  }
})
