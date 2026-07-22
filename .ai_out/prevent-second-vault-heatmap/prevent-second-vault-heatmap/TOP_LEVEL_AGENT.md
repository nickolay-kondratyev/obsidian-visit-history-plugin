# TOP_LEVEL_AGENT — prevent-second-vault-heatmap

Ticket: _tickets/plan-prevent-opening-a-second-vault-level-heatmap-when-one-is-already-at-vault-root.md
Branch: prevent-second-vault-heatmap

## Flow status
- [x] EXPLORATION — Explore agent (couldn't write file; TOP persisted EXPLORATION_PUBLIC.md)
- [x] CLARIFICATION — N/A: owner locked all decisions in ticket notes (reveal silently, callback flag bridge, vault-level only, first-found on multiples, popouts covered)
- [x] IMPLEMENTATION_WITH_SELF_PLAN — done; committed (HEAD~1..). Files: VaultRootHeatmapFinder.ts(+test), App.tsx, VaultTreemapView.tsx, main.ts, manifest.json. Build/Test/Lint PASS.
- [~] IMPLEMENTATION_REVIEW — running (agent aa5e7225dc5287b53)
- [ ] IMPLEMENTATION_ITERATION — pending review outcome

## Callouts to carry to human
1. minAppVersion bumped 1.5.7 -> 1.7.2. CONFIRMED root cause: obsidianmd `noUnsupportedApi` rule flags `revealLeaf` (return type became Promise<void> in 1.7.2). Owner locked revealLeaf. Recommendation: ACCEPT bump (1.7.2 = late 2024; current Obsidian 1.13.1; negligible impact). Reversible. versions.json left for release step.

## Commits
- feat(heatmap): prevent second vault-root heatmap; reveal existing instead
