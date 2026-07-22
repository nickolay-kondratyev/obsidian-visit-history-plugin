---
closed_iso: 2026-07-22T16:17:17Z
id: nid_9d45b2giag7g46xbxkbb89ol6_e
title: "Plan: prevent opening a second vault-level heatmap when one is already at vault root"
status: closed
deps: []
links: []
created_iso: 2026-07-22T15:37:33Z
status_updated_iso: 2026-07-22T16:17:17Z
type: task
priority: 2
assignee: nickolaykondratyev
tags: [ui, heatmap, planning]
---

PLANNING TICKET (design first, then implement in this same ticket or a split-off impl ticket).

## Goal
Prevent opening a NEW vault-level heatmap when there is ALREADY a vault-level heatmap currently showing the full vault root. If the existing vault-level heatmap has been navigated (drilled) into a particular folder, opening another vault-level heatmap IS allowed.

## Definitions
- "Vault-level heatmap" = a `VaultTreemapView` opened with no folder target (command `open-vault-heatmap` / ribbon icon), i.e. `folderPath` undefined. Folder-targeted heatmaps (file-tree context menu "Open heatmap for folder") are a DIFFERENT thing and are NOT covered by this guard.
- "At vault root" = the view is currently displaying the whole-vault root (not drilled into any folder).
- The guard blocks a new open ONLY when some existing vault-level heatmap is CURRENTLY at vault root.

## Relevant code (full paths from repo root)
- src/main.ts:105-126 `initVaultTreeMapView` / `openHeatmap` — where the open happens (`getLeaf(true).setViewState(...)`). Guard belongs here for the vault-level open paths (command + ribbon).
- src/view/VaultTreemapView.tsx — ItemView. `folderPath` (line ~42) is only the INITIAL folder target; `getState`/`setState` (lines ~84-100) persist only that initial folderPath.
- src/view/components/App.tsx:174-208 — `folderSegments` is the ONLY live navigation state and lives in REACT state; `[]` == at vault root, non-empty == drilled into a folder. This is NEVER reflected back to the ItemView today.

## Core design problem to solve
The view layer cannot currently tell if a heatmap is at vault root vs drilled in, because current nav (`folderSegments`) never leaves React `App` state. To implement the "allow another if navigated into a folder" rule we must BRIDGE App nav state up to `VaultTreemapView` so the open-guard can inspect it.

Proposed straightforward approach:
1. Add a lightweight per-view signal: `App` reports whether it is currently at vault root (e.g. an `onAtVaultRootChange(atRoot: boolean)` callback prop, or App writes current segments back via `setState` so `getState` reflects live nav). Prefer the smallest option; note that flowing nav through `setState` would ALSO fix the separate latent gap that in-view drill-down does not survive workspace layout save/restore — but keep that as a possible bonus, not required scope.
2. `VaultTreemapView` exposes a read like `isAtVaultRoot(): boolean` (true when opened vault-level AND current nav == root).
3. In `openHeatmap(undefined)` (vault-level opens only): enumerate `this.app.workspace.getLeavesOfType(VIEW_TYPE_TREEMAP)`, find any whose view is a vault-level view currently at vault root. If found, DO NOT open a new leaf — instead reveal/focus that existing leaf (`workspace.revealLeaf` / `setActiveLeaf`) and optionally show a Notice ("Vault heatmap already open"). Otherwise open as today.

## Decisions to confirm during planning
- Blocked behavior: reveal+focus the existing vault-root heatmap (recommended) vs. silently no-op vs. Notice-only. Recommend reveal + subtle Notice.
- If MULTIPLE vault-root heatmaps already exist (e.g. from a restored layout predating this feature), reveal the first found.
- Popout windows: `getLeavesOfType` already spans main + popout windows — confirm covered.
- Bridge mechanism: callback-flag (minimal) vs. nav-in-setState (also fixes layout-restore). Pick minimal unless owner wants the bonus.

## Acceptance criteria
- Opening vault heatmap via command/ribbon when a vault-root heatmap is already open reveals the existing one instead of creating a duplicate.
- After drilling the existing vault-level heatmap into a folder, opening the vault heatmap again creates a NEW vault-level heatmap.
- Folder-targeted opens (context menu) are unaffected.
- Unit coverage for the "is currently at vault root" decision and the open-guard selection logic (mock workspace leaves).


## Notes

**2026-07-22T15:57:33Z**

DECISIONS (owner):
- Blocked action: REVEAL the existing vault-root heatmap SILENTLY (workspace.revealLeaf) — no Notice.
- Nav bridge: MINIMAL CALLBACK FLAG. App gets an `onAtVaultRootChange(atRoot: boolean)` prop; VaultTreemapView stores the boolean and exposes `isAtVaultRoot()` for the guard. Do NOT route nav through setState (layout-restore bonus is OUT of scope for this ticket).
- Guard applies to vault-level opens only (command + ribbon), scanning workspace.getLeavesOfType(VIEW_TYPE_TREEMAP).
- If multiple vault-root heatmaps pre-exist: reveal the FIRST found.
- Popout windows: getLeavesOfType already spans them — no extra work.

**2026-07-22T16:17:17Z**

RESOLVED on branch prevent-second-vault-heatmap.

Implemented the guard: vault-level opens (command open-vault-heatmap + ribbon) now REVEAL an existing vault-level VaultTreemapView currently at vault root (silent workspace.revealLeaf, first-found on multiples) instead of duplicating; a drilled-in vault view or any folder-targeted open still opens fresh. Bridge = App onAtVaultRootChange callback -> VaultTreemapView.isAtVaultRoot(); selection via pure obsidian-free src/view/VaultRootHeatmapFinder.ts (unit-tested). Files: src/view/VaultRootHeatmapFinder.ts(+test), src/view/components/App.tsx, src/view/VaultTreemapView.tsx, src/main.ts. Build/test(414)/lint all green.

CALLOUT: manifest.json minAppVersion bumped 1.5.7 -> 1.7.2 because the obsidianmd noUnsupportedApi lint flags revealLeaf (its return type became Promise<void> in 1.7.2). revealLeaf was owner-locked. Reversible; versions.json left for the release step. Awaiting owner confirmation of the version bump.
