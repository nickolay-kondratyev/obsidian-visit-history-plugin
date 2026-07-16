# Document lock registry same-realm assumption in id-lib README

**Status**: OPEN (follow-up from `extract-id-lib` Pareto analysis, 2026-07-16)

## Context
`CrossPluginPathLock` validates the value at the window registry key with
`instanceof Map`. A Map created in a FOREIGN realm (different JS context) would fail
that check and be silently replaced, splitting the registry. All Obsidian plugins share
one renderer realm, so this cannot happen today — but it is an undocumented assumption
of the cross-plugin contract.

## Task
Add a one-liner to the lib README's window-key contract section: the registry value
must be created in the shared window's realm (same-realm `Map`).
