# DETAILED PLAN — Heatmap Filter UI

> Role: PLANNER (DETAILED_PLANNING). Inputs: `EXPLORATION_PUBLIC.md`, `CLARIFICATION__PUBLIC.md` (HUMAN-approved), frontend design memory.
> Consumers: PLAN_REVIEWER, IMPLEMENTATION.

## 1. Problem understanding

Rework the heatmap header from "mostly info" to "mostly action", and add include-only filtering:

1. **Filter UI**: filter icon (left-most of a header filter group) + removable term chips; popover input to add terms. Two term kinds, visually distinguishable:
   - **path** — case-insensitive substring against the file's FULL vault path (folder names included),
   - **content** — case-insensitive substring against file CONTENT.
   OR semantics across all terms; include-only. Persisted in `HeatmapConfig` (data.json); survives restarts AND folder drill-down.
2. **ⓘ INFO popover** collapses title + stats + legend (all reflect the FILTERED view — stats already bubble up from what `TreemapViz` renders).
3. **Field indicator** stays in header, becomes a clickable selector (created/modified/visited) reusing the config panel's `RadioGroup` field-selection component (DRY).
4. **Config** becomes an icon button.

Verified data flow for the field selector (no new plumbing needed): `VaultUtil.getTrackedFiles()` → `LastVisitProvider.getLastVisitStamp` fills `visitedMs` → `buildVaultTree` maps to `VaultNode.lastVisitedAt`; the selector only changes `config.field` (`HeatField = 'createdAt' | 'lastModifiedAt' | 'lastVisitedAt'`) through the existing `updateConfig` → `HeatmapConfigStore` path.

**Constraints**: React view stays Obsidian-agnostic (only `VaultTreemapView` imports `obsidian` in `src/view/`); no React test harness — all testable logic lives in `src/viewModel/` (or core) as pure functions/classes; icons = Unicode/inline SVG (no `setIcon`); ESLint zero errors; strict TS.

## 2. Architecture

### 2.1 Content-search seam (the CRITICAL design decision)

Approaches considered:

- **A (CHOSEN) — matcher service injected as a prop; App resolves terms → path set; tree filter stays pure.**
  A new Obsidian-agnostic interface `ContentTermMatcher` (viewModel) with a `ContentTermMatcherDefault` impl built on existing core seams (`VaultUtil` + `NoteFileUtil.cachedRead`). Wired in `PluginFactory`, passed `VaultTreemapView → App` as a prop (mirrors `heatmapConfigStore` / `fileOpener` precedent). `App` runs one `useEffect` when content terms change: `terms → Promise<ReadonlySet<string>> (matched vault paths)`, stored in state. Tree filtering itself is a **pure sync function** consuming `pathTerms` + the resolved path set.
  - PRO: async confined to ONE effect; filter function pure and fully unit-testable; matcher independently testable with `FakeVaultUtil`/`FakeNoteFileUtil`; zero cost when no content terms exist.
  - CON: brief window where content-match results lag term changes (defined below).
- **B — host (`VaultTreemapView`) filters the tree before passing `data`.** REJECTED: terms live in `HeatmapConfig`, loaded/owned by `App`; the host would need a callback loop (App → host → re-render App) — inverted, stateful, fights the remount-by-key design.
- **C — read all file contents at tree-build time (content index on `VaultNode`/side table).** REJECTED: reads the whole vault on every debounced refresh even when no content term exists; memory-heavy; violates Pareto.

**Performance stance (KISS)**: terms are added/removed by discrete user actions (Enter / chip ✕) — that IS the debounce; no per-keystroke filtering. `Vault.cachedRead` is Obsidian's cached read (what core search uses). One pass over tracked files per term-set change, early-exit per file on first matching term. No persistent index, no LRU in v1 — flagged as a follow-up ticket if huge vaults hurt.

