import { defineConfig } from '@playwright/test';

// One real Obsidian window is a singleton per test; parallel workers would fight over
// it and the vault copy. Electron boot + vault index is slow → generous timeouts.
// We attach to Obsidian's own Electron over CDP — do NOT run `playwright install`
// (no Playwright-managed browsers are used).
export default defineConfig({
  // testDir defaults to this config's directory (e2e/). outputDir is resolved relative
  // to it. Avoids __dirname, which is undefined under this package's ESM ("type":"module").
  testMatch: '**/*.e2e.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: '../.tmp/e2e/output',
});
