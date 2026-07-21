# CLARIFICATION__PUBLIC — Assumptions & Scope

The task + reference blueprint are specific enough to proceed with documented defaults
(Pareto: don't block the human on choices with an obvious default). If the human disagrees
with any assumption below, redirect and we adjust.

## Requirements (from human, verbatim scope)
Create an e2e setup using **real Obsidian** and add core e2e tests for **visit-history
recording**, covering at least:
1. Switching focus (between documents)
2. Closing Obsidian (unload flush)
3. Switching to Settings
4. Focus in a canvas
5. Unfocusing on idle — **with the idle setting lowered** so we don't wait the default 180s.

## Assumptions / decisions (defaults chosen)
| # | Decision | Default taken | Rationale |
|---|----------|---------------|-----------|
| A1 | Deliverable shape | Portable scripts + `e2e/` harness + Playwright config + tests, exactly per the reference blueprint. These already "work in Docker". | Blueprint is the sanctioned pattern; 80/20. |
| A2 | Full Dockerfile / docker-compose | NOT built as a hard deliverable. A short doc note on the named-volume cache mount is enough. | Portable scripts are the value; a bespoke Dockerfile is the extra 20% and env-specific. Revisit if human wants CI. |
| A3 | CI workflow (.github) | NOT added by default (optional stretch). | CI wiring is separate from "create e2e + core test"; avoid scope creep. Ticket it as follow-up. |
| A4 | Determinism strategy | Pin identity via localStorage (`obsidian-vh-user-name=e2e_user`, `obsidian-device-name=e2e_device`) + pre-seeded doc ids + `data.json idleTimeoutSeconds=5`; assert on the on-disk `.vh_v3` files. | Deterministic, avoids private internals, matches exploration. |
| A5 | Idle test speed | Set `idleTimeoutSeconds=5` (the enforced floor) for the idle scenario. | Human explicitly asked to make idle fast; 5s is the min allowed. |
| A6 | Obsidian version | Pin `1.12.7` per blueprint (auto-download, cached under `.tmp/obsidian/`). | Floating latest breaks e2e silently. |
| A7 | Must it run in THIS sandbox? | We WILL attempt to make `npm run test:e2e` actually pass here. If a hard environmental blocker (no headless Electron / no network for download) appears, we STOP and report per protocol rather than fake a pass. | EARN_TRUST: never fake passing tests. |

## Non-goals
- Rewriting/altering plugin runtime behavior (e2e is additive; only test-support seams if unavoidable, flagged).
- Testing legacy v1/v2 formats or the heatmap view (out of scope for "recording").
- Mobile.

## Open items (surfaced, non-blocking)
- Feasibility of headless real-Obsidian in this container is unproven → planner MUST make an
  early "launch Obsidian headless + attach CDP" smoke milestone the first gate.
