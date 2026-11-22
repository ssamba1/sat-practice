import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  use: { baseURL: 'http://localhost:5181', channel: 'msedge' },
  webServer: { command: 'npx vite --port 5181 --strictPort', port: 5181, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'light' } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, colorScheme: 'dark', hasTouch: true } },
  ],
});
