import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:43110' },
  webServer: {
    command: 'COMPOSE_STATE_DIR=.compose-test COMPOSE_PORT=43110 node dist/cli.js --serve',
    url: 'http://127.0.0.1:43110/api/health',
    reuseExistingServer: false,
  },
})
