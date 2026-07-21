# EXPLORATION_B_PUBLIC — Build/Test/Dev Infrastructure

## Summary
- Plugin id is `visit-history`; build = esbuild bundling `src/main.ts` → repo-root `main.js` (external `obsidian`/`electron`). Dev-vault install needs `main.js` + `manifest.json` + `styles.css` copied into `<vault>/.obsidian/plugins/visit-history/`.
- NO existing e2e infra: no `@playwright/test`, no `test:e2e`/`setup:dev-vault`/`setup:obsidian` scripts, no `e2e/`, `.dev-vault/`, `Dockerfile`, or CI e2e job — only `lint.yml` + `release.yml`.
- Tests are vitest-only; `obsidian` npm pkg is types-only, aliased in `vitest.config.ts` to `src/testSupport/obsidianMock.ts`.
- `obsidian-id-lib` is a git submodule at `submodules/obsidian-id-lib`, consumed as `file:` dep, source-only (no build step) — must `git submodule update --init` before build.
- Key runtime constants: view type `vault-heatmap`, command id `open-vault-heatmap`, body class `vault-heatmap-active`; `.tmp/` and `.out/` are gitignored (good cache targets).

## 1. package.json
- name `obsidian-visit-history-plugin`, version `1.0.5`, `type: module`, `main: main.js`.
- Scripts: `dev` (esbuild watch), `build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`), `version`, `lint` (`eslint .`), `test` (`vitest run`), `test:watch`, `test:lib` (`npm --prefix submodules/obsidian-id-lib run test`), `download-sonar-issues`.
- NO `test:e2e`, `setup:dev-vault`, `setup:obsidian`. `@playwright/test` NOT present.
- devDeps: esbuild 0.25.5, eslint ^9, eslint-plugin-obsidianmd ^0.3.0, obsidian ^1.13.1, typescript ^5.8.3, typescript-eslint, vitest ^4.1.10, @types/node ^22, @types/react ^19, jiti, globals.
- deps: @visx/zoom, d3-color, d3-hierarchy, d3-interpolate, lru-cache, `obsidian-id-lib: file:submodules/obsidian-id-lib`, react ^18.3.1, react-dom ^18.3.1.

## 2. Build system
- `esbuild.config.mjs`: entry `src/main.ts`, bundle, format `cjs`, target `es2021`, outfile repo-root `main.js`. external: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, Node builtins. Prod: rebuild+exit; dev: watch.
- `tsconfig.json`: module ESNext, target ES2021, strict, moduleResolution node, isolatedModules, skipLibCheck, jsx react-jsx, lib [ES2021, DOM], include `src/**/*.ts`. (e2e needs its own `e2e/tsconfig.json`.)
- `main.js` produced at repo ROOT (gitignored).
- `manifest.json`: id **`visit-history`**, name `Visit History`, version 1.0.5, minAppVersion **`1.5.7`**, isDesktopOnly false.
- `styles.css` (~23KB) must be copied alongside main.js + manifest.json.
- `build.sh`: `git submodule update --init --recursive` → `npm install` → `npm run dev`.

## 3. Existing test setup (vitest only)
- `vitest.config.ts`: aliases `obsidian` → `./src/testSupport/obsidianMock.ts`; include `src/**/*.test.ts(x)`.
- `node_modules/obsidian/` = type declarations only (no runtime .js). `obsidian` must remain types-only in node-side e2e code.
- `src/testSupport/`: `obsidianMock.ts`, `fakes.ts` (FakeVaultUtil, FakeDocIdService, FixedDeviceNameProvider), `FakeHiddenFileUtil.ts`, `FakeNoteFileUtil.ts`, `FakeUserNamePrompt.ts`, `fileFactory.ts`.
- Tests colocated with source (`*.test.ts(x)`). No top-level `test/` or `e2e/`.

## 4. Existing dirs / Docker / CI
- NO `e2e/`, `.dev-vault/`, `Dockerfile`, `docker-compose.yml`.
- `scripts/`: `release.sh`, `verify-release.sh`, `sonarqube/fetch_sonar_findings.py`. (setup-obsidian-bin.sh / run-e2e.sh would be new.)
- `.github/workflows/`: `lint.yml` (Node 20/22/24 matrix, submodules recursive, `npm ci --ignore-scripts`, build, lint), `release.yml`. No e2e workflow.
- Scratch dirs: `.tmp/` (gitignored), `.out/` (gitignored, holds design doc in `tmp_doc/`), `.ai_out/` (NOT gitignored).

## 5. .gitignore
Ignores: `.vscode`, `.idea`, `node_modules`, `main.js`, `*.map`, `data.json`, `.DS_Store`, `.gradle`, `build/`, `*do_not_commit*`, `.tmp/`, `.out/`.
NOT ignored: `.ai_out/`, `styles.css`, `manifest.json`. A generated `.dev-vault/` would need an explicit gitignore entry.

## 6. Submodule obsidian-id-lib
- `.gitmodules`: path `submodules/obsidian-id-lib`. Wired as `file:` dep. main/types → `src/index.ts`, NO build step (raw TS, esbuild bundles it). Needs `git submodule update --init --recursive`.

## 7. Building main.js + dev-vault plugin install
- Build: `npm run build`. Produces repo-root `main.js`.
- Install layout: copy `main.js` + `manifest.json` + `styles.css` into `<vault>/.obsidian/plugins/visit-history/`.
- Enable at runtime: after layoutReady, `app.plugins.setEnable(true)` then `app.plugins.enablePlugin('visit-history')`.

### Runtime constants for e2e
- `VIEW_TYPE_TREEMAP = 'vault-heatmap'` (`src/view/VaultTreemapView.tsx:10`).
- `CSS_CLASS_HEATMAP_ACTIVE = 'vault-heatmap-active'` (`:18`).
- Command id `open-vault-heatmap`; ribbon `layout-grid`.
- `TRACKED_VIEW_TYPES = {markdown, canvas, excalidraw}`, `TRACKED_EXTENSIONS = {md, canvas, excalidraw}` (`src/Constants.ts`).
- On load: first-run user-name confirmation modal on unpinned devices (`pinUserNameAndStartRecording` on onLayoutReady) — harness must handle/dismiss.

## Gaps vs design doc
- All e2e pieces are greenfield. Add `@playwright/test`; add `test:e2e`, `setup:obsidian`, `setup:dev-vault` scripts.
- `.tmp/` cache paths already gitignored. `.dev-vault/` may want explicit gitignore.
- CI uses `npm ci --ignore-scripts`; e2e CI job needs submodule init + build + Obsidian binary + headless Ozone flags.
