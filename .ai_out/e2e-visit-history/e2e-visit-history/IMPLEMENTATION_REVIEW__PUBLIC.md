# IMPLEMENTATION_REVIEW__PUBLIC — Real-Obsidian e2e for Visit History

## Verdict: APPROVE-WITH-MINOR

Solid, honest, non-hollow work. All 5 required scenarios are genuinely exercised against a
real headless Obsidian and assert on the on-disk `.vh_v3` files the plugin actually writes.
No plugin runtime code was changed. No CRITICAL or MAJOR issues. A few low-priority
suggestions only.

## Suites re-run by the reviewer (evidence, not claimed)
- `npm test` → **386 passed** (39 files). Independently re-run.
- `npm run test:e2e` → **5 passed (17.1s)**. Independently re-run against the cached
  Obsidian 1.12.7 binary. Per-spec times: S4 1.9s, S2 1.9s, S1 2.9s, S5 **6.0s** (proves the
  5s idle path really fired in wall-clock, not a stub), S3 4.0s.
- No `src/` runtime files in the commit (`git show HEAD --stat`) — "no seams added" verified.

## Requirement coverage (all 5 genuinely tested)
| # | Scenario | Genuinely proves recording? |
|---|----------|-----------------------------|
| S1 | focus switch A→B | Yes. Bounded poll for A's `.vh_v3`; asserts exactly 1 line + `0≤D<60000`; B has no line. If recording broke, poll times out → fail. |
| S2 | close / unload flush | Yes, via the **graceful** `disablePlugin` → `onunload` → `factory.dispose()` → `focusDurationTracker.dispose()` → `finalizePendingClose()`. Verified that path really flushes an open session. |
| S3 | switch to Settings | Yes (behavior-capturing). Asserts Settings alone records nothing, then the later A→B switch DOES close A (bounded poll). Still requires real recording to pass. |
| S4 | canvas focus | Yes. Proves `CanvasDocIdStore` reads `metadata.frontmatter.id` — line lands under the seeded canvas id path. |
| S5 | idle (fast) | Yes. `idleTimeoutSeconds=5` written to per-test `data.json`; asserts `D<5000` (idle tail not counted) AND `elapsedMs<9000` (idle path, not the 10s grace). |

Verified `e2e/constants.ts` against source — all in sync:
`obsidian-vh-user-name`/`obsidian-device-name` (UserNameProvider/DeviceNameProvider),
`SESSION_LINE_RE` vs `VhV3SessionLineParser` `/^(\S+) D:(\d+)$/`, seeded doc ids in
`.dev-vault/{A.md,B.md,C.canvas}`, `__visit_history` path layout, `UNFOCUS_GRACE_MS=10_000`.

## No fake/hollow tests (the key check) — PASS
- `pollForSessionLine` is bounded and **throws with last-seen content on timeout** — an
  absent/malformed write fails loudly. `sessionLines` filters by the strict regex, so a
  garbage line yields 0 matches → timeout → fail. No assertion is a no-op; no try/catch
  swallows a failure; no over-broad polling that always resolves.
- Every spec's terminal assertion depends on a real append; if recording were broken, each
  spec fails (S3 included — its final A→B close poll would time out).

## Determinism / flakiness — acceptable
- Serial (`workers:1`, `fullyParallel:false`), fresh vault copy + fresh `--user-data-dir`
  per launch → isolated localStorage, no cross-test bleed. Identity pinned BEFORE
  `enablePlugin` (pin runs in `onLayoutReady`, which fires on enable) — correct ordering.
- Duration bounds are generous but still meaningful; idle `elapsedMs<9000` cleanly separates
  the idle path from the 10s grace path. No bare sleeps standing in for the append.

## Robustness of harness/scripts — good
- `setup-obsidian-bin.sh`: stdout = path only, logs → stderr, download-once cache, arch
  switch, corrected tarball layout, `curl --fail --retry 3`, post-extract executable check.
- `run-e2e.sh`: honors caller `OBSIDIAN_PATH`/`OBSIDIAN_E2E_EXTRA_ARGS`, injects Ozone
  headless flags only when no display, typechecks specs before running.
- Only `.dev-vault` (committed seed) is copied — the human's real vault is never touched.

---

## Minor / Suggestions (none blocking)

1. **Run-dir cleanup (disk hygiene).** `ObsidianHarness.close()`
   (`e2e/obsidianHarness.ts:150`) closes the browser + SIGKILLs the child but never
   `rmSync`s the per-launch `runDir` under `.tmp/e2e/<runId>`. Dirs accumulate across runs.
   `.tmp` is gitignored/ephemeral so low impact; consider removing the runDir on success
   (keep on failure for debugging) or documenting the retention as intentional.

2. **Test-lifecycle duplication (DRY, systematic).** The `let h`, `beforeEach launch`,
   `afterEach close`, and `HIGH_IDLE_SECONDS = 180` block is copy-pasted verbatim across
   `focusSwitch`/`closeUnloadFlush`/`switchToSettings`/`canvasFocus` (4 files). A tiny shared
   fixture/helper (e.g. `withHarness(idleSeconds)`) would remove it. Counter-point:
   self-contained specs aid readability; low priority.

3. **"Close Obsidian" is a flush proxy, not a process quit.** S2 exercises the graceful
   `onunload` flush, not an actual window/process close (SIGKILL loses the last append —
   documented + ticketed `e2e-optional-flush-test-seam.md`). The requirement is met via the
   deterministic flush path; just flagging the literal-close gap is intentional and explicit.

4. **`SESSION_LINE_RE` `m` flag is unnecessary** (`e2e/constants.ts:35`) — it's applied with
   `.test()` on individually-split, trimmed single lines, so `m`/`^$` multiline semantics do
   nothing. Harmless; drop for clarity. Nit.

5. **S1 AC1.3 absence check uses a fixed 1s sleep** (`focusSwitch.e2e.ts:39`) — a
   pathologically slow write could mask a regression where B closes early. Low risk (nothing
   switches away from B) and consistent with the observed ~1s append budget. Acceptable.

## Documentation
`docs/e2e-testing.md`, `docs/README.md`, `AGENTS.md`/CLAUDE.md dev section, and the
sync-pointer comment in `e2e/constants.ts` are accurate and match the code. Follow-up
tickets (CI workflow, Dockerfile, grace-expiry spec, flush seam, Settings product question)
are filed under `_tickets/`. No further doc updates required.
