# TOP_LEVEL_AGENT — sonar-004

Task: fix 3 SonarQube MAJOR findings (readonly, redundant type alias, discarded
instantiation). Ticket id: nid_yvbeg8trv72ueqz66q10rcvsf_E.

## Determination (from exploration)
- PluginFactory:130 discarded `new WindowActivityMonitor(...)` is NOT a real bug
  (monitor self-registers via plugin.registerDomEvent). Behaviour-preserving fix only;
  no failing test needed.
- All 3 findings are behaviour-preserving cleanups.

## Flow (straightforward)
1. [DONE] Exploration → EXPLORATION_PUBLIC.md
2. IMPLEMENTATION_WITH_SELF_PLAN (background)
3. IMPLEMENTATION_REVIEWER (background, readonly for code)
4. IMPLEMENTATION_ITERATION if needed
5. TOP commits per phase; final changelog entry; close ticket.

## Git notes
- Pre-existing unrelated change `_tickets/sonar-002-*.md` — keep out of sonar-004 commits.

## Status log
- Exploration complete.
