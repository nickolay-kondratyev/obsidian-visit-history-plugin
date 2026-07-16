# TOP_LEVEL_AGENT — fix-canvas-unfocus

Branch: `fix-unfocus-due-to-rectangle-choice`
Feature dir: `.ai_out/fix-canvas-unfocus/fix-unfocus-due-to-rectangle-choice/`

## Task (from human, ask.dnc.md)
While in a canvas view, pressing the card labels (to add a new rectangle/note to the
canvas) causes the visit-history plugin to see an UNFOCUS of the canvas, then a re-FOCUS
when the note is placed. Result: the duration session is split / interrupted even though
the user never left the canvas. Fix: duration should remain in the same canvas in such cases.
Human offered to give their approach if we don't have a solid one → CLARIFICATION phase
must present our approach (or lack of one) to the human.

## Workflow status
- [x] EXPLORATION — done → EXPLORATION_PUBLIC.md
- [x] CLARIFICATION — done → CLARIFICATION__PUBLIC.md (grace-period approach approved; 10 s constant; >grace gaps still split)
- [ ] DETAILED_PLANNING (PLANNER, THINK_HARD) — in progress
- [ ] DETAILED_PLAN_REVIEW (PLAN_REVIEWER)
- [ ] PLAN_ITERATION
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS
- [ ] Final change-log entry (single, by TOP_LEVEL_AGENT) + tickets

## Notes
- All sub-agents: run_in_background=true, write ${ROLE}__PUBLIC.md before exit.
- Code-modifying agents run SERIALLY.
- Git commits between phases via `_git.save`.