**Async semantics (latest-wins, defined)**:
- `contentMatchedPaths: ReadonlySet<string> | undefined` in `App`. `undefined` ⇔ NO content terms exist ⇔ content filtering inactive.
- When content terms exist but the current search hasn't resolved: keep the PREVIOUS resolved set (stale-but-close); on first activation (incl. persisted terms at mount) use the EMPTY set — results appear when resolved (monotonic fill, no "everything flashes then vanishes").
- Effect cleanup flag (or request counter) discards out-of-order resolutions — latest term set wins.
- Staleness note: file EDITS don't re-trigger matching (matching re-runs on term change and on vault-refresh re-render). Same staleness class as the existing tree (sizes/mtimes also only refresh on create/delete/rename) — consistent, accepted.

### 2.2 Pure tree filter (mirrors `pruneArchiveFolders`)

New `src/viewModel/filterVaultTree.ts` — pure, never mutates, drops folders left empty:

```ts
export interface HeatmapTreeFilter {
  /** Raw path terms; matching lowercases both sides. */
  pathTerms: readonly string[];
  /** Vault paths matched by content terms; undefined = content filtering inactive. */
  contentMatchedPaths: ReadonlySet<string> | undefined;
}
// Leaf kept ⇔ pathTerms.some(t => leaf.path.toLowerCase().includes(t.toLowerCase()))
//           || contentMatchedPaths?.has(leaf.path)
// No active filter (no path terms && contentMatchedPaths === undefined) → return root AS-IS
// (reference equality keeps the TreemapViz memo cheap).
export function filterVaultTree(root: VaultNode, filter: HeatmapTreeFilter): VaultNode
```

Applied in `TreemapViz`'s existing `treeRoot` useMemo, composed AFTER archive pruning:
`filterVaultTree(showArchived ? root : pruneArchiveFolders(root), filter)` — exactly the established pattern, and stats/legend automatically reflect the filtered view because `onStatsChange` derives from the rendered layout.

### 2.3 Canonical drill-down (correctness prerequisite — MUST do)

Today `navStack`/`currentRoot` store **node objects from a pruned COPY** of the tree. With filtering that becomes a real bug: drill into folder F while a filter is on → `currentRoot` is a filtered copy containing only matching leaves → removing the term can never bring files back (the copy simply lacks them). Also latent today: after a vault refresh, `navStack` keeps nodes of the OLD tree.

**Fix — make nav state path-based and DERIVE nodes from canonical `data`:**
- `App` state: `folderSegments: string[]` (vault-relative folder path segments) instead of `navStack: VaultNode[]`.
- Derived per render (useMemo): `trail = findFolderTrail(data, folderSegments.join('/')) ?? []` (existing, tested helper); `currentRoot = trail.at(-1) ?? null`; `breadcrumb`/`showArchived` derive from `trail` (not from raw segments), so an unresolvable path (folder deleted) safely falls back to root with no ghost breadcrumb.
- Drill-down click: `FolderNode` passes its `HierarchyRectangularNode` (it already holds `d`); `TreemapViz` maps it to segments via `d.ancestors().reverse().slice(1).map(a => a.data.name)` and calls `onFolderClick(segments)`. Folder names never contain `/` (they come from splitting paths on `/`), so segments are unambiguous.
- `handleBack` pops the last segment. Initial seeding: `initialFolderPath.split('/')`.

**TRANSPARENT behavior call-outs** (both improvements, aligned with the already-approved seeded-trail behavior):
1. Clicking a folder 2+ levels deep now records the FULL ancestor trail — "back" walks up one level at a time (today it jumps straight to where you clicked from), and the breadcrumb now shows the true full path (today it silently shows a partial/wrong path after a deep click).
2. Vault-refresh no longer renders a stale subtree while drilled in.

### 2.4 Header & popovers

Target layout (title removed — redundant with the view tab title, HUMAN-approved):

```
[← back /path] │ [▾filter-icon] [/chip ✕] [≡chip ✕] │ [field: modified ▾] [--spacer--] [ⓘ] [⚙]
```

