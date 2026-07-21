# Pareto Assessment: JUSTIFIED-WITH-NITS

**Value Delivered:** End-to-end proof that the plugin records real Obsidian focus sessions
(focus switch, unload flush, settings modal, canvas, idle) to real `.vh_v3` files — the one
seam that 386 mock-based unit tests structurally cannot cover.

**Complexity Cost:** ~660 LOC `e2e/` + ~94 LOC shell + a tiny committed seed vault. Real
headless Obsidian (Electron) launched via pinned tarball, driven over CDP, asserted on disk.
Zero plugin runtime changes; zero test-only seams in `src/`.

**Ratio:** High (value strongly exceeds complexity).

---

## Why the approach is the right 80/20

- The plugin exists to capture REAL Obsidian focus/blur/idle/canvas/unload events and write
  session logs. That integration is exactly what unit tests can't exercise — a cheaper
  substitute (more fakes/jsdom) would re-assert the mock, not the behavior. Real-Obsidian is
  the only thing that buys the unique confidence, so the complexity pays for itself.
- The determinism spine is elegant, not heavy: **localStorage-pinned identity before plugin
  enable** bypasses the user-name modal with no leveldb seeding or dismiss race; seeded doc
  ids make `.vh_v3` filenames known up front; a per-test `data.json` sets the idle floor.
- **Assert-on-disk with bounded polling** (never fixed sleeps masking async appends) plus
  `workers:1`, generous timeouts, and bounded (not exact-ms) duration ranges = strong flake
  discipline. Pinned Obsidian 1.12.7 is deliberate (bump-on-purpose).
- Constants duplicated (with a sync-pointer comment) because `obsidian` is types-only — the
  correct call for node-side code; enforced by a grep in the acceptance criteria.

## Nits (minor, not worth acting on now)

1. **Run-dir cleanup machinery** (Iteration 1): detached process-group SIGKILL +
   `waitForChildExit` + guarded best-effort `rmSync` (~40 LOC) to reclaim ~360K *gitignored,
   ephemeral* `.tmp/e2e/<runId>` dirs. Slightly beyond strict 80/20, but it is path-guarded,
   strictly best-effort (never fails a test), well-commented, and prevents unbounded local
   accumulation. Keep as-is.

## High-value gaps (correctly ticketed, none blocking)

- **10 s grace-timer expiry + same-doc-refocus-within-grace cancel** — subtle real behavior
  (CLAUDE.md) covered by none of the 5 scenarios. Ticketed; out of the asked scope.
- **Popout-window session handoff** (`WindowActivityMonitor`, "first-class" per CLAUDE.md) —
  real behavior, harder headless, not e2e-covered. Reasonable to defer.
- **SIGKILL hard-quit** last-session loss — documented limitation, deliberately not asserted
  (would be flaky). Correct.

## Recommendation

**Ship as-is.** The complexity is inherent to driving headless Electron and is proportionate
to the confidence gained. The one borderline spot (run-dir cleanup) is contained and safe.
The uncovered paths (grace-expiry, popouts) are genuine future value but correctly ticketed
rather than force-fit into this delivery. No simplification worth doing; no gap worth blocking.
