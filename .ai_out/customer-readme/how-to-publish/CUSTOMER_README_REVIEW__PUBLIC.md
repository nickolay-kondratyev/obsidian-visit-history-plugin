# CUSTOMER_README_REVIEW — verdict: READY

Reviewed commit `4ef3a2c` against the human's spec. READ-ONLY review.

**Blocking: 0 · Should-fix: 1 · Nice-to-have: 2**

## Spec coverage (all 4 required points met)
| Requirement | Status | Where |
|---|---|---|
| (a) What the plugin does | ✅ | README "What it does" (visit recording + vault heatmap) |
| (b) What files it saves, concisely, no `.vh_v3`/V3/legacy jargon | ✅ | "Where your data is saved" — `__visit_history/` folder, one small text file per doc, per user/per device. No path grammar, no "V3". |
| (c) IDs persist history across renames (headline) | ✅ | Dedicated "Your history survives renames" section — clear, prominent, customer-worded. |
| (d) A few screenshot placeholders | ✅ | 2 `<!-- TODO: replace with a real screenshot -->` slots → intentionally-absent `images/heatmap-by-recency.png`, `images/heatmap-config-panel.png`. |
| Generate a sample heatmap | ✅ | `images/sample-heatmap.png` (2000×1284, real PNG) as hero + `images/sample-heatmap.svg` source. |

## Verifications performed
- **Customer-facing tone**: end-user first. The old git-clone/npm-build steps are GONE from the primary path; install path is store → manual copy → BRAT. Dev/build content relocated to a small "Development & publishing" pointer + AGENTS.md. ✅
- **License KSAL-2.3 preserved verbatim**: `diff` of old vs new license block is byte-identical except the new file adds a trailing newline (the old had none). No wording change. ✅
- **Technical relocation to AGENTS.md**: only a 3-line `build.sh` + hot-reload tip added (folded from README_DEVELOPMENT.md). Succinct, accurate, not bloated — existing `.vh_v3`/doc-id/migration knowledge was deliberately NOT duplicated. ✅ (honors AGENTS.md succinctness rule)
- **Deleted files**: `README_ORIGINAL.md` + `README_DEVELOPMENT.md` removed. No live doc/code references them — remaining hits are only `.ai_out/` process artifacts. ✅
- **Links resolve**: `docs/README.md`, `docs/how-to-publish.md`, `LICENSE.md`, `images/sample-heatmap.png` all exist; placeholder image paths intentionally absent. No stale links. ✅
- **Headings**: sentence case throughout. ✅
- **Accuracy vs explore spec**: size = file size; colour = by type OR by recency (created/modified/visited); drill-down; path/content filters; `_archive` hidden — all match, no invented features. ✅
- **Sample image (viewed)**: authentic-looking Obsidian dark treemap. Palette matches spec — nature gradient hot `#1db954`→cold `#1a3a7a`, no-data `#1a1a20`, canvas `#be7220`, excalidraw `#1e9e8e`; white leaf labels with dark halo; 42px header + new→gradient→old legend + no-data pip. SVG is standalone (literal hex, no scripts/foreignObject/external refs). ✅

## SHOULD-FIX
1. **Sample heatmap mixes gradient + type accents while labelled "coloured by last visited"** (`images/sample-heatmap.svg` / `.png`, tiles `flows.canvas`, `sketch.excalidraw`, `diagram.excalidraw`, `references.canvas`). In the real plugin, "heatmap"/recency mode colours ALL leaves by the recency gradient; the orange/teal type accents only appear in "type" mode. The in-image legend shows ONLY the gradient + no-data pip, so those 4 orange/teal tiles have no legend entry and mildly contradict the header text. It reads well as a marketing hero and the README caption says "illustrative", so this is not blocking — but the cleanest fix is to recolour those 4 tiles to gradient values (making it a faithful recency view), or leave them as a deliberate "type-accent hint" only if you accept the legend mismatch. Owner taste call. `#QUESTION_FOR_HUMAN:` keep the type-accent tiles as artistic license, or make the hero a pure recency view?

## NICE-TO-HAVE
1. Impl note `CUSTOMER_README_IMPL__PUBLIC.md` claims the hero shipped as SVG (rasterizer unavailable); the committed artifact is actually a proper 2000×1284 PNG referenced by the README — the note is stale but the delivered state is correct/better. No action needed beyond awareness.
2. README uses British spelling ("colour", "organised", "coloured") consistently — fine and internally consistent; only flag if a US-spelling house style is desired.

## Overall
Clean, accurate, genuinely customer-facing. Meets every required point. The one substantive nuance (sample colouring vs heatmap-mode semantics) is a marketing-image taste call, not a correctness gate.

**VERDICT: READY** (address the SHOULD-FIX only if you want the hero to be semantically faithful to heatmap mode).
