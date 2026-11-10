import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5179', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npx vite --config e2e/vite.e2e.config.ts',
    cwd: '..',
    url: 'http://localhost:5179',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