- **Single-open-panel state** in `App`: `openPanel: 'config' | 'filter' | 'field' | 'info' | null` replaces `configOpen`. Toggling a trigger opens its panel and closes any other — prevents overlap and lets popovers share screen anchors. (Click-outside dismissal: NOT added — the existing ConfigPanel is toggle-only; consistency; follow-up polish ticket.)
- **Popovers reuse the ConfigPanel open-class pattern**: always-rendered sibling `<div>`s of `#header` (NOT inside it — `#header` has `overflow:hidden`), visibility via `.open` CSS class, `position:absolute; top:42px`.
- **Anchoring (CSS-only, per "favor CSS over JS")**: filter + field popovers anchor `left:14px` (their triggers live in the left cluster); info popover anchors `right:0` (its trigger is on the right; the config panel keeps its own `right:0` slot). Only one is ever open, so shared anchors can't collide. WHY-NOT measured-anchor JS: header content width is dynamic (breadcrumb/chips), measuring adds refs+state for marginal gain; noted as optional polish.
- **Icons**: Unicode glyphs, matching the existing `⚙`/`←` precedent and the approved sketch — `🔍` (filter), `ⓘ` (info), `⚙` (config, now icon-only). Every icon button gets `aria-label` + `title` + `aria-expanded`.
- **Chips — kind distinguishability** (per design memory: never color alone): path chips get a `/` prefix glyph + one accent tint; content chips get a `≡` prefix glyph + a different accent tint (pick hues echoing the existing palette, e.g. md-blue vs canvas-orange family); plus `title="path term" / "content term"`. Each chip has a `✕` button (`aria-label="Remove filter: <text>"`).
- **Filter popover content**: `SegmentedToggle` (reused, DRY) choosing the kind to add (`path | content`, local component state — ephemeral UI state is fine in the component), a text input (Enter adds; trimmed; duplicates ignored), a one-line kind hint ("matches file path" / "matches file content"). Popover stays open after adding (multi-add flow).
- **Field selector**: the `.ts-indicator` becomes a button (still only rendered in `heatmap` colorMode, as today); its popover contains the SAME `RadioGroup` with the SAME field options as `HeatmapOptions`. DRY: extract `FIELD_OPTIONS` (currently built inside `HeatmapOptions.tsx` from `HEAT_FIELDS`/`FIELD_LABELS`/`FIELD_SUBS`) into `src/view/constants.ts` next to its inputs; both consumers import it.
- **Empty filtered result**: when a filter is active and the filtered root has zero leaves, `TreemapViz` renders a small centered message ("No files match the current filters") instead of a blank canvas (design-memory empty-state rule).

### 2.5 Config model

`src/viewModel/heatmapConfig.ts`:

```ts
export const FILTER_TERM_KINDS = ['path', 'content'] as const;
export type FilterTermKind = (typeof FILTER_TERM_KINDS)[number];
export interface FilterTerm { kind: FilterTermKind; text: string }
// HeatmapConfig gains:  filterTerms: FilterTerm[];   default: []
```

`HeatmapConfigSanitizer` gains a `sanitizeFilterTerms` branch (data.json is user-editable): non-array → `[]`; keep only objects with `kind ∈ FILTER_TERM_KINDS` and non-empty TRIMMED string `text`; dedupe case-insensitively per (kind, text); drop everything else silently (consistent with existing per-field fallback style).

Persistence across restarts and drill-down is automatic: terms ride `HeatmapConfig` through the existing `updateConfig → HeatmapConfigStore` (debounced save, flush on unload) and are independent of nav state.

### 2.6 Content matcher

`src/viewModel/ContentTermMatcher.ts` (interface + `ContentTermMatcherDefault` in one file — exact `FileOpener.ts` precedent; imports only core interfaces, no `obsidian`):

```ts
export interface ContentTermMatcher {
  /** Vault paths of tracked files whose content contains ANY term (case-insensitive substring). */
  findPathsMatchingAnyTerm(terms: readonly string[]): Promise<ReadonlySet<string>>;
}
```

