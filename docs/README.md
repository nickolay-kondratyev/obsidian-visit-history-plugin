# Visit History Plugin — Docs

Obsidian plugin that records when you visit notes, canvases, and Excalidraw
drawings, and visualizes vault activity as a treemap heatmap.

**Two features, one data flow:**

1. **Recording** — each completed focus session (start timestamp + duration)
   is appended to a per-user, per-document, per-device V3 log under
   `.visit_history/user/<user-name>/` (keyed by the document's persistent
   doc id). Legacy v2 and `_visit_history/` (V1) data from older plugin
   versions is no longer read or written — content left untouched;
   pre-user-scoped `.visit_history/v2|v3` dirs are auto-moved under the user.
2. **Visualization** — the "Open vault heatmap" command renders the vault as a
   zoomable treemap, colored by created/modified/visited recency ("visited" =
   latest V3 session start across ALL users' devices).

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Module map, dependency injection, layer boundaries, caching |
| [visit-history-format.md](visit-history-format.md) | On-disk VH V3 format, user + device dirs, doc-id keying, legacy-layout move |
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
