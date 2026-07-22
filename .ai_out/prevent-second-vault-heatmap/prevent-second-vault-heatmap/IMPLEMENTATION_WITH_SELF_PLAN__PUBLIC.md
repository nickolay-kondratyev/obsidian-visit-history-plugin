# Implementation — Prevent second vault-level heatmap

## Goal
Block opening a NEW vault-level heatmap when an existing vault-level heatmap is CURRENTLY at the vault ROOT — reveal it silently instead. A drilled-in vault-level view, or a folder-targeted view, never blocks a fresh open. Command + ribbon only; folder-menu path untouched.

## Plan (executed)
1. Pure selection helper (obsidian-free, unit-testable).
2. React nav bridge: `App` reports at-root via a callback prop.
3. `VaultTreemapView` stores the flag + exposes predicates for the guard.
4. `main.ts` guard: scan leaves, reveal-or-open.
5. vitest BDD tests for the pure helper.

## Files changed
- **`src/view/VaultRootHeatmapFinder.ts`** (NEW) — pure selection unit. No obsidian import (so it is testable without the ItemView mock, which the test-support `obsidian` stand-in does not provide).
  - `interface HeatmapLeafCandidate<L> { readonly leaf: L; readonly isVaultLevel: boolean; readonly isAtVaultRoot: boolean }`
  - `class VaultRootHeatmapFinder { static firstVaultRootLeaf<L>(candidates: ReadonlyArray<HeatmapLeafCandidate<L>>): L | null }` — first candidate that is `isVaultLevel && isAtVaultRoot`, else null. Generic leaf type keeps it obsidian-free; predicates are precomputed at the Obsidian boundary.
- **`src/view/components/App.tsx`** — added `onAtVaultRootChange?: (atRoot: boolean) => void` to `AppProps`; a `useEffect` fires it with `trail.length === 0` on mount and whenever it flips. Derived from the RENDERED trail (not raw `folderSegments`) because an unresolvable path falls back to rendering the vault root — reporting raw segments would lie.
- **`src/view/VaultTreemapView.tsx`** — field `private atVaultRoot = true` (a fresh vault-level view starts at root); `private readonly handleAtVaultRootChange` setter passed as `onAtVaultRootChange` in `refresh()`; public `isVaultLevel(): boolean` (`folderPath === undefined`) and `isAtVaultRoot(): boolean`. Default `true` is safe for folder-targeted views because the guard also requires `isVaultLevel()`, which is false there.
- **`src/main.ts`** — new local `revealOrOpenVaultHeatmap()` used by the `open-vault-heatmap` command AND the ribbon (folder-menu still calls `openHeatmap(file.path)` directly). New `private findVaultRootHeatmapLeaf(): WorkspaceLeaf | null` scans `getLeavesOfType(VIEW_TYPE_TREEMAP)` (spans popouts), narrows each `leaf.view` via `instanceof VaultTreemapView` (the only `as`-free Obsidian boundary), builds candidates, and delegates to `VaultRootHeatmapFinder`. On a hit: `void this.app.workspace.revealLeaf(existing)` (silent, no Notice) and return; else `openHeatmap()`.
- **`src/view/VaultRootHeatmapFinder.test.ts`** (NEW) — 6 BDD tests.
- **`manifest.json`** — `minAppVersion` 1.5.7 → 1.7.2 (see callout).

## Public interfaces added
- `VaultRootHeatmapFinder.firstVaultRootLeaf<L>(candidates: ReadonlyArray<HeatmapLeafCandidate<L>>): L | null`
- `HeatmapLeafCandidate<L>` interface
- `VaultTreemapView.isVaultLevel(): boolean`, `VaultTreemapView.isAtVaultRoot(): boolean`
- `App` prop `onAtVaultRootChange?: (atRoot: boolean) => void`

## Test coverage
`VaultRootHeatmapFinder.firstVaultRootLeaf`:
- returns the leaf when a vault-level view is at root (reveal path).
- returns null when the only vault-level view is drilled into a folder (open-new).
- returns null when a folder-targeted view is at its own root (not vault-level).
- multiple vault-root views → returns the FIRST.
- skips non-matching leaves, then returns the first vault-root leaf.
- empty candidate list → null.

Tradeoff (noted per task): the React `useEffect` and `VaultTreemapView` wiring are NOT unit-tested — no RTL/DOM harness exists and the mock `obsidian` has no `ItemView`. The load-bearing decision (`isVaultLevel && isAtVaultRoot`, first-wins) lives entirely in the pure helper and IS covered. Adding React test infra would be low-ROI here.

## Results
- `npm run build`: PASS (exit 0).
- `npm test`: PASS — 44 files, 414 tests (6 new).
- `npm run lint`: 0 errors, 1 warning (pre-existing `setWarning` deprecation in `settingsTab/ConfirmModal.ts`, unrelated to this change; baseline confirmed by stash-lint).

## Callout / #QUESTION_FOR_HUMAN
The owner-locked reveal API `Workspace.revealLeaf` is flagged by `obsidianmd/no-unsupported-api` as requiring Obsidian ≥1.7.2 while `manifest.json` declared `minAppVersion: 1.5.7`. To keep lint at ZERO errors while honoring the locked decision, I bumped `manifest.json` `minAppVersion` to `1.7.2`.
- #QUESTION_FOR_HUMAN: Is dropping support for Obsidian 1.5.7–1.7.1 acceptable? If not, an alternative reveal path (e.g. `setActiveLeaf`) would be needed — but that deviates from the locked "reveal via `revealLeaf`" decision, so I did NOT take it.
- `versions.json` was left unchanged: it maps ALREADY-RELEASED plugin versions to their min app version; the new `1.7.2` will be recorded for the next version by `npm run version` at release. Flagging so the release step isn't missed.