`ContentTermMatcherDefault(vaultUtil: VaultUtil, noteFileUtil: NoteFileUtil)`:
- `terms` lowercased once; empty `terms` → empty set (fast path).
- Files via a NEW cheap `VaultUtil.getTrackedTFiles(): TFile[]` (sync: `vault.getFiles().filter(isTracked)`); `getTrackedFiles()` refactored to build on it (DRY). WHY-NOT reuse `getTrackedFiles()`: it also resolves last-visit stamps (doc-id reads) — pure waste here.
- Per file: `cachedRead` in try/catch → on error `console.error` once and treat as non-match ("malformed files never throw" rule); `content.toLowerCase().includes(term)` with early exit on first term hit. `Promise.all` across files (cachedRead is cache-backed; chunking deferred to the follow-up ticket).

Wiring: `PluginFactory` constructs and exposes `readonly contentTermMatcher: ContentTermMatcher` (it already has `vaultUtil` and the local `noteFileUtil`); `VaultTreemapView` passes it to `<TreemapApp contentTermMatcher={...}>`.

## 3. Implementation phases

Each phase compiles, lints (0 errors) and passes `npm test` on its own; commit per phase (milestone rule).

### Phase 1 — viewModel foundation (pure, no UI)
Files: `src/viewModel/heatmapConfig.ts` (+`.test.ts`), NEW `src/viewModel/filterVaultTree.ts` (+ NEW `.test.ts`).
1. Add `FilterTerm`/`FILTER_TERM_KINDS`, `filterTerms` field + default `[]`, `sanitizeFilterTerms`.
2. Implement `filterVaultTree` + `HeatmapTreeFilter` (identity fast-path, purity, empty-folder pruning per §2.2).
Verification: new sanitizer + filter tests green; existing `heatmapConfig.test.ts` "keeps valid config as-is" case extended with `filterTerms`.

### Phase 2 — content matcher + wiring
Files: `src/core/util/vault/VaultUtil.ts` (+ its test if present / add coverage), NEW `src/viewModel/ContentTermMatcher.ts` (+ NEW `.test.ts`), `src/core/init/PluginFactory.ts`, `src/view/VaultTreemapView.tsx`, `src/testSupport/fakes.ts` (extend `FakeVaultUtil` with `getTrackedTFiles`).
1. Add `getTrackedTFiles()`; refactor `getTrackedFiles()` onto it.
2. Implement + test `ContentTermMatcherDefault` (FakeVaultUtil + FakeNoteFileUtil).
3. Expose in `PluginFactory`; thread as `App` prop (type-only import in `App`).
Verification: unit tests green; `npm run build` clean.

### Phase 3 — canonical path-based drill-down
Files: `src/view/components/App.tsx`, `TreemapViz.tsx`, `FolderNode.tsx`.
1. Replace `navStack: VaultNode[]` with `folderSegments: string[]`; derive `trail`/`currentRoot`/`breadcrumb`/`showArchived` per §2.3.
2. `FolderNode.onClick` passes `d`; `TreemapViz` converts to segments; `App.handleFolderClick(segments)` just sets state.
Verification: manual drill/back incl. deep-folder click (breadcrumb now full path), context-menu folder open, archive scoping; `findFolderTrail` tests already cover resolution — add a test there only if a gap appears (e.g. empty-string path → confirm current behavior and codify).

### Phase 4 — header rework: icons, info popover, field popover
Files: `src/view/components/Header.tsx`, NEW `src/view/components/header/InfoPopover.tsx`, NEW `header/FieldPopover.tsx`, `ConfigPanel/HeatmapOptions.tsx`, `src/view/constants.ts`, `App.tsx`, `styles.css`.
1. Extract `FIELD_OPTIONS` to `view/constants.ts`; `HeatmapOptions` imports it.
2. `App`: `openPanel` single state; render `InfoPopover`/`FieldPopover` as siblings (open-class pattern); keep `ConfigPanel` component untouched (its `open` now derives from `openPanel === 'config'`).
3. `Header`: remove `#title`, `.stats`, `<Legend>`; `.ts-indicator` → trigger button; config → icon-only `⚙` button; add `ⓘ` button. `InfoPopover` = title line + the three stat rows + `<Legend colorMode gradKey/>` (reused as-is).
Verification: manual — panels mutually exclusive; field change persists (restart) and recolors; stats/legend values in ⓘ match pre-change header values.

