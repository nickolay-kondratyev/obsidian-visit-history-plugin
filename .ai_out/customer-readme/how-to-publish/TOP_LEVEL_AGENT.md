# TOP_LEVEL_AGENT — customer-readme (change log entry)

Follow-on to how-to-publish. Feature: customer-facing README + technical-notes relocation + generated sample heatmap.

## Flow executed
EXPLORE (current README + heatmap visual spec) → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW (verdict READY, 1 taste should-fix) → ITERATION (recoloured sample tiles to recency gradient) → converged.

## Change log entry (single entry)
**customer-readme: rewrite README for end-users + generate a sample heatmap; relocate dev notes to CLAUDE.md.**
- `README.md` rewritten customer-first: what it does, a **hero sample heatmap** image, "what files it saves" (concise, no on-disk grammar/jargon), a dedicated **"your history survives renames"** section (persistent hidden id in note frontmatter / canvas metadata → history keyed by id, not path), install/enable, customer-level settings, a short dev/publishing pointer, and the KSAL-2.3 license preserved verbatim. Two clearly-marked TODO screenshot placeholders for the user's real screenshots.
- Generated `images/sample-heatmap.svg` (hand-authored from the plugin's exact palette/layout) + rasterized `images/sample-heatmap.png` (headless chromium, 2×) used as the hero.
- Dev/technical notes relocated into `AGENTS.md` (CLAUDE.md symlink) — folded the `build.sh` + hot-reload tip; rest already documented there (kept succinct).
- Deleted stale `README_ORIGINAL.md` (sample-plugin boilerplate) and `README_DEVELOPMENT.md`.

## Commits (on master after the how-to-publish merge)
- `4ef3a2c` — README rewrite + sample heatmap + relocation + stale-file removal.
- `ca7fc18` — recolour sample tiles to recency gradient (review should-fix).

## Callouts
See final console output.
