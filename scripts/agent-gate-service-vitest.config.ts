import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['scripts/agent-gate-service-e2e.ts'], testTimeout: 120_000 },
})
