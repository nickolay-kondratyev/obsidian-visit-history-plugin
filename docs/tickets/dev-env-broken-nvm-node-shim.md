# Dev env: shell profile shadows node/npx with broken nvm shim

**Status**: OPEN (found during `new-canvas-docid` fix, 2026-07-15)

## Problem
In the non-interactive agent shell, the sourced profile provides `node`/`npx` shims (nvm)
that are broken, so `npm test` / `npm run build` fail unless invoked as `/usr/local/bin/npm`.
Also `_git.save` prompts on `/dev/tty` (unavailable non-interactively) and hangs.

## Impact
Agents/CI-like runs must work around with absolute paths; violates "tests must always run"
dev-environment expectation.

## Fix ideas
- Guard the nvm shim setup with a `[ -t 0 ]` / interactivity check, or fix the shim path.
- Give `_git.save` a non-interactive mode (env flag or auto-yes when no tty).