### Phase 5 — filter UI + tree application
Files: `App.tsx`, `Header.tsx`, NEW `header/FilterGroup.tsx` (icon trigger + chips), NEW `header/FilterPopover.tsx`, `TreemapViz.tsx`, `styles.css`.
1. `App`: derive `pathTerms`/`contentTerms` from `config.filterTerms` (useMemo); content-match effect per §2.1; `addTerm`/`removeTerm` via `updateConfig` (dedupe + trim at add time too — sanitizer is the boundary backstop); pass `HeatmapTreeFilter` to `TreemapViz`.
2. `TreemapViz`: compose `filterVaultTree` into the `treeRoot` memo; add the zero-leaves empty-state message (only when a filter is active).
3. `FilterGroup` chips (kind-distinguished, removable) + `FilterPopover` (SegmentedToggle kind + input) per §2.4; filter icon left-most of the group.
Verification: manual — add/remove both kinds; OR across kinds; filter survives restart AND drill-down; removing a term while drilled in RESTORES files (the §2.3 fix); stats reflect filtered view.

### Phase 6 — CSS polish + docs + follow-up tickets
Files: `styles.css`, `CLAUDE.md` (succinct arch-blurb update), `docs/heatmap-view.md`, `docs/tickets/`.
Follow-up tickets to file: (a) exclusion/negation terms; (b) content-match performance for very large vaults (chunked reads / mtime-keyed result cache); (c) popover click-outside/Esc dismissal (all popovers + config panel, wholesale); (d) React component test harness evaluation.

## 4. Acceptance criteria (automated — vitest)

`HeatmapConfigSanitizer` (`heatmapConfig.test.ts`):
- AC1 missing/`undefined`/non-array `filterTerms` → `[]`.
- AC2 valid terms of both kinds pass through unchanged.
- AC3 items with unknown `kind`, non-string/empty/whitespace-only `text`, or non-object shape are dropped.
- AC4 `text` is trimmed; case-insensitive (kind,text) duplicates collapse to the first.
- AC5 a `path` term and a `content` term with identical text BOTH survive (dedupe is per kind).

`filterVaultTree` (`filterVaultTree.test.ts`, mirrors `pruneArchiveFolders.test.ts`):
- AC6 no active filter → returns the SAME reference (identity).
- AC7 path term matches case-insensitively against the full path, including FOLDER name segments (term `alpha` keeps `Projects/Alpha/x.md`).
- AC8 non-matching leaves are removed; folders left empty are pruned recursively; root always survives (possibly with zero children).
- AC9 OR across multiple path terms (union).
- AC10 leaf whose path is in `contentMatchedPaths` is kept with zero path terms.
- AC11 OR across kinds: leaf kept when it matches a path term but is absent from the content set, and vice versa.
- AC12 `contentMatchedPaths === undefined` + no path terms → unfiltered; `undefined` + path terms → path-only filtering; EMPTY set + no path terms → all leaves removed.
- AC13 purity: input tree deep-equal to its pre-call snapshot after filtering.

`ContentTermMatcherDefault` (`ContentTermMatcher.test.ts`):
- AC14 empty terms → empty set, and no file reads performed.
- AC15 case-insensitive substring: term `TODO` matches content `# todo list`.
- AC16 OR across terms; each matching file's vault path appears exactly once.
- AC17 a file whose read rejects is skipped (non-match), other files still evaluated, no throw.
- AC18 non-matching files are absent from the result.

`VaultUtilDefault`:
- AC19 `getTrackedTFiles` returns exactly the tracked-filtered files; `getTrackedFiles` result unchanged by the refactor (existing tests stay green).

