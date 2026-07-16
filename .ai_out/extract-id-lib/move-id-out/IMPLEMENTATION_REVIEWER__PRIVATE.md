# IMPLEMENTATION_REVIEWER — private memory (rehydrate)

Role: IMPLEMENTATION_REVIEWER for extract-id-lib on branch `move-id-out`. Review COMPLETE, 2026-07-16.

## Verdict issued
READY — ITERATION CAN BE SKIPPED. 0 blocking, 0 major, 3 minor, 2 nits. Written to `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I verified myself (don't redo unless code changed)
- Env gotcha: interactive `npm` is a broken shell function (nvm missing) — MUST use `/usr/local/bin/npm`. First run of everything "failed" with exit 1 purely from that; re-run with abs path was all green. Logs at `.tmp/rev_{build,test,lint,testlib,libcheck}.log`.
- Re-ran: build 0; plugin tests 35/284; lint 0 errors (2 pre-existing prefer-active-doc warnings); test:lib 6/69; lib tsc check 0. Matches implementer report exactly.
- Lock (`submodules/obsidian-id-lib/src/CrossPluginPathLock.ts`) read line-by-line: exact D3 algorithm; key `__obsidian_id_lib_path_lock_registry_v1__`; NOOP-swallow predecessor; never-rejecting stored tail; `=== next` cleanup guard (microtask-gap race reasoned safe); FIFO safe (sync get→set); getDocId lock-free (AC-S2 asserts host key-free); 2 boundary `as` casts with WHY comments — OK.
- Behavior preservation: diffed all moved files vs `git show 9a24c64^:src/core/service/docId/*`. DocIdStore byte-identical; others only seam rename (NoteFileUtil→FileContentAccess), log prefix [VHP]→[obsidian-id-lib], one AP ref line + `ensureDocId`→`ensureId` doc fix in generator. Test-title comm diff: ZERO removed its(), 5 added (2 AC-B7 backstop, 3 lock tests).
- ulid: absent from package.json/lockfile/src (careful: my first grep piped to head gave head's exit code — re-ran unpiped). Stale old-path imports: none. `src/core/service/docId/` = backfill files only.
- main.js untracked; contains registry key (1 hit). Submodule pointer at HEAD = 85d9ed5 = final lib SHA. Submodule tree clean, ls-files clean (no node_modules). Parent commits 9a24c64/2726a18/c34aa58 match report. CLAUDE.md is symlink → AGENTS.md (edits landed there).
- Docs verified accurate: lib README (both APs `ap_iZAE3fAcs5zXIWrTiIdx3_E` id-format, `ap_e7fWGWziwxrLmnegjIYKX_E` window-key), design brief §Solution.3 = Vault.process + WHY-NOT processFrontMatter, AGENTS.md/architecture.md/plugin README diffs read in full.
- Plugin vitest.config + esbuild.config UNCHANGED (no deps.inline fallback needed — confirmed via git diff 531314b..2726a18).

## Minor issues I reported
1. Canvas ensureId returns generated id even when re-check kept concurrent id (pre-existing asymmetry vs frontmatter store; lock-bypass-only reachable; follow-up w/ owner sign-off).
2. Follow-up candidates listed in report but no `docs/tickets/` files created.
3. AC-P6 fresh standalone lib npm install not literally re-done from clean clone (check+test ran green standalone).

Nits: Q3 said "app-taking facade", shipped Vault-taking (flagged in approved plan D2); plugin tsconfig include misses .tsx (pre-existing).

## Outstanding for HUMAN
- Push submodule main (85d9ed5) to git@github.com:nickolay-kondratyev/obsidian-id-lib.git BEFORE sharing parent branch (unreachable-SHA hazard). No pushes done by agents.
- No #QUESTION_FOR_HUMAN raised.
