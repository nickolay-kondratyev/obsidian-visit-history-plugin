# EXPLORATION_PUBLIC — Type-safe obsidian-id-lib usage

## TL;DR — the ticket's stated root cause is FALSE (verified by reproduction)

The `@typescript-eslint/no-unsafe-*` cluster is **not** caused by eslint's `globalIgnores(['submodules'])`
or by `tsconfig.json` `include: ["src/**/*.ts"]`. It is caused by **`obsidian-id-lib` being unresolvable
when the git submodule is not checked out** (submodules aren't fetched by default). Then the import types
as `any` → every `DocIdService` / `DocIdServices` use is unsafe.

## Reproduction (definitive)

`node_modules/obsidian-id-lib` is a symlink → `../submodules/obsidian-id-lib`.

- **Submodule present:** `npx eslint src/core/service/visitHistoryService/v3/VisitHistoryServiceV3.ts` → **exit 0, 0 errors.**
- **Symlink moved aside (module unresolvable):** same command →
  ```
  23:11 no-unsafe-assignment | 23:25 no-unsafe-call | 23:43 no-unsafe-member-access
  28:44 / 33:90 / 36:47 / 42:29 no-unsafe-argument   → 7 errors
  ```
  These lines EXACTLY match the ticket's `VisitHistoryServiceV3.ts:23,28,33,36,42`, proving the review
  ran with the submodule unpopulated.

## Why the type-aware rules are already active locally

`node_modules/eslint-plugin-obsidianmd/dist/lib/index.js:197` — the recommended config `extends`
`tseslint.configs.recommendedTypeChecked` for `**/*.ts`. `eslint.config.mts` uses `projectService`.
So `no-unsafe-*` are ON; local lint is clean ONLY because the symlinked submodule provides real `.ts` types.

## Consumer files (all import bare `'obsidian-id-lib'`)

- `DocIdFocusListener.ts` — `import { DocIdService }`; ctor dep.
- `VhV3FocusDurationListener.ts` — `import { DocIdService }`; ctor dep.
- `PluginFactory.ts` — `import { DocIdService, DocIdServices }`; `DocIdServices.createDefault(app.vault)`.
- `DocIdBackfillService.ts` — `import { DocIdService }`; `.isEligible()`, `.ensureDocId()`.
- `VisitHistoryServiceV3.ts` — `import { DocIdService }`; `.getDocId()` etc.

## Packaging facts

- Plugin `package.json`: `"obsidian-id-lib": "file:submodules/obsidian-id-lib"`.
- Submodule `package.json`: `main`/`types` → `src/index.ts` (RAW TS). No `dist/`, **no `.d.ts` anywhere**.
- `esbuild.config.mjs`: `obsidian-id-lib` is NOT external → esbuild inlines the raw submodule TS into `main.js`.
- `build` script `tsc -noEmit -skipLibCheck` type-checks the plugin incl. imported submodule `.ts` (they enter
  via import resolution) → compiles cleanly when submodule present.

## Consequence for the fix

If the review tree has the submodule **absent**, the entire `submodules/obsidian-id-lib/` dir is empty —
so NO fix that lives inside the submodule (a `.d.ts`, a dedicated tsconfig, an eslint project reference)
can help, because those files don't exist there either. Only two classes of fix actually work:

1. **Ensure the submodule is initialized** in whatever environment runs the review/lint
   (`git submodule update --init`). Zero code change, DRY, Pareto-optimal — IF the owner controls that env.
2. **Provide a resolvable type surface in the MAIN repo, outside the submodule dir** (e.g. a committed
   `.d.ts` shim + tsconfig `paths` mapping), so lint resolves real types even with the submodule absent.
   Robust but introduces a type surface to keep in sync (mitigate with a generator script).

The ticket's suggested approach (dedicated submodule tsconfig referenced by eslint `projectService`, or
`.d.ts` emitted INSIDE the submodule) does **not** fix the observed failure — it is a no-op when the
submodule is absent, and unnecessary when it is present.

## STATUS: BLOCKED on owner decision (false-premise ticket)

Recommendation: confirm WHERE the plugin-review runs. Most likely the owner's own machine/CI → option (1).
If lint must pass without the submodule → option (2).
