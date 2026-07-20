# CUSTOMER_README_IMPL — result

Branch: `how-to-publish`. Changes staged, NOT committed.

## Plan (executed)
Customer-first README rewrite + relocate dev notes to CLAUDE.md/AGENTS.md +
delete stale readmes + author a self-contained sample heatmap image.

## Files changed / created / deleted
| File | Action | Why |
|---|---|---|
| `README.md` | rewritten | Customer/end-user-first: hero image, what-it-does, "history survives renames", where-data-is-saved (no path grammar/V3 jargon), install/enable, settings, dev pointer, verbatim license |
| `images/sample-heatmap.svg` | created | Hand-authored standalone SVG treemap heatmap (nature green→blue recency gradient), used as the README hero |
| `AGENTS.md` (real target of `CLAUDE.md` symlink) | edited | Added succinct `build.sh` + hot-reload dev tip (folded from README_DEVELOPMENT.md) to the Dev environment block |
| `README_DEVELOPMENT.md` | deleted (`git rm`) | 2-line stub; useful bit folded into AGENTS.md |
| `README_ORIGINAL.md` | deleted (`git rm`) | Stock Obsidian sample-plugin boilerplate; superseded by docs/how-to-publish.md |

## Relocated to CLAUDE.md/AGENTS.md
Only `build.sh` + hot-reload tip were ADDED — AGENTS.md already documented the
exact `.vh_v3` path grammar, doc-id design, legacy migrations, and the full
npm dev-env block. Deliberately did NOT duplicate that stable knowledge (per
CLAUDE.md succinctness rule). The path grammar / "V3" / "vh_v3" jargon that left
the README already lives in AGENTS.md + `docs/visit-history-format.md`.

## How the image was generated (IMPORTANT — shipped format = SVG, no PNG)
- Requested rasterizer order was tried; NONE worked in this environment:
  - `rsvg-convert`, `inkscape`, `sharp`, `cairosvg` — all absent.
  - ImageMagick `convert` IS present but its built-in SVG renderer **core-dumps**
    (its `svg` delegate points at the absent `rsvg-convert`).
  - No `pip`/`python3 -m pip` available to install `cairosvg`.
- Per the instructed fallback: **committed the `.svg` and reference it in the
  README** (`![...](images/sample-heatmap.svg)`). GitHub renders sanitized SVG
  `<img>` embeds, and the SVG is script/foreignObject/external-ref free with all
  colours as literal hex, so it will display.
- The SVG matches the real plugin's exact palette from the explore file: nature
  gradient hot `#1db954` → cold `#1a3a7a`, no-data `#1a1a20`; type accents md
  `#4a5ed4`/canvas `#be7220`/excalidraw `#1e9e8e` used on a couple of leaves;
  depth-tinted folder chrome (precomputed color-mix → `#282828`/`#2d2d2d`),
  uppercase monospace faint folder labels, white leaf labels with dark halo
  (`paint-order:stroke`), 42px header bar with title + new→gradient→old legend +
  no-data pip, `#1e1e1e` background. Realistic vault (Projects/web-app, Daily
  journal, Areas, Archive, Resources).

## Placeholder screenshot slots (separate from the hero)
Two markdown image slots in "What it does", each preceded by
`<!-- TODO: replace with a real screenshot -->` and captioned, pointing at
not-yet-existing paths for the owner's real screenshots:
- `images/heatmap-by-recency.png`
- `images/heatmap-config-panel.png`

## Verify status
- `npm run lint` → **exit 0** (0 errors; 2 PRE-EXISTING warnings in `src/main.ts`,
  untouched by this change). Log: `.tmp/lint.log`.
- SVG well-formed: `python3` minidom parse → `WELLFORMED_OK` (no xmllint present).
- README relative links resolve: `images/sample-heatmap.svg`, `docs/README.md`,
  `docs/how-to-publish.md`, `LICENSE.md` all exist (TODO placeholder image paths
  intentionally absent). No links to deleted `README_ORIGINAL.md`/`README_DEVELOPMENT.md`.

## Scrutiny points for reviewer
1. **SVG-not-PNG**: hero is an SVG (rasterizer unavailable). If a PNG is desired,
   run e.g. `rsvg-convert -z 2 images/sample-heatmap.svg -o images/sample-heatmap.png`
   on a machine with rsvg/cairosvg and switch the hero reference to `.png`.
2. **BRAT link** added under Installing as an interim manual-install option — confirm
   that's acceptable messaging pre-listing.
3. **User-name prompt** sentence under Installing — verify it matches current UX
   (confirmation modal on first note open / layout ready).
4. **License block** copied verbatim from the explore file's preserved section —
   diff against prior README lines 60-83 to confirm byte-identical wording.
5. AGENTS.md addition is intentionally minimal — confirm no over-documentation.
