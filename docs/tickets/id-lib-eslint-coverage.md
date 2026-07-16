# obsidian-id-lib has no ESLint in v1

**Status**: OPEN (follow-up from `extract-id-lib`, 2026-07-16)

## Context
The plugin's `eslint .` ignores `submodules/` (deliberate v1 scope cut — plan §8).
The lib repo has `tsc --noEmit` + vitest but no lint step, so obsidianmd/style rules
are not enforced on lib code.

## Task
Add ESLint to `submodules/obsidian-id-lib` (own config; obsidianmd rules where
applicable) and wire a `lint` script; optionally surface it from the plugin root
alongside `test:lib`.
