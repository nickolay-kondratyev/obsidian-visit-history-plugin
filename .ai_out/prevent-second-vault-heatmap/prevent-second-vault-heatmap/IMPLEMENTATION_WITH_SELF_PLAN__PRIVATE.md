# IMPLEMENTATION (self-plan) — PRIVATE state

## Goal
Guard: block opening a NEW vault-level heatmap when an existing vault-level heatmap is currently at vault ROOT; reveal it silently instead. Drilled-in vault-level view → allow new open. Folder-targeted opens unguarded.

## Plan / progress
1. [x] New pure helper `src/view/VaultRootHeatmapFinder.ts` — `HeatmapLeafCandidate<L>` interface + static `firstVaultRootLeaf<L>(candidates): L | null`. No obsidian import (testable).
2. [x] `App.tsx` — add prop `onAtVaultRootChange?: (atRoot: boolean) => void`; useEffect reports `trail.length === 0` on mount + flips.
3. [x] `VaultTreemapView.tsx` — field `atVaultRoot = true`; handler sets it; pass prop in refresh(); public `isVaultLevel()` (folderPath===undefined) + `isAtVaultRoot()`.
4. [x] `main.ts` — local `revealOrOpenVaultHeatmap()` scans getLeavesOfType(VIEW_TYPE_TREEMAP), narrows via instanceof VaultTreemapView, builds candidates, uses finder; command + ribbon call it; folder-menu path unchanged.
5. [x] Tests `src/view/VaultRootHeatmapFinder.test.ts` (BDD).
6. [x] build / test / lint.

## Key correctness notes
- "At root" derived from `trail.length === 0` (what is RENDERED), not raw folderSegments (unresolvable path renders vault root).
- Guard requires BOTH isVaultLevel() && isAtVaultRoot(); default atVaultRoot=true is safe because folder-targeted views have isVaultLevel()===false.
- Test cannot import VaultTreemapView (mock has no ItemView) → finder is obsidian-free and tested via duck-typed candidates.

## Status: COMPLETE (see PUBLIC.md for results)
