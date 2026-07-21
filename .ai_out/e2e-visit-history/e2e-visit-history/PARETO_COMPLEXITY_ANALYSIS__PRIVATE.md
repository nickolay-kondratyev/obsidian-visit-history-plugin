# PARETO_COMPLEXITY_ANALYSIS — working notes (PRIVATE)

## What I read
- IMPLEMENTATION / DETAILED_PLANNING / CLARIFICATION docs
- All e2e/: obsidianHarness.ts (266), vhAssert.ts (91), constants.ts (37), harnessFixture.ts
  (27), playwright.config.ts (18), tsconfig, setupDevVault.mjs (37), 5 specs (30-40 each)
- scripts/setup-obsidian-bin.sh (69), scripts/run-e2e.sh (25)
- .dev-vault seed (tiny)

## Size sanity
Whole e2e layer ≈ 660 LOC + ~94 LOC shell + tiny seed vault. For a "drive real Electron
Obsidian headless over CDP and assert on disk" capability, that is LEAN. No plugin `src/`
runtime changes. Zero test-only seams added to product code (asserts on real .vh_v3 files).

## Right 80/20?
YES. The plugin's entire reason to exist is capturing REAL Obsidian focus/blur/idle/canvas/
unload events and writing session logs. That seam is precisely what mock-based unit tests
(386 of them) CANNOT cover. A cheaper substitute (more unit tests, jsdom, Obsidian API
fakes) would re-assert the mock, not the integration. So real-Obsidian is the only thing
that delivers the unique confidence here — the complexity buys something nothing else can.

CDP-over-stderr (vs `_electron.launch`) is justified: plan documents `_electron.launch` hangs
on the fused build. localStorage-before-enable to bypass the user-name modal is the elegant
determinism trick — avoids leveldb seeding / modal-dismiss races. Good.

## Over-engineering candidates (all minor)
1. Run-dir cleanup (Iteration 1): detached process-group SIGKILL + waitForChildExit + guarded
   best-effort rmSync (~40 LOC) to reclaim 360K gitignored .tmp dirs. Borderline vs 80/20 —
   the dirs are ephemeral/gitignored. BUT: contained, best-effort (never fails a test),
   path-guarded, well-commented, and prevents unbounded accumulation across many local runs.
   Net: acceptable, not worth reverting.
2. Nothing else stands out. firstPage poll, readDevtoolsEndpoint, killProcessTree are all
   necessary boundary mechanics, minimal.

## Under-testing / gaps (all correctly ticketed, none blocking)
- SIGKILL hard-quit last-session loss: documented limitation, not asserted. Correct (would be
  flaky).
- 10s grace-timer EXPIRY + same-doc-refocus-within-grace cancel: subtle real behavior per
  CLAUDE.md, covered by NONE of the 5 scenarios. Ticketed. Legit follow-up, out of asked scope.
- Popout windows (WindowActivityMonitor — "first-class" per CLAUDE.md): high-value real
  behavior, not e2e-covered. Harder headless. Reasonable to defer/ticket.
- S3 asserts current behavior (Settings doesn't end session) + raises product question. Honest.

## Maintenance burden vs confidence
Proportionate. Pinned 1.12.7 (deliberate, bump-on-purpose). Bounded polling everywhere
(never fixed sleeps masking async appends); the only fixed sleeps are legit (1s dwell for
measurable duration; 1s/2s bounded ABSENCE checks with WHY comments). workers:1 serial +
generous timeouts = flake-resistant. Durations asserted as bounded ranges + line count, not
exact ms. This is textbook flake discipline.

## Verdict
JUSTIFIED-WITH-NITS. Complexity is largely inherent to headless Electron driving and is
proportionate to the unique end-to-end confidence gained. Nits are trivial and already
ticketed. Recommend ship as-is.
