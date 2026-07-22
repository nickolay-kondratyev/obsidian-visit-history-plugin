# Implementation Review — Prevent second vault-level heatmap

## VERDICT: READY (with one #QUESTION_FOR_HUMAN to sign off)

No BLOCKING or SHOULD-FIX code defects. The implementation matches the
owner-locked decisions and the acceptance criteria. The only open item is a
human sign-off on the `minAppVersion` bump (see #QUESTION_FOR_HUMAN).

## Build / Test / Lint (actually run)
- `npm run build`: PASS (exit 0). `tsc -noEmit` + esbuild clean.
- `npm test`: PASS — 44 files, 414 tests (6 new for the finder).
- `npm run lint`: 0 errors, 1 warning — pre-existing `setWarning` deprecation
  in `src/settingsTab/ConfirmModal.ts`, unrelated to this change. Confirmed
  baseline.

## Correctness — verified GOOD
- **Guard triggers exactly when required.** `src/main.ts:171-188`
  `findVaultRootHeatmapLeaf` scans `getLeavesOfType(VIEW_TYPE_TREEMAP)`,
  narrows `leaf.view instanceof VaultTreemapView` (the single Obsidian-boundary
  narrow, no `as`), and delegates selection to the pure
  `VaultRootHeatmapFinder.firstVaultRootLeaf` — matches only
  `isVaultLevel && isAtVaultRoot`, first-wins. Multiple-root → first found.
- **"At root" is trail-derived, not raw segments.** `src/view/components/App.tsx:221`
  `const atVaultRoot = trail.length === 0;` reports what is actually RENDERED.
  An unresolvable `folderSegments` (deleted/renamed folder) falls back to
  rendering the vault root and correctly reports `true` — honest, and matches
  the ticket's subtle note (line 107 of exploration).
- **Vault-level vs folder-targeted distinction is sound.** `isVaultLevel()` =
  `folderPath === undefined`. Folder-menu opens still call `openHeatmap(file.path)`
  directly (unguarded) — correct, out of scope.
- **Effect fires on mount AND on flips.** `App.tsx:222-224` `useEffect` keyed on
  `[atVaultRoot, onAtVaultRootChange]`. `handleAtVaultRootChange` is a stable
  class-field arrow (`VaultTreemapView.tsx:69`), so its identity never changes
  across renders — the effect won't spuriously re-fire, and fires once on mount.
- **Initial-flag race is handled correctly.** `VaultTreemapView.atVaultRoot = true`
  default (line 50). Before React mounts/reports, a freshly opened OR a
  workspace-restored vault-level heatmap is genuinely at root (drill-down does
  not survive layout restore — `folderSegments` seeds from `initialFolderPath`
  = `folderPath` = undefined → `[]`), so `true` is truthful. For a
  folder-targeted view the default is irrelevant because `isVaultLevel()` is
  false. No stale-flag mis-trigger.
- **Popouts covered.** `getLeavesOfType` spans all windows; `revealLeaf`
  handles popout reveal. Matches owner decision.
- **Silent reveal, no Notice.** `main.ts:127-131` `void revealLeaf(existing); return;`
  Matches the locked decision exactly.

## Edge cases — reviewed
- Restored/never-mounted vault-level leaf → default `true` → correctly revealed. GOOD.
- Folder-targeted view at its own root → `isVaultLevel` false → never blocks. GOOD
  (covered by test `should return null when a folder-targeted view is at its own root`).
- Drilled-in vault-level view whose folder is later deleted → trail falls back to
  root → reports `true` → will then block/reveal. This is the intended
  "truthful to rendered" behavior (ticket-endorsed), not a bug.

## Findings

### BLOCKING
None.

### SHOULD-FIX
None (the manifest bump below is a human decision, not a defect).

### NICE-TO-HAVE
1. **Rapid double-open can still create duplicates.** `main.ts:122-132` — when
   NO existing root leaf is found, `openHeatmap()` calls
   `getLeaf(true).setViewState(...)` which is async and not awaited; the new
   leaf may not yet appear in `getLeavesOfType` if the command is fired twice in
   quick succession, yielding two vault-level leaves. This is inherent to the
   pre-existing async open and low-impact; out of the locked scope. If ever
   tightened, a short in-flight guard around `revealOrOpenVaultHeatmap` would
   close it. No action needed now.
2. **Wiring is unit-untested** (App effect, `VaultTreemapView` flag, `main.ts`
   guard). The load-bearing selection logic lives in the pure
   `VaultRootHeatmapFinder` and IS covered by 6 BDD tests. Per CLAUDE.md's
   "keep wiring trivial instead" and Pareto, this is acceptable and honestly
   disclosed in the impl summary. No faked/aligned assertions observed.

## Code quality (per CLAUDE.md) — GOOD
- **SRP/DIP**: selection extracted to a pure, generic, obsidian-free
  `VaultRootHeatmapFinder` (`firstVaultRootLeaf<L>`); Obsidian boundary confined
  to `main.ts`. Private constructor prevents instantiation of the static-only
  class.
- **No `as` casts** except the necessary `instanceof` narrow at the boundary
  (idiomatic, not an `as`). Explicit return types on all new public methods.
  String-literal-free (no enums involved). No free-floating functions —
  `VaultRootHeatmapFinder` is a cohesive static class; `handleAtVaultRootChange`
  is a bound field.
- **Docs explain WHY**: the default-`true` rationale, trail-vs-segments choice,
  and popout coverage are all documented at the right places. `readonly` on the
  handler field.
- **Tests**: BDD `describe > describe > it`, one assert each, meaningful edge
  coverage (drilled-in, folder-targeted-at-root, multiple→first, skip-then-hit,
  empty). Comments explain the non-obvious folder-targeted case.

## #QUESTION_FOR_HUMAN — manifest minAppVersion 1.5.7 → 1.7.2
`Workspace.revealLeaf` is flagged by `obsidianmd/no-unsupported-api` as
requiring Obsidian ≥1.7.2 (its return type became `Promise<void>` in 1.7.2;
current typings at `obsidian.d.ts:8029` reflect that). The implementer bumped
`manifest.json` `minAppVersion` to 1.7.2 to keep lint at ZERO errors while
honoring the locked "reveal via `revealLeaf`" decision.

- **Reviewer assessment**: `revealLeaf` has existed as a core, void-returning
  workspace API since long before 1.7.2; only its *typed* return became a
  Promise. The code uses `void this.app.workspace.revealLeaf(existing)` and
  never awaits, so it would run correctly on 1.5.7–1.7.1 at RUNTIME. The bump is
  therefore stricter than strictly required for functionality — it exists to
  satisfy the lint DB, which CLAUDE.md mandates be kept at zero errors (it is
  Obsidian's publish-time validation).
- **Options for the human**:
  1. ACCEPT the bump (cleanest, honest, no suppressions) — drops support for
     Obsidian 1.5.7–1.7.1.
  2. Keep `minAppVersion: 1.5.7` and add a scoped `eslint-disable-next-line
     obsidianmd/no-unsupported-api` with a WHY comment (revealLeaf existed as a
     void API pre-1.7.2; Promise return unused). Preserves older-version support
     but introduces a suppression and risks the publish validator rejecting it.
  3. Switch to `setActiveLeaf(leaf, { focus: true })` (available earlier) — but
     this DEVIATES from the owner-locked "reveal via `revealLeaf`" decision, so
     the implementer correctly did NOT take it without approval.
- **Recommendation**: Option 1 (accept) unless the owner has known
  1.5.7–1.7.1 users — the reveal semantics are load-bearing and a suppression is
  more brittle than a version floor. Human must confirm.
- **Release note (already flagged by impl)**: `versions.json` was left
  unchanged — correct; it maps already-released plugin versions. The next
  `npm run version` at release must record `1.7.2` for the new plugin version.
  Ensure the release step is not skipped.

## Requirements parity vs acceptance criteria
- Vault-root heatmap already open → reveals existing, no duplicate. ✅
- Drilled-in existing vault-level view → new open creates a NEW view. ✅
- Folder-targeted opens unaffected. ✅
- Unit coverage of the at-root decision + selection logic. ✅ (selection fully
  covered in the pure finder; the React at-root derivation is exercised
  indirectly — see NICE-TO-HAVE 2).
