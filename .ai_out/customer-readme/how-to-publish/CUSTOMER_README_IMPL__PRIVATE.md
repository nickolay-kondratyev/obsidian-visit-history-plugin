# CUSTOMER_README_IMPL — PRIVATE working notes

## Plan
1. [x] Read explore file + current README + dev stubs + docs/README + AGENTS.md dev block
2. [ ] Author self-contained SVG heatmap → images/sample-heatmap.svg (nature gradient, hero look)
3. [ ] Rasterize to images/sample-heatmap.png (only ImageMagick `convert` available; fallback = SVG-only)
4. [ ] Rewrite README.md customer-first (hero + placeholders + sections + verbatim license)
5. [ ] Fold build.sh + hot-reload tip into AGENTS.md dev section (succinct; don't dup existing)
6. [ ] Delete README_ORIGINAL.md + README_DEVELOPMENT.md
7. [ ] Verify: npm run lint (→ .tmp/), SVG well-formed, PNG valid, links resolve
8. [ ] Write PUBLIC output

## Environment facts
- CLAUDE.md -> AGENTS.md symlink; edit AGENTS.md
- Rasterizers: ONLY ImageMagick `/usr/bin/convert` (no rsvg/cairosvg/inkscape/sharp). No xmllint, no PIL.
- AGENTS.md already documents .vh_v3 path, doc-id design, full dev-env npm block. Missing: build.sh + hot-reload.
- Nature gradient: hot #1db954, cold #1a3a7a, nil #1a1a20. bg #1e1e1e surface #262626 text #dcddde muted #999.

## State: DONE
- All steps complete. Image shipped as SVG (no working rasterizer: ImageMagick
  crashes, no rsvg/cairosvg/inkscape/sharp/pip). README references the .svg hero.
- lint exit 0 (2 pre-existing main.ts warnings). SVG well-formed. Links resolve.
- Staged: README.md(M) AGENTS.md(M) README_DEVELOPMENT.md(D) README_ORIGINAL.md(D)
  images/sample-heatmap.svg(A). Not committed (per instructions).
- If resuming: to add a PNG, install rsvg/cairosvg, rasterize at 2x, swap hero ref.
