# TOP_LEVEL_AGENT — e2e-visit-history orchestration tracker

Feature: `e2e-visit-history` | Branch: `e2e-visit-history`

## Task
Add real-Obsidian Playwright e2e setup + core e2e tests for visit-history recording
(focus switch, close/unload, switch-to-settings, canvas focus, idle w/ fast setting).

## Workflow progress
- [x] EXPLORATION — Explore A (internals) + Explore B (infra) → persisted A/B/combined PUBLIC.
- [x] CLARIFICATION — assumptions documented, proceeding with defaults (no human block).
- [x] DETAILED_PLANNING (PLANNER) — 4 milestones; M1 = headless feasibility spike (hard gate). Env pre-checked plausible.
- [x] DETAILED_PLAN_REVIEW (PLAN_REVIEWER) — APPROVE-WITH-MINOR-INLINE-FIXES (0 Critical, 1 Major fixed inline). Settings-modal Q: planner default sound.
- [x] PLAN_ITERATION — SKIPPED (reviewer made minor inline fixes; converged).
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS

## Key decisions
- Deliverable = portable scripts + e2e harness + tests (blueprint pattern). No hard Dockerfile/CI (ticket).
- Determinism via localStorage pins + seeded doc ids + data.json idleTimeoutSeconds=5; assert on-disk .vh_v3.
- Attempt real run in this sandbox; STOP if hard env blocker (never fake a pass).

## Commits
- (pending) exploration + clarification artifacts
