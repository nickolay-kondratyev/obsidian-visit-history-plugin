# EXPLORE: README rewrite + heatmap sample — findings

_(Captured by TOP_LEVEL_AGENT from the read-only Explore sub-agent.)_

## A. Current README.md (83 lines) — customer vs technical split
| Lines | Section | Audience |
|---|---|---|
| 1-5 | H1 + tagline + "fully offline/local" | CUSTOMER |
| 7-17 | Features → Visit history recording (exact `.vh_v3` path, V3 label, legacy migration, "generated README") | MIXED — customer gist buried in internals |
| 19-27 | Vault heatmap (treemap, size=file size, color=activity, modes, gradients, nav, config) | CUSTOMER (near-ready) |
| 28-32 | "Hidden feature: _archive folders" | CUSTOMER-ish |
| 34-41 | Install → Build the plugin (git clone --recurse-submodules, npm install/build) | TECHNICAL (dev workflow, NOT how users install) |
| 43-44 | Enable the plugin: `Settings → Community plugins → enable **Visit History**` | CUSTOMER |
| 46-52 | Settings (idle timeout, backfill ids, heatmap auto-persist) | CUSTOMER |
| 54-57 | More docs (links to docs/, README_DEVELOPMENT.md, README_ORIGINAL.md) | TECHNICAL |
| 60-83 | License (KSAL-2.3 summary) | LEGAL — preserve verbatim |

**Relocate to CLAUDE.md (technical):** exact on-disk path grammar; "V3"/legacy v2/V1 jargon; "generated README" internal detail; git-clone+npm build install steps (CLAUDE.md:11-22 already has canonical dev-env block); dev-doc links.
**Stale files:** `README_DEVELOPMENT.md` (3-line personal stub: build.sh + hot-reload) and `README_ORIGINAL.md` (stock Obsidian sample-plugin boilerplate, inaccurate) — fold anything useful into CLAUDE.md, drop the rest. NOTE: `CLAUDE.md` is a **symlink to `AGENTS.md`** — edit the real file.

**License section to preserve VERBATIM (README.md:60-83):**
```
### License

This project is source-available under the Kondratyev Source Available
License 2.3 (KSAL-2.3). In short:

- **You can** use, modify, fork, and redistribute the code for free for
  personal, educational, research, and other noncommercial purposes.
- **Individual creators** — including freelancers, sole proprietors, and
  single-person LLCs — may commercialize anything they *create with* the
  software (sites, content, client deliverables), but not the software
  itself.
- **You cannot** otherwise use it for commercial purposes — including
  company/business use, selling products built on it, or offering it as
  a hosted service — without a paid license.
- A one-time 30-day commercial evaluation is permitted to decide whether
  to purchase.
- Paid functionality behind a license key is not covered by this grant
  and requires a subscription.
- Do not bypass or tamper with license key / subscription checks.
- Contributions you submit are licensed to the author for any use.

This summary is informational only and is not the license. The full text
in [LICENSE.md](LICENSE.md) is the sole and final authority on your
rights and obligations.
```

