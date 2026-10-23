---
closed_iso: 2026-10-23T23:47:13Z
id: nid_zm4hogy3zq89xfxyiv5wdncyj_e
title: "Heatmap: banner when the map's timestamps are clustered (e.g. after a fresh sync)"
status: closed
deps: []
links: [nid_z3ifk9vxm295cpu4tqu99gj7m_e, nid_7n2lvhgesln25nxooiauewd8c_e]
created_iso: 2026-10-23T23:21:04Z
status_updated_iso: 2026-10-23T23:47:13Z
type: feature
priority: 2
tags: [heatmap, obsidian-mobile]
---

## Goal

User report: "First open looks uniformly green — no recency information. On a freshly synced vault almost every note shares the same mtime (mine: 608 notes at 2026-10-15). With the defaults (Color by = modified, hot = 3 days, cold = 21 days, Nature gradient) the whole map renders in nearly the same green… It looks like a layout bug, but the layout is fine."

The layout is fine. Sync tools stamp every downloaded file with the download time, so the recency data really is gone on that device. No color or threshold change can bring it back. The `created` field gets reset by sync too, and `visited` is stored per device and does not sync.

Outcome: when the timestamps of the color-by field are clustered, the header shows a plain-language banner explaining why the map looks uniform, so users don't think it's broken. This works on all platforms. It is the cheap 80% fix. Restoring the real times from git is the follow-up `nid_z3ifk9vxm295cpu4tqu99gj7m_e`, which reuses this ticket's detection.

## Done criteria

- A pure, obsidian-free detector (own class, mirrored unit test file) decides "clustered" from a list of timestamps. Unit tests cover:
  - clustered vs. spread input;
  - exactly at the threshold;
  - too few files to judge (never clustered);
  - empty input;
  - a cluster that isn't the earliest or latest value.
- The detector returns which files are in the cluster, not just a boolean, so the follow-up ticket can use the same rule to pick restore targets.
- With color-by = `modified` (`lastModifiedAt`) or `created` (`createdAt`) and the files in the current view clustered, the heatmap header shows a banner. It says, in user vocabulary, how many of the files share the same time, that this usually comes from a sync, and that recency colors aren't meaningful here.
  - Example: "523 of 608 notes have the same modified time, probably from a sync. Recency colors don't mean anything here."
- No banner with color-by = `visited`, and none when timestamps are spread out. A unit test covers each case wherever the gating logic lives.
- Desktop: an e2e test or a screenshot in `.out/` shows the banner on a vault whose files share one mtime, and shows no banner on a normal vault.
- Android tablet: verified with `npm run android:setup` and `npm run android:push-plugin` (see `docs/android-tablet-testing.md`). The banner renders legibly and doesn't break the header layout. Watch for the same tablet CSS pitfalls as `nid_7n2lvhgesln25nxooiauewd8c_e`.
- `npm run lint` passes with zero errors, and `npm test` passes.
- `docs/heatmap-view.md` and the heatmap bullets in `CLAUDE.md` are updated concisely.

## Context

- Timestamps are read once, in `src/core/util/vault/VaultUtil.ts`, inside `getTrackedFiles()` (`f.stat.mtime` / `f.stat.ctime`). `src/viewModel/buildVaultTree.ts` maps them to `VaultNode.lastModifiedAt` / `createdAt` (`src/core/data/VaultNode.ts`).
- Existing banner pattern to copy: the visit-time "hidden notes" banner.
  - The count is computed in a memo in `src/view/components/TreemapViz.tsx` and bubbled up through `onStatsChange` / `TreemapStats`.
  - `src/view/components/App.tsx` holds the stats and gates the count per mode.
  - `src/view/components/Header.tsx` renders `span.hdr-hidden-banner` with `role="status"`.
  - Styles live in `styles.css`.
- Defaults: `DEFAULT_HEATMAP_CONFIG` in `src/viewModel/heatmapConfig.ts` (`field: 'lastModifiedAt'`, `hotDays` 3, `coldDays` 21). Fields: `HEAT_FIELDS` in `src/view/constants.ts`.
- Recommended starting rule: clustered when at least 50% of at least 20 files fall inside one 60-second window. Tune it if real data says otherwise. These must be named constants, not magic numbers.
- "Current view" means the files the treemap actually lays out, after archive pruning and filtering. That way the banner matches what the user sees, the same as the hidden-notes count.

## Constraints

- Detection is stateless. It is derived from the current timestamps on each render: no persisted "last sync" or "last checked" state. Whether the sync was recent doesn't matter; clustered timestamps make the map useless either way.
- The detector must be fast enough for large vaults (O(n log n) sort plus a sliding window is fine), because it runs on every render of the stats memo.
- The plugin keeps its theme-aware styling rules. No hard-coded colors (see the heatmap theme bullet in `CLAUDE.md`).

## Non-goals

- Restoring timestamps, and any git awareness or call to action. That's `nid_z3ifk9vxm295cpu4tqu99gj7m_e`, which adds the "Restore from git" button to this banner.
- Changing the default thresholds, adding percentile or auto-range color scales. When most timestamps are identical, rescaling the colors shows nothing new.
- Dismiss or "don't show again" behavior. The banner disappears once the data stops being clustered.

## Verification

- Desktop e2e `e2e/heatmapClusteredTimestamps.e2e.ts`: banner shown on a clustered vault, absent on a spread vault.
- Android tablet emulator (medium_tablet, headless swangle_indirect), checked by the implementer: landscape 1280px renders the banner on one line; portrait 800px wraps to two lines within the 42px header; header buttons stay inside.
