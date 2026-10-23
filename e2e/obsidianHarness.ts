// Spawns a REAL headless Obsidian (Electron), attaches over CDP, and drives it via
// `window.app` — the sanctioned pattern (see .out/tmp_doc/e2e-obsidian-docker-setup.md).
//
// Determinism spine: a fresh copy of .dev-vault per launch, identity pinned via
// localStorage BEFORE the plugin is enabled (so the user-name modal is bypassed and the
// device dir is fixed), and a per-test `data.json` idle value written before enable.
import { type Browser, type Page, chromium } from '@playwright/test';
import { type ChildProcess, spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import {
  DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR,
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

/**
 * DEV config overrides written to a JSON file the spawned Obsidian reads via
 * the `__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__` env var. Unlike
 * `idleTimeoutSeconds` in data.json (clamped to the plugin's min-5 floor), an
 * override here is applied verbatim — so a sub-floor value (e.g. 1) is honored.
 */
export interface DevConfigOverrides {
  readonly idleTimeoutSeconds?: number;
}

/**
 * A pre-existing file written into the fresh vault copy BEFORE the plugin is
 * enabled — used to seed legacy on-disk layouts the plugin migrates on load
 * (e.g. an interim `__visit_history/...` tree). `path` is vault-relative;
 * parent dirs are created as needed.
 */
export interface SeedFile {
  readonly path: string;
  readonly content: string;
  /**
   * Optional file modified time (epoch ms), set before Obsidian starts so its vault scan
   * reads it (e.g. heatmap recency specs). Absent → the write time. The created time
   * cannot be set from Node.
   */
  readonly mtimeMs?: number;
}

export interface LaunchOptions {
  /** Written to the plugin's data.json before enable. Floor enforced by the plugin is 5. */
  readonly idleTimeoutSeconds: number;
  /**
   * Written to the plugin's data.json before enable. 0 disables the min-focus
   * filter (record everything). Every existing spec passes 0 via useHarness's
   * default so their ~0 ms session-line assertions are not dropped — filtering
   * is off unless a spec explicitly tests it.
   */
  readonly minFocusSecondsToRecord: number;
  /** Optional dev overrides file (bypasses hard-limited config for e2e). */
  readonly devConfigOverrides?: DevConfigOverrides;
  /**
   * Optional files seeded into the vault copy before enable (see SeedFile).
   * Absent → nothing extra is written, so the launch is byte-for-byte the
   * committed seed vault.
   */
  readonly seedFiles?: readonly SeedFile[];
  /**
   * When true, the user name is NOT pinned in localStorage (the device name still
   * is), so the plugin's first-run user-name modal opens on enable and NO VH is
   * recorded until a name is confirmed in it. Absent/false → the user name is
   * pinned and the modal is bypassed.
   */
  readonly leaveUserNameUnpinned?: boolean;
  /**
   * Vault-relative file opened in the active leaf BEFORE the plugin is enabled — models
   * enabling (or updating / hot-reloading) the plugin while a doc is already open, so no
   * active-leaf-change ever reaches the plugin for it. Absent → nothing is opened.
   */
  readonly openFileBeforeEnable?: string;
}

export class ObsidianHarness {
  // WHY-NOT parameter properties: Node's native type stripping (default since Node 23.6,
  // which loads these specs) rejects them — only erasable TS syntax is allowed here
  // (enforced by `erasableSyntaxOnly` in e2e/tsconfig.json).
  readonly page: Page;
  readonly vaultDir: string;
  private readonly browser: Browser;
  private readonly child: ChildProcess;
  private readonly runDir: string;

  private constructor(page: Page, vaultDir: string, browser: Browser, child: ChildProcess, runDir: string) {
    this.page = page;
    this.vaultDir = vaultDir;
    this.browser = browser;
    this.child = child;
    this.runDir = runDir;
  }

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

    // Seed pre-existing files (legacy layouts, etc.) into the copy before the
    // plugin loads, so its onload migrations observe them on disk.
    for (const seed of opts.seedFiles ?? []) {
      const dest = join(vaultDir, seed.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, seed.content);
      if (seed.mtimeMs !== undefined) utimesSync(dest, new Date(seed.mtimeMs), new Date(seed.mtimeMs));
    }

    // Per-test settings. Overwrites any stray data.json from the copy.
    const pluginDir = join(vaultDir, '.obsidian', 'plugins', PLUGIN_ID);
    writeFileSync(
      join(pluginDir, 'data.json'),
      JSON.stringify({
        idleTimeoutSeconds: opts.idleTimeoutSeconds,
        minFocusSecondsToRecord: opts.minFocusSecondsToRecord,
      }),
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

    // Dev overrides: write the file into the run dir and hand its path to the
    // spawned process via env. Absent → childEnv is a plain copy of parent env,
    // so the launch behaves exactly as before (mechanism inert).
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    if (opts.devConfigOverrides) {
      const overridesPath = join(runDir, 'dev-config-overrides.json');
      writeFileSync(overridesPath, JSON.stringify(opts.devConfigOverrides));
      childEnv[DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR] = overridesPath;
    }

    const extraArgs = (process.env.OBSIDIAN_E2E_EXTRA_ARGS ?? '').split(/\s+/).filter(Boolean);
    const args = [
      '--no-sandbox', // Electron's SUID sandbox is unavailable in most CI containers.
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0', // OS-assigned port; endpoint parsed from stderr.
      ...extraArgs, // carries the headless Ozone flags from run-e2e.sh
    ];
    // detached → new process group leader, so close() can SIGKILL the WHOLE Electron tree
    // (main + Chromium helpers) at once; killing only the main pid leaves helpers holding
    // the userdata dir open, defeating run-dir cleanup.
    const child = spawn(obsidianPath, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: childEnv });

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
        ([userKey, userVal, devKey, devVal, pinUserName]) => {
          if (pinUserName) window.localStorage.setItem(userKey, userVal);
          window.localStorage.setItem(devKey, devVal);
        },
        [LS_KEY_USER_NAME, USER_NAME, LS_KEY_DEVICE_NAME, DEVICE_NAME, !opts.leaveUserNameUnpinned] as const,
      );

      if (opts.openFileBeforeEnable !== undefined) {
        await page.evaluate(async (p) => {
          const file = window.app.vault.getAbstractFileByPath(p);
          if (!file) throw new Error(`file not found in vault: ${p}`);
          await window.app.workspace.getLeaf(false).openFile(file);
        }, opts.openFileBeforeEnable);
        await page.waitForFunction(
          (p) => window.app.workspace.activeLeaf?.view.file?.path === p,
          opts.openFileBeforeEnable,
          { timeout: 15_000 },
        );
      }

      await page.evaluate(async (pluginId) => {
        await window.app.plugins.setEnable(true);
        await window.app.plugins.enablePlugin(pluginId);
      }, PLUGIN_ID);
      await page.waitForFunction(
        (pluginId) => !!window.app.plugins.plugins[pluginId],
        PLUGIN_ID,
        { timeout: 30_000 },
      );

      return new ObsidianHarness(page, vaultDir, browser, child, runDir);
    } catch (err) {
      try {
        if (browser) await browser.close();
      } catch {
        /* ignore */
      }
      killProcessTree(child);
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

  /**
   * Re-activates (and focuses) the EXISTING leaf showing `path` — a refocus of the same
   * leaf/doc, unlike openFile which loads the file into whatever leaf is active. Throws
   * when no leaf shows that file.
   */
  async activateLeafOf(path: string): Promise<void> {
    await this.page.evaluate((p) => {
      // WHY inline (also in blurWindowHosting): page.evaluate callbacks are serialized
      // into the renderer — they cannot call node-side helpers.
      const leaf = window.app.workspace.getLeavesOfType('markdown').find((l) => l.view.file?.path === p);
      if (!leaf) throw new Error(`no leaf shows path=[${p}]`);
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, path);
  }

  /** Waits (bounded) until the active leaf's view has type `viewType`. */
  async waitForActiveViewType(viewType: string): Promise<void> {
    await this.page.waitForFunction(
      (type) => window.app.workspace.activeLeaf?.view.getViewType() === type,
      viewType,
      { timeout: 15_000 },
    );
  }

  /**
   * Opens `path` in a NEW popout window and makes that leaf active + focused (as the
   * "Open in new window" UI does). Headless popouts are real Electron windows sharing
   * the main renderer, so the plugin sees their `window-open` and own `Document`.
   */
  async openFileInPopout(path: string): Promise<void> {
    await this.page.evaluate(async (p) => {
      const file = window.app.vault.getAbstractFileByPath(p);
      if (!file) throw new Error(`file not found in vault: ${p}`);
      const leaf = window.app.workspace.openPopoutLeaf();
      await leaf.openFile(file, { active: true });
      window.app.workspace.setActiveLeaf(leaf, { focus: true });
    }, path);
  }

  /**
   * SYNTHETIC `blur` on the OS window (main or popout) hosting the leaf that shows
   * `path` — same caveat as blurWindow. Throws when no leaf shows that file.
   */
  async blurWindowHosting(path: string): Promise<void> {
    await this.page.evaluate((p) => {
      const leaf = window.app.workspace.getLeavesOfType('markdown').find((l) => l.view.file?.path === p);
      const win = leaf?.view.containerEl.ownerDocument.defaultView;
      if (!win) throw new Error(`no window hosts a leaf showing path=[${p}]`);
      win.dispatchEvent(new Event('blur'));
    }, path);
  }

  /**
   * Accepts Obsidian's first-open "Do you trust the author of this vault?" modal. The
   * plugin is already enabled programmatically; the modal only blocks pointer input, so
   * call this before a spec clicks inside the workspace.
   */
  async trustVaultAuthor(): Promise<void> {
    await this.page.getByRole('button', { name: 'Trust author and enable plugins', exact: true }).click();
    await this.page.locator('.modal.mod-trust-folder').waitFor({ state: 'detached' });
  }

  /** Runs a command by its full id (`<plugin-id>:<command-id>`); throws when it did not run. */
  async runCommand(commandId: string): Promise<void> {
    const ran = await this.page.evaluate((id) => window.app.commands.executeCommandById(id), commandId);
    if (!ran) throw new Error(`command did not run commandId=[${commandId}]`);
  }

  /**
   * Waits until every markdown file has a metadataCache entry (bounded) — the
   * inline-note action refuses while any is missing. Times out (fails plainly)
   * if some file never gets one.
   */
  async waitForMarkdownIndexed(): Promise<void> {
    await this.page.waitForFunction(
      () => window.app.vault.getMarkdownFiles().every(file => window.app.metadataCache.getFileCache(file) !== null),
      undefined,
      { timeout: 30_000 },
    );
  }

  /** Waits until Obsidian's link index has resolved `fromPath` → `toPath` (bounded). */
  async waitForResolvedLink(fromPath: string, toPath: string): Promise<void> {
    await this.page.waitForFunction(
      ([from, to]) => (window.app.metadataCache.resolvedLinks[from]?.[to] ?? 0) > 0,
      [fromPath, toPath] as const,
      { timeout: 30_000 },
    );
  }

  /**
   * Dispatch a SYNTHETIC `blur` on the main window. WHY synthetic: headless Obsidian has
   * no real OS focus switch — Electron's `BrowserWindow.blur()` neither fires the DOM
   * `blur` nor flips `document.hasFocus()` there (verified on 1.12.7). This proves the
   * plugin's blur wiring in real Obsidian, NOT that the OS delivers the signal.
   */
  async blurWindow(): Promise<void> {
    await this.page.evaluate(() => window.dispatchEvent(new Event('blur')));
  }

  /** SYNTHETIC `focus` on the main window — counterpart of blurWindow (same caveat). */
  async focusWindow(): Promise<void> {
    await this.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  }

  /** Open the Settings modal (does NOT change the active leaf; ends the session — see S3). */
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
    killProcessTree(this.child);
    await this.waitForChildExit(3000); // let Electron release the userdata dir before rm
    // Reclaim the per-launch vault+userdata copy. Guarded to internally-derived paths
    // under E2E_RUN_ROOT (.tmp/e2e/<runId>) so a stray/caller path — and the shared
    // Obsidian binary cache under .tmp/obsidian/ — is never touched. Strictly best-effort:
    // Electron's SIGKILLed helper procs can re-touch userdata during teardown (ENOTEMPTY on
    // the final rmdir), and .tmp/e2e is gitignored/ephemeral — cleanup must never fail a test.
    if (this.runDir.startsWith(E2E_RUN_ROOT + sep)) {
      try {
        rmSync(this.runDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } catch {
        /* ignore — disk hygiene only */
      }
    }
  }

  /** Resolve once the child process has exited, or after `timeoutMs` (whichever first). */
  private waitForChildExit(timeoutMs: number): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = (): void => {
        clearTimeout(timer);
        this.child.off('exit', done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.child.once('exit', done);
    });
  }
}

/**
 * SIGKILL the child's entire process group (main Electron + Chromium helpers). The child
 * was spawned `detached`, so it leads its own group; a negative pid signals the group.
 * Falls back to killing the single pid if the group is already gone.
 */
function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already dead */
    }
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
  interface ObsidianLeaf {
    openFile(file: unknown, openState?: { active: boolean }): Promise<void>;
    setViewState(viewState: { type: string; active?: boolean; state?: Record<string, unknown> }): Promise<void>;
    view: {
      getViewType(): string;
      file?: { path: string } | null;
      containerEl: HTMLElement;
    };
  }
  interface Window {
    app: {
      workspace: {
        layoutReady: boolean;
        activeLeaf: ObsidianLeaf | null;
        getLeaf(newLeaf: boolean): ObsidianLeaf;
        getLeavesOfType(viewType: string): ObsidianLeaf[];
        setActiveLeaf(leaf: ObsidianLeaf, params: { focus: boolean }): void;
        openPopoutLeaf(): ObsidianLeaf;
        leftSplit: { collapse(): void };
        rightSplit: { collapse(): void };
      };
      vault: { getAbstractFileByPath(path: string): unknown; getMarkdownFiles(): unknown[] };
      metadataCache: {
        resolvedLinks: Record<string, Record<string, number> | undefined>;
        getFileCache(file: unknown): unknown;
      };
      commands: { executeCommandById(id: string): boolean };
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
