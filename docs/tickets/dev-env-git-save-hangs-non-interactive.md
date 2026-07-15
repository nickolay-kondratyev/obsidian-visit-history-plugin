# dev-env: `_git.save` hangs in non-interactive shells

## Problem
`_git.save "<msg>"` prompts `y/n` via `/dev/tty` (`glassthought-bash-env/modules/5_cli_input.sh:44`).
In non-interactive environments (agent shells, CI) `/dev/tty` does not exist → the prompt loops
forever ("Please answer y or n." / `No such device or address`) and the command hangs until timeout.

## Impact
Agent flows instructed to use `_git.save` stall for the full command timeout (2 min) and must fall
back to plain `git add && git commit`.

## Proposed fix
In `_git.save` (or the shared `5_cli_input.sh` prompt helper): detect non-interactive stdin/tty
(`[ -t 0 ]` / `/dev/tty` unavailable) and either auto-confirm or fail fast with a clear message
(prefer an explicit `--yes` / `GT_ASSUME_YES=1` escape hatch over silent auto-confirm).

## Notes
- Observed 2026-07-15 during the heatmap-filter-ui orchestration flow.
- Lives in the glassthought-bash-env repo, not this plugin repo — this ticket is a pointer.
