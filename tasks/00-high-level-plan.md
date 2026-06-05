# Vault Treemap — High-Level Integration Plan

> **Status:** PLANNING
> **Reference prototype:** `raw_proto/visit_visualization/vault-treemap.html`
> **Reference plan:** `raw_proto/visit_visualization/vault-treemap-integration-plan.md`

## Architecture: Three-Layer DIP

```
src/core/data/       ← Pure data types. Knows NOTHING of Obsidian, React, or View.
src/viewModel/       ← View-prep logic. Knows Obsidian + Core types. No React.
src/view/            ← React components. Knows Core types. Minimal Obsidian (ItemView only).
```

- **View can import from ViewModel and Core.**
- **ViewModel can import from Core.**
- **Core MUST NOT import from View or ViewModel.**
- **ViewModel MUST NOT import from View.**

## Resolved Decisions

| # | Decision | Resolution |
|---|----------|------------|
| D1 | Where does `buildVaultTree` live? | `src/viewModel/` — view-prep logic, not core data |
| D2 | `lastVisitedAt` wiring | Wire from existing `VaultUtilDefault.getTrackedFiles()` → `FileTimeMetadata.visitedMs` |
| D3 | D3/React library | `react-d3-library` evaluated & rejected (no treemap, unmaintained since 2016). Use `d3-hierarchy` (layout math in `useMemo`) + `@visx/zoom` (zoom in React state). |
| D4 | Font | `var(--font-monospace)` — Obsidian's built-in monospace |
| D5 | CSS | `styles.css` at plugin root, scoped under `.vault-treemap-view` |

## Directory Layout (post-migration)

```
src/
├── main.ts                          ← existing — register view + command
├── settings.ts                      ← existing — may add treemap defaults later
├── core/
│   └── data/
│       ├── FileTimeMetadata.ts      ← existing — { createdMs, modifiedMs, visitedMs }
│       └── VaultNode.ts             ← NEW — tree node type for visualization
├── viewModel/                       ← NEW — view-prep logic
│   └── buildVaultTree.ts           ← NEW — vault API → VaultNode tree (merges visitedMs)
└── view/                            ← NEW — React components
    ├── constants.ts
    ├── utils.ts
    ├── VaultTreemapView.ts          ← Obsidian ItemView host (only Obsidian import in view/)
    └── components/
        ├── App.tsx                  ← top-level state owner
        ├── Header.tsx
        ├── Legend.tsx
        ├── TreemapViz.tsx           ← D3 layout + @visx/zoom
        ├── FolderNode.tsx
        ├── LeafNode.tsx
        ├── Tooltip.tsx
        └── ConfigPanel/
            ├── index.tsx
            ├── HeatmapOptions.tsx
            └── GradientPicker.tsx
styles.css                           ← scoped under .vault-treemap-view
```

## Phased Task Breakdown

### Phase 0: Infrastructure (prerequisites)
- **0.1** — React/JSX build setup (tsconfig, esbuild externals, npm deps)

### Phase 1: Core data structures
- **1.1** — `VaultNode` type in `src/core/data/VaultNode.ts`

### Phase 2: View — pure functions & constants
- **2.1** — `src/view/constants.ts` (TYPE_C, GRADIENTS, FIELD_LABELS)
- **2.2** — `src/view/utils.ts` (heatColor, leafFill, leafOpacity, fmtBytes, fmtDate, nodePath)

### Phase 3: View — leaf components
- **3.x** — Legend, Tooltip, FolderNode, LeafNode (pure, no state)

### Phase 4: View — config components
- **4.x** — GradientPicker, HeatmapOptions, ConfigPanel (controlled)

### Phase 5: View — container components
- **5.1** — Header
- **5.2** — TreemapViz (d3-hierarchy + @visx/zoom)
- **5.3** — App (state owner, receives `data: VaultNode`)

### Phase 6: ViewModel + Integration
- **6.1** — `src/viewModel/buildVaultTree.ts` (vault → VaultNode, wired with visitedMs)
- **6.2** — `src/view/VaultTreemapView.ts` (ItemView host)

### Phase 7: CSS
- **7.1** — `styles.css` scoped under `.vault-treemap-view`, theme var mapping

### Phase 8: Wire into plugin
- **8.1** — Register view + command in `main.ts`
- **8.2** — Optional ribbon icon

## Dependency Flow

```
0.1 (infra)
  └→ 1.1 (VaultNode)
       ├→ 2.x (constants/utils)
       │    ├→ 3.x (leaf components)
       │    ├→ 4.x (config components)
       │    └→ 5.x (container components)
       │         └→ 6.2 (ItemView)
       └→ 6.1 (buildVaultTree — viewModel)
            └→ 6.2 (ItemView)
                  └→ 7.1 (CSS)
                       └→ 8.x (plugin wiring)
```

## Component Tree (post-migration)

```
VaultTreemapView (ItemView — Obsidian host)
└── App (state owner: colorMode, field, scales, configOpen, etc.)
    ├── Header (stats display + Legend)
    │   └── Legend (type pills or gradient bar)
    ├── ConfigPanel (scale sliders, mode toggle, heatmap options)
    │   ├── GradientPicker
    │   └── HeatmapOptions
    └── TreemapViz (SVG treemap + @visx/zoom + tooltip)
        ├── FolderNode[] (folder rects with labels)
        ├── LeafNode[] (file rects, color-coded)
        └── Tooltip (on hover)
```

## D3/React Boundary (Final Design)

**Rejected:** `react-d3-library` — no treemap component, unmaintained (2016), uses detached-DOM pattern worse than ref hack.

**Chosen approach:**
- `d3.hierarchy` + `d3.treemap` → `useMemo` (pure math, no DOM access — no changes needed from prototype)
- `d3.interpolateRgb`, `d3.color` → pure functions in `utils.ts`
- Zoom/pan → `@visx/zoom` render-prop pattern (transform in React state, no ref hacking)

```tsx
<Zoom width={dims.w} height={dims.h} scaleXMin={0.05} scaleXMax={30} ...>
  {zoom => (
    <svg onMouseDown={zoom.dragStart} onWheel={zoom.handleWheel} ...>
      <g transform={zoom.toString()}>   {/* React-owned */}
        {folders.map(...)}
        {leaves.map(...)}
      </g>
    </svg>
  )}
</Zoom>
```
