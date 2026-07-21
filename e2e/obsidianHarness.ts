// Spawns a REAL headless Obsidian (Electron), attaches over CDP, and drives it via
// `window.app` — the sanctioned pattern (see .out/tmp_doc/e2e-obsidian-docker-setup.md).
//
// Determinism spine: a fresh copy of .dev-vault per launch, identity pinned via
// localStorage BEFORE the plugin is enabled (so the user-name modal is bypassed and the
// device dir is fixed), and a per-test `data.json` idle value written before enable.
import { type Browser, type Page, chromium } from '@playwright/test';
import { type ChildProcess, spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEVICE_NAME,
  LS_KEY_DEVICE_NAME,
  LS_KEY_USER_NAME,
  PLUGIN_ID,
  USER_NAME,
} from './constants';

// run-e2e.sh cd's to the repo root before invoking Playwright, so cwd IS the repo root.
// (Avoids __dirname, undefined under this package's ESM "type":"module".)
const REPO_ROOT = process.cwd();
const DEV_VAULT = join(REPO_ROOT, '.dev-vault');
const E2E_RUN_ROOT = join(REPO_ROOT, '.tmp/e2e');

const DEVTOOLS_WS_RE = /DevTools listening on (ws:\/\/\S+)/;

export interface LaunchOptions {
  /** Written to the plugin's data.json before enable. Floor enforced by the plugin is 5. */
  readonly idleTimeoutSeconds: number;
}

export class ObsidianHarness {
  private constructor(
    readonly page: Page,
    readonly vaultDir: string,
    private readonly browser: Browser,
    private readonly child: ChildProcess,
  ) {}

  static async launch(opts: LaunchOptions): Promise<ObsidianHarness> {
    const obsidianPath = process.env.OBSIDIAN_PATH;
    if (!obsidianPath) {
      throw new Error('OBSIDIAN_PATH is not set — run via `npm run test:e2e` (scripts/run-e2e.sh).');
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runDir = join(E2E_RUN_ROOT, runId);
    const vaultDir = join(runDir, 'vault');
    const userDataDir = join(runDir, 'userdata');

    // Fresh vault copy — never mutate the committed seed or the human's vault.
    cpSync(DEV_VAULT, vaultDir, { recursive: true });
    mkdirSync(userDataDir, { recursive: true });

    // Per-test idle setting. Overwrites any stray data.json from the copy.
    const pluginDir = join(vaultDir, '.obsidian', 'plugins', PLUGIN_ID);
    writeFileSync(
      join(pluginDir, 'data.json'),
      JSON.stringify({ idleTimeoutSeconds: opts.idleTimeoutSeconds }),
    );

    // Register the copied vault so Obsidian boots straight in (no picker, no auto-update).
    const vaultId = `e2evault${runId.replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
    writeFileSync(
      join(userDataDir, 'obsidian.json'),
      JSON.stringify({
        vaults: { [vaultId]: { path: vaultDir, ts: Date.now(), open: true } },
        updateDisabled: true,
      }),
    );

    const extraArgs = (process.env.OBSIDIAN_E2E_EXTRA_ARGS ?? '').split(/\s+/).filter(Boolean);
    const args = [
      '--no-sandbox', // Electron's SUID sandbox is unavailable in most CI containers.
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0', // OS-assigned port; endpoint parsed from stderr.
      ...extraArgs, // carries the headless Ozone flags from run-e2e.sh
    ];
    const child = spawn(obsidianPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let browser: Browser | undefined;
    try {
      const wsEndpoint = await readDevtoolsEndpoint(child);
      browser = await chromium.connectOverCDP(wsEndpoint);
      const page = await firstPage(browser);

      await page.waitForFunction(
        () => typeof window.app === 'object' && window.app?.workspace?.layoutReady === true,
        undefined,
        { timeout: 60_000 },
      );

      // Pin identity BEFORE enabling: the user-name pin runs inside the plugin's
      // onLayoutReady callback, which fires immediately on enable (layout already ready).
      await page.evaluate(
        ([userKey, userVal, devKey, devVal]) => {
          window.localStorage.setItem(userKey, userVal);
          window.localStorage.setItem(devKey, devVal);
        },
        [LS_KEY_USER_NAME, USER_NAME, LS_KEY_DEVICE_NAME, DEVICE_NAME] as const,
      );

      await page.evaluate(async (pluginId) => {
        await window.app.plugins.setEnable(true);
        await window.app.plugins.enablePlugin(pluginId);
      }, PLUGIN_ID);
      await page.waitForFunction(
        (pluginId) => !!window.app.plugins.plugins[pluginId],
        PLUGIN_ID,
        { timeout: 30_000 },
      );

      return new ObsidianHarness(page, vaultDir, browser, child);
    } catch (err) {
      try {
        if (browser) await browser.close();
      } catch {
        /* ignore */
      }
      child.kill('SIGKILL');
      throw err;
    }
  }

  /** Open a vault file in the active leaf → fires the tracked focus/unfocus events. */
  async openFile(path: string): Promise<void> {
    await this.page.evaluate(async (p) => {
      const file = window.app.vault.getAbstractFileByPath(p);
      if (!file) throw new Error(`file not found in vault: ${p}`);
      await window.app.workspace.getLeaf(false).openFile(file);
    }, path);
  }

  /** Open the Settings modal (does NOT change the active leaf — see S3). */
  async openSettings(): Promise<void> {
    await this.page.evaluate(() => window.app.setting.open());
  }

  async closeSettings(): Promise<void> {
    await this.page.evaluate(() => window.app.setting.close());
  }

  /** Graceful unload: runs the plugin's onunload → dispose flush while the process lives. */
  async disablePlugin(): Promise<void> {
    await this.page.evaluate(async (pluginId) => {
      await window.app.plugins.disablePlugin(pluginId);
    }, PLUGIN_ID);
  }

  async close(): Promise<void> {
    try {
      await this.browser.close();
    } catch {
      /* ignore */
    }
    this.child.kill('SIGKILL');
  }
}

async function readDevtoolsEndpoint(child: ChildProcess): Promise<string> {
  let buf = '';
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for DevTools endpoint.\nSTDERR:\n${buf}`)),
      60_000,
    );
    const scan = (chunk: Buffer): void => {
      buf += chunk.toString();
      const endpoint = buf.match(DEVTOOLS_WS_RE)?.[1];
      if (endpoint) {
        clearTimeout(timer);
        resolve(endpoint);
      }
    };
    // Electron prints the endpoint to stderr; stdout captured too for diagnostics.
    child.stderr?.on('data', scan);
    child.stdout?.on('data', (c: Buffer) => {
      buf += c.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Obsidian exited before CDP was ready (code=${code}).\nSTDERR:\n${buf}`));
    });
  });
}

async function firstPage(browser: Browser): Promise<Page> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) return page;
    if (Date.now() >= deadline) throw new Error('no renderer page found over CDP within 30s');
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Minimal ambient typing for the renderer globals reached inside page.evaluate.
// NOT an `import "obsidian"` — the harness never loads the types-only package at runtime.
declare global {
  interface Window {
    app: {
      workspace: {
        layoutReady: boolean;
        getLeaf(newLeaf: boolean): { openFile(file: unknown): Promise<void> };
      };
      vault: { getAbstractFileByPath(path: string): unknown };
      plugins: {
        plugins: Record<string, unknown>;
        setEnable(enabled: boolean): Promise<void>;
        enablePlugin(id: string): Promise<void>;
        disablePlugin(id: string): Promise<void>;
      };
      setting: { open(): void; close(): void };
    };
  }
}
