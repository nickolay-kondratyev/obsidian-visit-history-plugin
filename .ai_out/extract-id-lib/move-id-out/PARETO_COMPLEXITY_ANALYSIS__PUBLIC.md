# PARETO / COMPLEXITY ANALYSIS — extract-id-lib / move-id-out

Analyst: PARETO_COMPLEXITY_ANALYSIS, 2026-07-16. Inputs: CLARIFICATION__PUBLIC.md (binding),
DETAILED_PLANNING__PUBLIC.md, 1_IMPLEMENTATION_FROM_PLAN__PUBLIC.md, IMPLEMENTATION_REVIEW__PUBLIC.md
(READY, 3 minors), plus direct code inspection (commits 9a24c64/2726a18, lib repo at 85d9ed5).

## Pareto Assessment: PROCEED

**Value Delivered:** A second plugin (concrete, per CLARIFICATION Q2 — "other plugin confirmed OK")
can bundle the identical doc-id flow, and the one real race two independent bundles create
(both observe "no id" → both write) is closed by a cross-plugin lock. Plugin src shrank by a net
~1,540 lines (mostly moves); the plugin-side rewire is a 1-line factory call.

**Complexity Cost:** ~135 lines of genuinely NEW production code (lock 77, seam 31, facade 27),
~280 lines of new tests, ~300 lines of one-time lib scaffolding (package/tsconfig/vitest/testSupport
copies), plus permanent submodule workflow overhead (pointer bumps, push-order discipline,
`--recurse-submodules`).

**Ratio:** High. New abstraction count is minimal for a library extraction; every rejected-alternative
analysis in the plan (D1) picked the LOWER-complexity option (raw TS + `file:` dep, no lib build step,
no d.ts artifacts, ESLint deferred).

---

## Per-item verdicts

| Item | Verdict | Rationale (one line) |
|---|---|---|
| Library extraction as git submodule + `file:` dep, raw TS, no build step | **JUSTIFIED** | The goal itself (human-directed); raw-TS/`file:` is the simplest packaging that works with esbuild+tsc+vitest — alternatives (paths aliases, built artifacts) were costlier and correctly rejected in D1. |
| `CrossPluginPathLock` + versioned `window` key + `PathLock` interface | **JUSTIFIED** | CLARIFICATION Q1 KEY REQUIREMENT (non-negotiable); 77 lines solving the actual double-write race between two bundled copies; contract documented + anchor-pointed; interface exists so tests inject a pass-through. |
| Lock as REQUIRED ctor param on `DocIdServiceDefault` (vs optional / decorator) | **JUSTIFIED** | Compile-time guarantee that no consumer accidentally wires the unlocked service — the cheapest possible enforcement of the feature's whole point. |
| `FileContentAccess` seam (2 methods) + `VaultFileContentAccess` | **JUSTIFIED** | Narrowest possible IO boundary (trimmed from the plugin's 4-method `NoteFileUtil`); structural compatibility let existing plugin fakes/tests pass through unchanged — the seam PAID for itself in avoided test churn. |
| `DocIdServices.createDefault(vault)` static facade | **JUSTIFIED** | 27 lines; turned 6 lines of PluginFactory wiring into 1; Q3 asked for it ("thin facade"); `Vault` narrowing over literal `App` is the simpler surface (flagged transparently, NIT-level). |
| Lib-own vitest/tsconfig/mock/package-lock (standalone test rig) | **JUSTIFIED** | "Tests must always run" must hold in the lib repo standalone (it has its own history/remote); ~300 one-time lines; the copied `obsidianMock`/`fileFactory` (~50 lines) is accepted duplication — sharing test infra across two repos would cost more than it saves. |
| Extra test helpers (`ContentSwappingFileContentAccess`, AC-B7 backstop tests) | **JUSTIFIED** | The in-transform re-check is a CLARIFICATION non-negotiable that previously had ZERO direct coverage — this closed a real gap, not padding. |
| Three concurrency layers total: `InFlightDropGuard` (plugin) + path lock (lib) + in-transform re-check (stores) | **JUSTIFIED — at the ceiling** | Each covers a distinct scenario (same-plugin focus storms / cross-plugin queueing / non-lib third writers) and two of three are binding decisions; but this is the maximum defensible layer count — any FOURTH serialization mechanism in this area should be rejected. |
| Docs: README contracts + 2 anchor points + design-brief/CLAUDE.md updates | **JUSTIFIED** | The window key and id format ARE public cross-plugin API; undocumented they would be the #1 future-breakage source. |

**UNJUSTIFIED items found: none.** No dead code shipped in the lib; no speculative
config knobs (single hardcoded key, no options objects, no plugin-count generality beyond
what the window Map inherently gives).

## Accidental complexity / residue found (small, follow-up material)

1. **`NoteFileUtil.process()` is now production-dead in the plugin** — its only prod callers
   (the docId stores) moved to the lib; remaining use is tests passing `FakeNoteFileUtil`
   structurally as `FileContentAccess` (`src/core/util/file/note/NoteFileUtil.ts:23`).
   Follow-up: trim it (and note `createNote`/`appendLineToNote` also appear to have no prod
   callers — pre-existing, same cleanup ticket).
2. **Reviewer MINOR-2 stands**: follow-ups (lib ESLint, canvas `ensureId` return asymmetry)
   exist only in reports, not as `docs/tickets/` files. House rule says materialize them.
3. **Same-realm assumption is implicit**: `getOrCreateRegistry` uses `instanceof Map`; a foreign
   copy from a different JS realm (or a corrupted non-Map value under the key) would fail the check
   and be silently REPLACED by a fresh Map, silently disabling cross-plugin exclusion. In Obsidian
   today all plugins share the renderer realm, so this is theoretical — but it belongs as one line
   in the README's compatibility contract ("same-realm; key must hold a Map or it is reclaimed").
   Under-engineering, severity LOW, not blocking.

## Under-engineering check on the cross-plugin contract — PASS

- Window key: versioned, exported const, protocol fully specified (never-rejecting tail,
  predecessor-swallow, `=== next` cleanup), anchor-pointed, covered by a two-instance
  rendezvous test and foreign-tail tolerance tests. Sound.
- Id format: `docid_{24 base36 lowercase}_e` documented + anchor-pointed; existing ids of any
  format honored (so the two plugins cannot fight over rewrites). Sound.
- Lock keys by `file.path`: rename-mid-flight semantics unchanged from before the extraction —
  no regression, and the re-check backstop covers the residual window.
- Only gap: the realm note above (item 3).

## Recommendation

- **Proceed as-is; nothing blocking.** Complexity is at or near the minimum for the mandated goal.
- Follow-ups (tickets, no code change now):
  1. `docs/tickets/`: lib ESLint + canvas `ensureId` return-value alignment (= reviewer MINOR-2).
  2. `docs/tickets/`: trim production-dead `NoteFileUtil` methods (`process`, and audit
     `createNote`/`appendLineToNote`).
  3. Lib README: add one line on the same-realm / non-Map-value assumption of the registry key.
  4. Guard the layer count: document (or just remember) that DropGuard + PathLock + re-check is
     the ceiling — reject future additional serialization in the doc-id path.
