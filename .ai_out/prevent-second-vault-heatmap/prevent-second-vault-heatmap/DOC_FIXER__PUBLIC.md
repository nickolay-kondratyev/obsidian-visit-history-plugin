# DOC_FIXER — Prevent second vault-level heatmap

Documentation-only updates for the vault-level-open dedupe-reveal guard. No source/test/manifest changes.

## Files changed

### `AGENTS.md` (target of the `CLAUDE.md` symlink)
`CLAUDE.md` resolves to `AGENTS.md`; edited the real target.

1. `src/` architecture tree — added `VaultRootHeatmapFinder.ts` under `view/` (after `VaultTreemapView.tsx`):

```
    VaultRootHeatmapFinder.ts  # Pure (obsidian-free) selector: first vault-level
                            # leaf at vault root, for the dedupe-reveal guard
```

2. Heatmap "Key design decisions" list — new bullet after the **VaultTreemapView** bullet:

```
- **Vault-level open dedupes-then-reveals**: a command/ribbon `open-vault-heatmap` REVEALS an existing vault-level view that is CURRENTLY at vault root (silent `revealLeaf`, first-found on multiples) instead of duplicating; a drilled-in vault view or any folder-targeted open still opens fresh. `App` reports at-root via `onAtVaultRootChange` → `VaultTreemapView.isAtVaultRoot()`; pure obsidian-free `VaultRootHeatmapFinder` picks the leaf.
```

### `docs/heatmap-view.md`
Added a short note after the open-methods sentence (lines 3-6):

```
A vault-level open (command / ribbon) that finds an existing vault-level
heatmap CURRENTLY at the vault root reveals it silently instead of
duplicating (`VaultRootHeatmapFinder` + `VaultTreemapView.isAtVaultRoot()`);
a drilled-in vault view or any folder-targeted view never blocks a fresh
open.
```

## Not touched
- `manifest.json` / `versions.json` / changelog — owned by TOP_LEVEL_AGENT.
- No source or test edits.

## Validation
Markdown structure preserved (list/code-fence context intact); no build/test run per task.
