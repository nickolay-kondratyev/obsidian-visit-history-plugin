# DETAILED PLAN REVIEW — extract-id-lib / move-id-out

Reviewer: PLAN_REVIEWER, 2026-07-16
Plan reviewed: `DETAILED_PLANNING__PUBLIC.md` (against `CLARIFICATION__PUBLIC.md` binding decisions, `EXPLORATION__PUBLIC.md` facts, `docs/migration/extraction-of-id.md` lock spec, and the actual code).

## (a) Verdict

**APPROVED WITH MINOR REVISIONS (already applied inline).**

This is a strong, precise plan. I independently verified its load-bearing claims against the repo and found them accurate:

- **Binding decisions honored**: raw-text `Vault.process` + in-transform re-check kept (Q1); `docid_{24 base36 lowercase}_e` with any existing id honored as-is (Q2); DI classes + optional facade, no free functions (Q3); canvas store moves (Q4); `ulid` removed. Non-negotiables (lock primary / re-check seatbelt, window-only shared state) all present.
- **Lock design is correct and matches the brief's binding semantics.** I traced the D3 algorithm: chain-off-tail acquire, stored tail never rejects (protects foreign waiters), predecessor rejection swallowed (foreign rejecting tails can't wedge), `=== next` cleanup guard (a predecessor's cleanup can't detach a queued successor), release implicit via the tail settling on success or throw (the brief's finally semantics), no expiry, plain `Map<string, Promise>` on a versioned `globalThis` key so differently-versioned bundled copies interoperate. Registry get/check/set is synchronous → no creation race in a single-threaded renderer. **Two bundled copies genuinely serialize**: rendezvous is via the shared host object only, and AC-L6 (two lock instances, one host) plus AC-L7 (foreign pre-seeded/rejecting tail) test exactly that.
- **No deadlock/double-lock with existing serialization.** `InFlightDropGuard` (DROP) sits outside and never nests a same-path acquisition; `FocusTracker`'s dispatch chain awaits the lock but lock tasks never await the dispatch chain (no cycle); backfill's sequential `ensureDocId` calls acquire/release one at a time. `getDocId` stays lock-free (AC-S2) — heatmap bulk path protected. All correctly analyzed in D3.
- **Packaging is feasible as described.** Verified against the real configs: `file:` dep → npm symlink; lib `main`/`types` → `src/index.ts` pulls lib sources into the plugin's tsc program under the plugin's strict options (`skipLibCheck` only skips `.d.ts`, so lib `.ts` IS fully strict-checked — plan's claim holds); esbuild resolves `main` to `.ts` and bundles; vitest/vite resolves the symlink to its realpath outside `node_modules` so lib code is transformed and the `obsidian → obsidianMock` alias applies, with the `server.deps.inline` fallback documented. The lib's tsconfig mirroring the plugin's strictness (§3) closes the two-repo drift risk; `isolatedModules`/`export type` handled. `FakeNoteFileUtil` structurally satisfies the 2-method `FileContentAccess` (verified signatures: `cachedRead(file): Promise<string>`, `process(file, transform): Promise<void>`).
- **Behavior preservation is fully specified**: AC-B1..B7 covers every semantic in scope (existing id any format honored + file untouched; occupied-unusable slot never overwritten; raw `.excalidraw` skipped; empty canvas = new canvas `{}`; malformed JSON never throws; id-line-only atomic edits with CRLF/quote preservation; in-transform re-check). Moved tests move verbatim-in-substance, and `DocIdBackfillService.integration.test.ts` is smartly retained as the consumer-side seam proof (AC-P3). AC-P2's count accounting prevents silent test loss.
- **Completeness**: lib-repo standalone test story (own vitest + own obsidian mock — AC-P6), git submodule mechanics with buildable parent commits and the push-before-share caveat (D5), doc updates for design brief §Solution rewrite + CLAUDE.md + docs/architecture + lib README with both contracts anchor-pointed, fresh-clone story, ulid removal with grep verification.
- **KISS/PARETO**: right-sized. Raw-TS lib (no build step), 2-method seam instead of dragging `NoteFileUtil` along, lock in one place at the service level with a required ctor param (decorator rejected for the right reason), ESLint-in-lib deferred as a ticketed follow-up. No over-engineering found; no under-specified step found.

## (b) MAJOR issues

**None.** No issue rises to the level of changing approach, architecture, steps, or scope.

## (c) Minor issues fixed inline (edits I applied to DETAILED_PLANNING__PUBLIC.md)

1. **Phase 3.1 + Phase 4.3 — added `"test:lib"` npm script** (`npm --prefix submodules/obsidian-id-lib run test`) and its CLAUDE.md dev-env mention. Rationale: after the move, the plugin's `npm test` no longer executes the moved suites; without a root-level command, lib code changes could silently go untested from the plugin workflow ("tests must always run"). One-line, non-contentious.
2. **AC-S1 wording corrected**: when the lock works, it is the second writer's FAST-PATH read that sees the id and bails — the in-transform re-check backstop fires only when the lock is bypassed and is covered separately by AC-B7. The original wording conflated the two layers; the test itself was fine, the description now matches what it proves.
3. **D2 facade — transparency note added**: CLARIFICATION Q3 literally said "`app`-taking facade"; the plan's `createDefault(vault: Vault)` is a deliberate narrowing (consumers write `createDefault(app.vault)` — still one-line adoption). Noted in the plan so the deviation from the human's literal wording is visible; NOT a blocker since the intent (easy adoption, optional facade) is honored and the narrower handle is better practice. If the human prefers the literal `App` signature, only the facade widens.

## Observations verified, worth keeping in mind during implementation (no plan change needed)

- The lock registry key string survives esbuild minification (strings aren't renamed) — AC-P1's `main.js` grep is valid for production builds too.
- `DocIdBackfillService.ts` keeps its `[VHP]` log prefix (it stays in the plugin); only moved files switch to `[obsidian-id-lib]`.
- Lib tests need global `crypto.getRandomValues` — Node 18+ provides it; already true of the existing `DocIdGenerator.test.ts` run.
- Popouts are a non-issue for the lock: all plugins execute in the one renderer realm; `globalThis` is shared regardless of focused window.
- typescript-eslint's `no-extraneous-class` may later flag the static-only `DocIdServices` when the lib adopts ESLint (follow-up ticket) — acceptable per house rules favoring static classes over free functions.

## (d) Signal

**PLAN_ITERATION CAN BE SKIPPED.** Proceed to IMPLEMENTATION with the plan as amended inline.

No `#QUESTION_FOR_HUMAN` items — the one wording deviation (facade takes `Vault` vs Q3's "app-taking") is flagged in the plan text for the human's awareness but does not block.
