# Visit History Plugin — Docs

Obsidian plugin that records when you visit notes, canvases, and Excalidraw
drawings, and visualizes vault activity as a treemap heatmap.

**Two features, one data flow:**

1. **Recording** — focusing a tracked file appends an ISO 8601 timestamp to a
   per-file, per-device log under `_visit_history/`.
2. **Visualization** — the "Open vault heatmap" command renders the vault as a
   zoomable treemap, colored by created/modified/visited recency.

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Module map, dependency injection, layer boundaries, caching |
| [visit-history-format.md](visit-history-format.md) | On-disk VH file format, device dirs, backlink discovery |
| [heatmap-view.md](heatmap-view.md) | React treemap view: components, state, config |

## Dev quickstart

```bash
npm install
npm run dev     # watch mode
npm test        # vitest unit tests
npm run lint    # ESLint (obsidianmd rules) — kept at zero errors
npm run build   # typecheck + production bundle (main.js)
```

Unit tests run against a minimal runtime stand-in for the types-only
`obsidian` package (`src/testSupport/obsidianMock.ts`, wired in
`vitest.config.ts`).
