---
id: nid_z3ifk9vxm295cpu4tqu99gj7m_e
title: "Heatmap: restore modified times from git history (isomorphic-git, desktop + mobile)"
status: open
deps: [nid_zm4hogy3zq89xfxyiv5wdncyj_e]
links: [nid_zm4hogy3zq89xfxyiv5wdncyj_e, nid_2sx3if2tus8bc7j3i4oio11b7_e]
created_iso: 2026-10-23T23:21:04Z
status_updated_iso: 2026-10-23T23:21:04Z
type: feature
priority: 2
tags: [heatmap, git, obsidian-mobile]
---

## Goal

After a sync, most files share one mtime (the download time), so the heatmap's recency colors say nothing. `nid_zm4hogy3zq89xfxyiv5wdncyj_e` explains this with a header banner. When the vault is a git repo (`.git` at the vault root), the real last-change times still exist in git history. Let the user restore each clustered file's mtime from its last commit with one action, on desktop AND mobile (Android/iOS). Mobile has no `git` binary and no child processes, so this uses **isomorphic-git** (pure JS, MIT; the library obsidian-git uses on mobile). The owner approved adding it as a dependency.

## Done criteria

- **Entry points.**
  - The clustered-timestamps banner from `nid_zm4hogy3zq89xfxyiv5wdncyj_e` shows a "Restore from git" button when `.git` exists at the vault root.
  - A command (stable id, e.g. `restore-modified-times-from-git`) does the same from anywhere.
  - Both run ONE code path.
- **Consent.** A confirm modal (reuse `src/settingsTab/ConfirmModal.ts`) states how many files will be updated and that the git commit time is used as the modified time. Nothing is written before the user confirms.
- **Targets.**
  - Only tracked files whose mtime is in the cluster are targeted. The cluster is picked by the SAME detector as the banner ticket, run over all tracked files, not a second rule.
  - Files whose current content differs from the HEAD blob (edited since the last commit, or not in HEAD) are skipped; their current mtime is real.
- **Walk.**
  - Walk commits from HEAD, newest to oldest, diffing each commit's tree against its parent's.
  - Each target's time is the commit time of the first (newest) commit that changed it.
  - Stop as soon as every target is resolved.
  - Skip subtrees whose tree hash didn't change, so each commit costs about the size of its change, not the size of the vault.
  - Stop at a named commit cap or at the shallow-clone boundary. Files still unresolved there keep their current mtime; never stamp the boundary commit's time.
- **Feedback.**
  - Show progress while the walk runs (a Notice, updated) once it passes ~1 s.
  - End with a result in user vocabulary: "Restored N files. M couldn't be dated (changed since the last commit, or older than the available history)."
  - Errors are plain language, e.g. not a git repo, or a corrupt/unsupported repo. Nothing is written on error.
- **Write + refresh.**
  - mtimes are written only after the walk finishes.
  - Afterwards the open heatmap view(s) re-read and show the restored recency without an Obsidian restart. `src/view/VaultTreemapView.tsx` listens only to create/delete/rename (debounced 500 ms), not modify, so an explicit refresh is needed. Obsidian's `TFile.stat.mtime` must reflect the new value; verify it.
- **Tests.**
  - Unit tests for the walk/resolution logic against a fake history seam: early stop, unchanged subtrees, cap, shallow boundary, merge commits, dirty file, file absent from HEAD.
  - At least one integration test runs the real isomorphic-git against a temp git repo built in the test with fixed commit dates (`GIT_COMMITTER_DATE`) and asserts the resolved times.
  - `npm test` and `npm run lint` pass, with zero lint errors.
- **Desktop verified.** Run in real desktop Obsidian, preferably with an e2e test under the existing harness (`docs/e2e-testing.md`): a vault that is a git repo with clustered mtimes ends with files carrying their commit times on disk, and the banner disappears.
- **Android verified.** On the tablet emulator (`npm run android:setup`, `npm run android:push-plugin`; `docs/android-tablet-testing.md`), with a git vault copied in, record in the ticket on close:
  - (a) whether `DataAdapter.write(..., { mtime })` is honored;
  - (b) whether isomorphic-git runs (the `Buffer` global question);
  - (c) wall-clock time of a deep walk on a vault with a long history (≥1k commits, all files clustered).
  - If (a) or (b) fails on mobile and can't be fixed robustly, STOP and report rather than hacking around it. Desktop-only would then be a scope change for the owner to approve (ticket tagged `decide`).
