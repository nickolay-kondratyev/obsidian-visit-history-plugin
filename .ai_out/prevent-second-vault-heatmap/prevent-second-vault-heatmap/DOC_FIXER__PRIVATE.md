# DOC_FIXER — private notes

## Gotcha
- `CLAUDE.md` at repo root is a SYMLINK to `AGENTS.md`. Editing `CLAUDE.md` directly is refused ("Refusing to write through symlink"). Edit `AGENTS.md` instead — `readlink -f CLAUDE.md` → `AGENTS.md`.

## Placement rationale
- Architecture-tree entry placed right under `VaultTreemapView.tsx` (same `view/` group).
- Design bullet placed right after the "VaultTreemapView is the only obsidian import" bullet — closest topical anchor (view boundary / nav behavior).
- Kept both additions to one line each in spirit; SUCCINCT, stable behavior not volatile detail.

## Deliberately excluded
- No `manifest.json`/`versions.json`/changelog (TOP_LEVEL_AGENT owns; minAppVersion 1.7.2 bump is a source/manifest concern).
- No mention of `HeatmapLeafCandidate<L>` generic or test counts — volatile/implementation detail, belongs in code.
