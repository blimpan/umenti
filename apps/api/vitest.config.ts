import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'],
    env: {
      SUPABASE_PROJECT_URL: 'http://localhost:54321',
      SUPABASE_SECRET_KEY: 'test-key',
    },
  },
})