- **Bundle measured.** Record the production `main.js` size before and after in the ticket. A spike measured ~163 KB minified for isomorphic-git's `log`/`walk`/`TREE` plus ~28.5 KB for the `buffer` package, against a 278 KB baseline. The owner accepted that order of growth; flag it if the real number is far larger.
- **Docs.** `docs/heatmap-view.md`, the `CLAUDE.md` architecture and decision bullets (concise), and `change_log` are updated.

## Context

- Data flow of timestamps: `src/core/util/vault/VaultUtil.ts` `getTrackedFiles()` reads `TFile.stat.mtime`, then `src/viewModel/buildVaultTree.ts`, then `src/view/VaultTreemapView.tsx` `refresh()`, then `src/view/components/App.tsx`.
- Dot-path access: `src/core/util/file/hidden/HiddenFileUtil.ts` (DataAdapter-based; `exists`, `readIfExists`, list methods; no `stat`) reaches `.git`, which the Vault API never yields.
  - isomorphic-git needs a promise-style `fs` object (`readFile`, `readdir`, `stat`, `lstat`, `readlink`, …). Build a read-only adapter over Obsidian's `DataAdapter`; obsidian-git does the same.
  - Write access to `.git` is never needed.
- `Platform` checks live in `src/core/util/env/DesktopNodeModule.ts`. This feature should NOT need a desktop branch if mobile verification passes.
- `esbuild.config.mjs`: bundle, cjs, es2021, browser platform by default; `external` includes Node `builtinModules`, so a bare `buffer` import stays an external require, which fails on mobile.
  - isomorphic-git expects a global `Buffer` in browsers. Provide it from the `buffer` npm package, e.g. via esbuild `inject`. Check that it doesn't leak into or clobber Obsidian's globals on desktop.
- Existing Android test-path notes: `nid_2sx3if2tus8bc7j3i4oio11b7_e` (raw CDP into the Android WebView; Playwright `connectOverCDP` doesn't work there).
- Design discussed with the owner (2026-10-23):
  - Partial syncs resolve in a handful of commits because targets changed recently.
  - A fresh full sync clusters every file, so the walk can go deep; only history can reveal those times.
  - Git commit time can differ from the actual edit time (e.g. bulk commits). That's accepted for a heatmap, and the confirm modal says so.

## Constraints

- **No network code.** Import only isomorphic-git's local read APIs; never `isomorphic-git/http/*`. The plugin is fully offline, and the publish scorecard flags network calls. Grep the production bundle for `fetch(` / `XMLHttpRequest` and record the result.
- **Read-only on `.git`.** No commits, index or ref changes.
- **User files: only their mtime changes.** Content must stay byte-identical, including line endings.
  - If `DataAdapter.write(path, sameContent, { mtime })` is the mechanism, read the raw content and write the exact same string back; check binary-safety for the tracked types (`.md`, `.canvas`, `.excalidraw*`).
  - Never write through `processFrontMatter` or anything that re-serializes.
- **Dirty-file check must err toward skipping.** Compare by git blob hash of the current bytes (isomorphic-git `hashBlob`). Line-ending conversion (`core.autocrlf`) makes hashes differ, and those files are then skipped. That's the safe direction; mention it in the result count, don't "fix" it.
- **One seam for history reading** (an interface plus an isomorphic-git implementation and a test fake) is justified as a real I/O seam. No other new interfaces.
- **Cap and window values are named constants.**

## Non-goals

- Restoring `ctime`/created time. `DataWriteOptions` also has `ctime`, but git's "first commit" isn't a reliable creation time, and the user report is about modified time.
- Running automatically or in the background. It runs only when the user acts.
- Repos whose root is above the vault (the vault is a subfolder of a repo), submodules, or `.git` files that point elsewhere (worktrees). Show "not supported" if detected cheaply; otherwise treat as "no `.git`".
- Spawning the `git` binary on desktop as a faster path. One code path for all platforms, unless the Android timing is unacceptable; then raise it as a `decide` follow-up.
- Persisting restore results or any history cache.
