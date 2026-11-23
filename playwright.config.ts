import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  // mocked question loads take up to ~4.3 s under parallel workers (measured); 5 s was flaky
  expect: { timeout: 15000 },
  use: { baseURL: 'http://localhost:5181', channel: 'msedge' },
  webServer: [
    { command: 'npx vite --port 5181 --strictPort', port: 5181, reuseExistingServer: true },
    // the production build, for the service worker test
    { command: 'npm run build && npx vite preview --port 5182 --strictPort', port: 5182, reuseExistingServer: true, timeout: 120000 },
  ],
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'light' } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, colorScheme: 'dark', hasTouch: true } },
  ],
});
