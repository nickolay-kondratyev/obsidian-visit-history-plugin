# EXPLORATION_PUBLIC — e2e Obsidian for Visit History recording

Combined pointer. Details in `EXPLORATION_A_PUBLIC.md` (recording internals) and
`EXPLORATION_B_PUBLIC.md` (build/test infra). Reference blueprint:
`.out/tmp_doc/e2e-obsidian-docker-setup.md`.

## The goal
Add a real-Obsidian (Electron) Playwright e2e setup that auto-provisions a pinned
Obsidian binary and drives the built `visit-history` plugin, plus a core e2e suite
proving visit-history recording for: focus switch, close/unload, switch-to-settings,
canvas focus, idle timeout (with a fast idle setting).

## Most load-bearing facts for planning
- **Plugin id** `visit-history`. Build: `npm run build` → repo-root `main.js`; install =
  copy `main.js`+`manifest.json`+`styles.css` into `<vault>/.obsidian/plugins/visit-history/`.
  Submodule `obsidian-id-lib` must be `git submodule update --init` first.
- **On-disk assertion target** (deterministic, preferred over internals):
  `__visit_history/user/<user>/v3/focus_duration_per_device/<device>/<doc-id>.vh_v3`,
  one line per closed session: `<ISO start> D:<ms>` (regex `^\S+ D:\d+$`).
- **Determinism knobs (set BEFORE onLayoutReady):**
  - `localStorage['obsidian-vh-user-name']='e2e_user'` → bypasses the first-run modal, pins user.
  - `localStorage['obsidian-device-name']='e2e_device'` → pins device dir.
  - Pre-seed note frontmatter `id:` / canvas `metadata.frontmatter.id` → known `.vh_v3` filename.
  - `data.json` `{"idleTimeoutSeconds":5}` → fast idle (floor 5s; live-read).
- **Timing:** unfocus/nav/settings close has a FIXED 10s grace; idle close has NO grace
  (fires at timeout, duration ends at last activity). Async append after close → poll the
  file (~15s budget). No synchronous DOM-reachable flush hook.
- **Infra gaps:** no `@playwright/test`, no `e2e/`, no `.dev-vault/`, no e2e scripts/CI yet —
  all greenfield. `.tmp/` and `.out/` gitignored (good for binary cache + vault copy).
  `obsidian` npm pkg is types-only → node-side e2e code must NOT import it (duplicate constants).

## Key risks to address in planning
1. **Feasibility of headless Electron/Obsidian in this Linux sandbox** (download + Ozone
   headless launch + CDP attach). De-risk with an EARLY smoke milestone before writing all tests.
2. **Idle floor is 5s** and grace is 10s → idle/close tests are inherently slow-ish; keep the
   suite serial (`workers:1`) and budget timeouts generously.
3. **Hard-quit may lose the last open session** (async append) → test "close" via plugin
   disable or poll, per exploration.
