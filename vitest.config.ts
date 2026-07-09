import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // 'obsidian' npm package is type-declarations-only (no runtime JS).
      // Unit tests run against a minimal stand-in instead.
      obsidian: fileURLToPath(new URL('./src/testSupport/obsidianMock.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
