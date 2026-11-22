import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  test: { environment: 'happy-dom', include: ['tests/unit/**/*.test.ts'] },
} as any);
