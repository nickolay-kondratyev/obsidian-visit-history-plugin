# End-to-end testing (real Obsidian + Playwright)

The `e2e/` suite drives a **real headless Obsidian (Electron)** and asserts on the
on-disk `.vh_v3` files the plugin actually writes — never on plugin internals. It proves
Visit-History V3 recording across five scenarios: focus switch, unload flush, opening
Settings, canvas focus, and idle timeout.

## Run it

```bash
npm run test:e2e                     # Linux/Docker: auto-downloads a pinned Obsidian, runs headless
npm run test:e2e -- focusSwitch.e2e.ts   # extra args pass through to Playwright
```

`test:e2e` (→ `scripts/run-e2e.sh`) ensures an Obsidian binary exists, injects headless
Ozone flags when there is no display, seeds `.dev-vault` with the freshly built plugin,
typechecks the specs (`e2e/tsconfig.json`), then runs Playwright serially (one Obsidian
window at a time).

> Do NOT run `playwright install` — the suite attaches to Obsidian's own Electron over
> CDP; no Playwright-managed browsers are used.

## How it works

- **`scripts/setup-obsidian-bin.sh`** — downloads + caches the pinned Obsidian
  (`1.12.7`) `.tar.gz` (a plain runnable binary; no FUSE/AppImage). stdout = the binary
  path; a second run reuses the cache.
- **`e2e/obsidianHarness.ts`** — per launch: copies `.dev-vault` fresh, spawns Obsidian
  with an isolated `--user-data-dir` + `--remote-debugging-port=0`, parses the
  `DevTools listening on ws://…` line from stderr, `connectOverCDP`, waits for
  `layoutReady`, pins identity in localStorage (`obsidian-vh-user-name=e2e_user`,
  `obsidian-device-name=e2e_device`) **before** enabling the plugin (so the first-run
  user-name modal is bypassed deterministically), writes the per-test `data.json`
  (`idleTimeoutSeconds`), then enables the plugin.
- **`e2e/vhAssert.ts`** — builds the expected `.vh_v3` path and polls it with a bounded
  timeout (never a fixed sleep); throws with the last-seen content on timeout.
- Assertions target
  `.tmp/e2e/vault-<run>/__visit_history/user/e2e_user/v3/focus_duration_per_device/e2e_device/<doc-id>.vh_v3`.
  The human's real vault is never touched.

`obsidian` is a types-only package, so the node-side e2e code never imports it —
runtime constants (plugin id, VH dir, localStorage keys, seeded ids, session regex) are
duplicated in `e2e/constants.ts` with a sync-pointer comment.

## Overridable env vars

| Var | Effect |
|-----|--------|
| `OBSIDIAN_PATH` | Use this binary; skip the auto-download (required on macOS/Windows). |
| `OBSIDIAN_CACHE_DIR` | Where the binary is downloaded/reused (default `.tmp/obsidian`). |
| `OBSIDIAN_E2E_EXTRA_ARGS` | Extra Electron flags (defaults to the headless Ozone flags when no `DISPLAY`). |

## CI / Docker

The scripts are portable and "just work" in a display-less Linux container. For CI,
mount the binary cache as a named volume so the download is reused across runs:

```
-v obsidian-e2e-cache:/home/<user>/.cache/obsidian-e2e   # with OBSIDIAN_CACHE_DIR set to it
```

A dedicated CI workflow + Dockerfile are tracked as follow-ups (not included here).

## Known limitation

A hard process-kill (SIGKILL) can lose the last open session (the async append races the
exit). The unload-flush spec therefore drives the **graceful** `disablePlugin` path
(runs `onunload` → `dispose()` flush while the process stays alive), which is
deterministic. Opening **Settings** does not end a session in Obsidian 1.12.7 (the modal
does not change the active leaf) — the Settings spec captures that current behavior; the
product question is open for the owner.