React-only behavior (no harness — verified manually, listed for the reviewer): mutual-exclusion of panels, chip add/remove flows, popover anchoring, empty-state message, latest-wins async.

## 5. Testing plan (per CLAUDE.md)

- GIVEN/WHEN/THEN comments, one assert per test where practical, `describe(unit) > describe(method) > it('should X when Y')`.
- Mirrored files: `heatmapConfig.test.ts` (extend), NEW `filterVaultTree.test.ts`, NEW `ContentTermMatcher.test.ts`, VaultUtil coverage for `getTrackedTFiles`.
- Fakes only at boundaries: `FakeVaultUtil` (extended), `FakeNoteFileUtil`, `fileFactory.makeTFile`.
- All logic that popovers/chips need beyond rendering (term normalization/dedup, filter predicate, matching) lives in viewModel — components stay declarative shells.
- Full gate per phase: `npm test`, `npm run lint`, `npm run build` (redirect build output to `.tmp/`).

## 6. CSS plan (`styles.css`, all under `.vault-heatmap-view`)

- `.hdr-icon-btn` — square icon variant of `.header-btn` (same border/hover recipe, `padding:4px 8px`, `line-height:1`); used by filter/info/config triggers. Keep `.header-btn` for the field-selector trigger (it keeps a text label).
- `.filter-group` — grouped flex container styled like `.breadcrumb` (left `border-left` separator, `gap:8px`), `min-width:0` + `overflow-x:auto` on its inner `.filter-chips` so many chips scroll instead of blowing the 42px header (everything else in `#header` stays `flex-shrink:0`).
- `.filter-chip` — pill: `font-size:10px`, 1px border, subtle tinted background; `.filter-chip--path` / `.filter-chip--content` variants (distinct accent hue families per §2.4); `.filter-chip-kind` prefix glyph; `.filter-chip-x` borderless ✕ button with hover color lift (≥ comfortable hit area via padding).
- `.hdr-pop` — shared popover base copied from `#config`'s recipe (`position:absolute; top:42px; background:var(--vt-surface); border/z-index/max-height/overflow-y`), `display:none` → `.open{display:block}`; modifiers `.hdr-pop--left{left:14px}` (filter, field) and `.hdr-pop--right{right:0}` (info). Config panel CSS untouched.
- `.filter-pop-input` — text input styled after `.cfg-select`.
- `.viz-empty-msg` — centered dim message for the zero-match state.
- Reuse: `.cfg-h`, `.cfg-label`, `.cfg-radios`, `.seg-toggle`, `.legend*`, `.stats/.stat` styles apply inside popovers with at most selector widening (e.g. `.stats` used inside `.hdr-pop` keeps its look minus the `border-left` separator — add a scoped override rather than forking the markup).
- No JS for show/hide or hover states — CSS only (existing pattern).

## 7. Scope exclusions (deliberate)

- NO exclusion/negation terms, NO regex/glob, NO AND mode (include-only OR — per approved clarification; follow-up ticket).
- NO per-keystroke live filtering (terms apply on add/remove).
- NO content-match caching/index; NO chunked/limited concurrency reads (follow-up ticket if needed).
- NO match highlighting inside treemap cells; NO per-term match counts.
- NO click-outside/Esc popover dismissal (consistency with existing ConfigPanel; wholesale follow-up).
- NO React component test harness (repo-wide gap, unchanged).
- NO re-run of content matching on file-modify events (same staleness class as the existing tree refresh policy).

## 8. #QUESTION_FOR_HUMAN:

No blocking questions — approved decisions cover the feature. One non-blocking confirmation:

1. **Content-search cost model (non-blocking, proceed as planned unless overridden):** v1 re-reads every tracked file (via Obsidian's `cachedRead`) each time the content-term set changes — no persistent index. On multi-thousand-file vaults this can take on the order of a second per term change. Accepted for v1 with a follow-up ticket for mtime-keyed caching/chunking? (PARETO recommendation: yes — term changes are rare, discrete actions.)
