import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  // transform the app at startup, so the first test page load is not a cold one
  server: { warmup: { clientFiles: ['./src/main.tsx'] } },
  test: { environment: 'happy-dom', include: ['tests/unit/**/*.test.ts'] },
} as any);