## B. Customer-language source material
- **Recording:** times how long each note/canvas/Excalidraw drawing is focused; on navigate-away/blur/idle the session (start + duration) is saved **locally in your vault**, in a `__visit_history/` folder, organized per-user (multi-person synced vaults stay separate) and per-device (no sync conflicts). Fully offline, no telemetry.
- **Persistent doc id survives renames (KEY selling point):** on first focus the plugin assigns each file a persistent id (note frontmatter `id`, or canvas metadata). The history filename IS that id, not the path — so **renaming/moving/refactoring a note never loses its visit history.**
- **Heatmap:** whole vault as a zoomable **treemap** (nested rectangles; folders contain files). **Cell size = file size** (per-type weighted). **Color = activity**, two modes: *By type* (md/canvas/excalidraw fixed colors) or *Heatmap* (recency of created/modified/**visited** timestamp; "visited" = your own recorded usage). 3 gradient presets. Drill-down (click folder to zoom, back to walk up, click file to open), pan/zoom, include-only filters (by path or file content). `_archive` folders hidden unless scoped into. Config panel (gear) persists across restarts.

## C. Heatmap VISUAL design (for authoring an authentic sample SVG) — EXACT values
### Type palette (ColorMode 'type'), src/view/constants.ts:12-31
| type | fill | hover | badge | fg |
|---|---|---|---|---|
| md | `#4a5ed4` | `#6070e8` | `#3248b0` | `#a0b0ff` |
| canvas | `#be7220` | `#d48832` | `#9a5a10` | `#f0c070` |
| excalidraw | `#1e9e8e` | `#2cb4a2` | `#14786c` | `#70d4c8` |
Unknown fallback fill `#555` / hover `#777`.

### Heatmap gradients (ColorMode 'heatmap'), constants.ts:46-68
| key | label | hot (new) | cold (old) | nil (no data) |
|---|---|---|---|---|
| nature | green→blue | `#1db954` | `#1a3a7a` | `#1a1a20` |
| ember | red→ice | `#e84020` | `#0a1e58` | `#111118` |
| mono | white→black | `#d8d8d8` | `#1c1c1c` | `#6d28d9` (purple off-scale = no-data) |
HeatField union: `createdAt|lastModifiedAt|lastVisitedAt` → labels "created"/"modified"/"visited".

### Color logic (src/view/utils.ts:15-54)
- Color = **recency** of chosen timestamp (NOT count/duration). `heatColor`: null→nil; age≤hotDays→hot; age≥coldDays→cold; else linear RGB interp (d3 interpolateRgb) hot→cold. Defaults hot=7d, cold=180d.
- Leaf opacity: heatmap null→0.55, else 0.88; type mode flat 0.78; hover→1.0.
- Cell **area** = file size × per-type scale (canvas/excalidraw down-weighted). Size ≠ color (independent channels).

### Folder chrome (styles.css:736-780, FolderNode.tsx)
Nested `<svg>` per folder; `<rect>` bg tinted by depth via color-mix(text into bg): d1 5%, d2 8%, d3 11%, d4+ 14% (cap tier 4). Stroke `--vt-border` 0.75 (d1 border2 1.5). Uppercase monospace label, 9px (top 10px/500), letter-spacing 0.1em, fill `--vt-text-mut`, at x=5 y=14(d1)/12. Treemap padding: outer 8, top 20(d1)/16, inner 2, squarify, rounded.

### Leaf (file) rendering (styles.css:782-798, LeafNode.tsx)
`<rect rx=2 fill=computed fillOpacity=computed>` + label only if w>32 && h>14. **Label = white text + dark halo:**
```css
.leaf-node__label { font-family: var(--font-monospace); font-size: 9px;
  fill: rgba(255,255,255,0.78); paint-order: stroke;
  stroke: rgba(0,0,0,0.4); stroke-width: 2px; stroke-linejoin: round; }
```

### Layout & theme
Header 42px bar (`--vt-surface`, bottom border) with breadcrumb/filter/field/zoom-reset/info/config icons (uniform lucide stroked family). Legend: type mode = 8×8 rounded pip per type + ".md/.canvas/.excalidraw"; heatmap mode = "new" + 88×8 CSS linear-gradient(hot→cold) + "old" + no-data pip. Footer hint: `scroll · zoom | drag · pan | dbl-click · reset`.
Dark-theme Obsidian defaults for a sample (not in repo — pick standard): bg `#1e1e1e`, surface `#262626`, text `#dcddde`, text-muted `#999`, accent `#7c3aed`. Type/gradient hexes above are EXACT — use as-is. Pre-compute color-mix to literal hex for a standalone SVG.

## D. Images / assets
- No `images/`, `assets/`, or `docs/images/` dir exists. No committed screenshots. Only `.out/*.png` (git-ignored scratch, config-panel only — NOT the treemap).
- `.gitignore` ignores `.tmp/` + `.out/` but has NO blanket `*.png`/`*.svg` rule → committing purposeful README images elsewhere is fine.
- Recommended committed location: top-level `images/` (README is at root; keeps it self-contained) or `docs/images/`. Pick one.

## Summary
Rewrite README customer-first; relocate technical internals + build steps into CLAUDE.md (symlink→AGENTS.md); drop stale README_ORIGINAL.md/README_DEVELOPMENT.md. Hand-author a sample treemap heatmap image from the exact constants above (no existing screenshot to copy). Add a hero (generated sample) + a couple of clearly-marked placeholder slots for the user's real screenshots.
