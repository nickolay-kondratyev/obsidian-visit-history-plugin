# CLARIFICATION — rename `.visit_history` → `__visit_history`

Human-aligned decisions (2026-07-16):

1. **Vault-visibility tradeoff ACCEPTED**: `__visit_history` will be visible to Obsidian
   (file explorer, quick switcher, search). That is inherent to making it syncable via
   Obsidian Sync (dot-folders are not synced —
   https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26).
   The plugin's own tracking/heatmap MUST exclude it via `IsTrackedProvider`.
2. **Both-exist conflict** (`.visit_history` AND `__visit_history` both present — should not
   normally happen): SKIP the migration (keep `.visit_history` untouched, never merge, never
   delete), `console.error`, **AND show a user-facing Obsidian dialog/notice** informing the
   user of the conflict so it is not silent.
3. **Cleanup horizon**: keep "cleanup after 2026-October" (same as existing
   `VhUserScopeMigrationService`).

Decisions made by TOP_LEVEL_AGENT (flagged, unobjected):

- Tracking exclusion covers BOTH legacy `_visit_history` (V1) and new `__visit_history`
  (`isTrackedFile` and `isTrackedView`).
- New dir-rename migration runs FIRST in `main.ts.onload` — BEFORE username resolution and
  BEFORE `VhUserScopeMigrationService` (mobile user-adoption depends on this) — inside the
  same try/catch never-block-load isolation pattern.
- Forum-issue URL goes into a comment at `VhUserPaths.TOP_DIR` (the single source of truth).
- Docs/comments claiming "dot-folder invisible to Vault API" get reworded — the
  never-self-tracked invariant is now enforced by `IsTrackedProvider`, not by invisibility.
