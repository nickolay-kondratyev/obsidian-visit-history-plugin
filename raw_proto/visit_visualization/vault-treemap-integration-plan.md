# Vault Treemap — Plugin Integration Plan

> **Audience:** agent performing the merge.
> **Reference:** `prototype/vault-treemap.html` — the annotated standalone prototype.
> Every component, constant, and function in that file carries a `PLUGIN:` comment
> indicating exactly what changes when ported. Read it alongside this document.

---

## Scope

Integrate the vault treemap visualisation into the existing Obsidian plugin as a
new, self-contained feature living under `src/vault-treemap/`. The feature opens
as a dedicated panel (Obsidian `ItemView`) showing a squarified treemap of all
`.md`, `.canvas`, and `.excalidraw` files in the vault, coloured by file type or
by a heatmap derived from file timestamps.

---

## Repository layout

```
<plugin-root>/
├── prototype/
│   └── vault-treemap.html          ← annotated prototype (reference only)
├── src/
│   ├── main.ts                     ← existing — register view + command here
│   └── vault-treemap/
│       ├── VaultTreemapView.ts     ← Obsidian ItemView host
│       ├── dataAdapter.ts          ← vault API → VaultNode tree
│       ├── types.ts                ← shared TypeScript interfaces
│       ├── constants.ts            ← TYPE_C, GRADIENTS, FIELD_LABELS
│       ├── utils.ts                ← pure functions (color, format, layout helpers)
│       └── components/
│           ├── App.tsx
│           ├── Header.tsx
│           ├── Legend.tsx
│           ├── ConfigPanel/
│           │   ├── index.tsx
│           │   ├── HeatmapOptions.tsx
│           │   └── GradientPicker.tsx
│           ├── TreemapViz.tsx      ← renamed from TreemapView (avoids ItemView clash)
│           ├── FolderNode.tsx
│           ├── LeafNode.tsx
│           └── Tooltip.tsx
└── styles/
    └── vault-treemap.css           ← scoped stylesheet (or append to styles.css)
```

---

## Prerequisites

### Investigate first

Before touching `package.json`, check:

- How the existing plugin imports React. Obsidian ships React 18 and ReactDOM 18
  internally; the plugin should import from `'react'` and `'react-dom'` and mark
  both as **external** in the bundler so they are not double-bundled. Verify this
  is already in place.
- Which bundler is in use (esbuild, rollup, or other) and how it handles
  ESM-only packages. D3 v7 is ESM-only; confirm it resolves without extra config.
- Whether `tsconfig.json` already has `"jsx": "react"` or `"jsx": "react-jsx"`.
  If not, add it before writing any `.tsx` files.

### npm packages to add

```
# D3 subpackages — prefer over the full d3 bundle for tree-shaking
d3-hierarchy      # d3.hierarchy(), d3.treemap(), treemapSquarify
d3-interpolate    # d3.interpolateRgb()
d3-color          # d3.color().brighter()

# Zoom — use @visx/zoom instead of d3-zoom (see §D3/React boundary below)
@visx/zoom

# Type definitions
@types/d3-hierarchy
@types/d3-interpolate
@types/d3-color
```

Do **not** add `react`, `react-dom`, or their types — Obsidian provides them.
Check whether `@types/react` is already in `devDependencies`; add it if not.

---

## Build configuration (high-level)

These are investigative suggestions, not direct actions — the agent should read
the actual bundler config before making changes.

- **React/ReactDOM external:** confirm `react` and `react-dom` appear in the
  bundler's `external` list (esbuild) or `externals` (rollup). If missing, add
  them — otherwise the plugin bundles its own React copy and Obsidian's copy
  conflicts at runtime.
- **D3 ESM:** esbuild handles ESM subpackages automatically. For rollup, confirm
  `@rollup/plugin-node-resolve` is present and `moduleDirectories` includes
  `node_modules`.
- **CSS:** if styles are compiled separately, add `vault-treemap.css` to the CSS
  entry point. If styles are inlined, append the scoped rules to `styles.css`.
- **Source maps:** no special treatment needed for the new files.

---

## D3/React boundary

This is the only non-trivial architectural decision in the migration.

The prototype has one place where D3 directly mutates the DOM, bypassing React:

```javascript
// TreemapView — zoom useEffect
useEffect(() => {
  const zoom = d3.zoom().on("zoom", ev => {
    gRef.current.setAttribute("transform", ev.transform); // ← direct DOM write
  });
  d3.select(svgRef.current).call(zoom);
}, []);
```

This works because React only diffs props explicitly declared in JSX — it never
touches `transform` on the `<g>` since that attr isn't in the JSX. However it is
fragile and breaks the React mental model.

**Replace with `@visx/zoom` in the plugin.** The swap keeps the transform in
proper React state:

```tsx
import { Zoom } from '@visx/zoom';

// Inside TreemapViz render:
<Zoom
  width={dims.w}
  height={dims.h}
  scaleXMin={0.05} scaleXMax={30}
  scaleYMin={0.05} scaleYMax={30}
>
  {zoom => (
    <svg
      ref={svgRef}
      onMouseDown={zoom.dragStart}
      onMouseMove={zoom.dragMove}
      onMouseUp={zoom.dragEnd}
      onWheel={zoom.handleWheel}
      onDoubleClick={() => zoom.reset()}
    >
      <g transform={zoom.toString()}>   {/* React-owned, no ref hacking */}
        {/* FolderNode and LeafNode map here */}
      </g>
    </svg>
  )}
</Zoom>
```

Remove `svgRef`, `gRef`, `zoomRef`, and the zoom `useEffect` entirely.
The `resetZoom` button calls `zoom.reset()` from the render-prop argument.

All other D3 usage in the prototype (`d3.hierarchy`, `d3.treemap`,
`d3.interpolateRgb`, `d3.color`) is pure math inside `useMemo` with no DOM
involvement — those require no changes.

---

## Obsidian integration: ItemView

The React tree needs a host. In Obsidian this is an `ItemView`. High-level sketch:

```typescript
// src/vault-treemap/VaultTreemapView.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { App as TreemapApp } from './components/App';
import { buildVaultTree } from './dataAdapter';

export const VIEW_TYPE_TREEMAP = 'vault-treemap';

export class VaultTreemapView extends ItemView {
  private root: Root | null = null;

  getViewType()    { return VIEW_TYPE_TREEMAP; }
  getDisplayText() { return 'Vault Treemap'; }
  getIcon()        { return 'layout-grid'; } // any Lucide icon name

  async onOpen() {
    // containerEl.children[1] is the content pane (children[0] is the header)
    this.root = createRoot(this.containerEl.children[1]);
    await this.refresh();

    // Re-render when files are created, deleted, or renamed
    this.registerEvent(
      this.app.vault.on('create',  () => this.refresh())
    );
    this.registerEvent(
      this.app.vault.on('delete',  () => this.refresh())
    );
    this.registerEvent(
      this.app.vault.on('rename',  () => this.refresh())
    );
  }

  async refresh() {
    const data = await buildVaultTree(this.app.vault, this.loadVisitedTimestamps());
    this.root?.render(React.createElement(TreemapApp, { data }));
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }

  // See §lastVisitedAt tracking below
  private loadVisitedTimestamps(): Record<string, number> {
    return (this.app as any).plugins.plugins['<your-plugin-id>']
      ?.settings?.visitedTimestamps ?? {};
  }
}
```

Register in `main.ts`:

```typescript
this.registerView(VIEW_TYPE_TREEMAP, leaf => new VaultTreemapView(leaf));

this.addCommand({
  id: 'open-vault-treemap',
  name: 'Open Vault Treemap',
  callback: () => {
    this.app.workspace.getLeaf(true).setViewState({
      type: VIEW_TYPE_TREEMAP,
      active: true,
    });
  },
});

// Optional: ribbon icon
this.addRibbonIcon('layout-grid', 'Vault Treemap', () => {
  this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_TREEMAP });
});
```

**Investigation:** check whether the existing plugin already registers other
`ItemView`s and follow the same registration pattern for consistency.

---

## Data adapter

The adapter is the only file that imports from `'obsidian'`. Everything else
in `src/vault-treemap/` is Obsidian-agnostic.

```typescript
// src/vault-treemap/dataAdapter.ts  — interface sketch

import { Vault, TFile } from 'obsidian';
import { VaultNode }     from './types';

type FileType = 'md' | 'canvas' | 'excalidraw';

function classifyFile(file: TFile): FileType | null {
  if (file.extension === 'canvas')     return 'canvas';
  // Excalidraw plugin stores files as either .excalidraw or .excalidraw.md
  if (file.extension === 'excalidraw') return 'excalidraw';
  if (file.extension === 'md' && file.basename.endsWith('.excalidraw')) return 'excalidraw';
  if (file.extension === 'md')         return 'md';
  return null; // skip all other types
}

export async function buildVaultTree(
  vault: Vault,
  visitedAt: Record<string, number> = {}
): Promise<VaultNode> {
  const files  = vault.getFiles();
  const root: VaultNode = { name: vault.getName(), children: [] };

  for (const file of files) {
    const type = classifyFile(file);
    if (!type) continue;

    // Build nested path: 'Projects/Alpha/overview.md' → ['Projects','Alpha','overview.md']
    const parts = file.path.split('/');
    let node    = root;

    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children!.find(c => c.name === parts[i] && c.children);
      if (!child) {
        child = { name: parts[i], children: [] };
        node.children!.push(child);
      }
      node = child;
    }

    node.children!.push({
      name:           file.name,
      type,
      size:           file.stat.size,
      createdAt:      file.stat.ctime,
      lastModifiedAt: file.stat.mtime,
      lastVisitedAt:  visitedAt[file.path] ?? null,
    });
  }

  return root;
}
```

### `lastVisitedAt` — known gap

Obsidian does not expose last-opened timestamps natively. Two options:

**Option A (deferred):** ship without it. The field selector still shows
"last visited" but all cells render as the null/no-data colour when selected.
Mark it visually as "not tracked yet" in the UI if desired.

**Option B (full implementation):** track opens at plugin level:

```typescript
// In main.ts onload():
this.registerEvent(
  this.app.workspace.on('file-open', file => {
    if (!file) return;
    this.settings.visitedTimestamps[file.path] = Date.now();
    this.saveSettings(); // debounce this in practice
  })
);
```

Store `visitedTimestamps: Record<string, number>` in plugin settings.
Pass into `buildVaultTree` as the second argument.

Option A is acceptable for initial integration. Option B is the right long-term
path and can be added independently without changing any component code.

---

## Component migration guide: Preact + htm → React + JSX

Every component is a mechanical conversion. No logic changes.

### Conversion cheatsheet

| Prototype (Preact + htm) | Plugin (React + JSX) |
|---|---|
| `const { h, render: mount, Fragment } = preact;` | `import React, { Fragment } from 'react';` |
| `const { useState, ... } = preactHooks;` | `import { useState, ... } from 'react';` |
| `const html = htm.bind(h);` | delete — not needed |
| `` html`<div className=${x}>` `` | `<div className={x}>` |
| `` html`<${Comp} prop=${val}/>` `` | `<Comp prop={val}/>` |
| `` html`<${Fragment}>...<//>` `` | `<></>` |
| `` key=${"x"+i} `` | `key={"x" + i}` |
| `style=${{ color:'red' }}` | `style={{ color: 'red' }}` |
| `onMouseMove=${fn}` | `onMouseMove={fn}` |
| `mount(html\`<${App}/>\`, el)` | `root.render(<App data={data}/>)` |

### SVG attribute camelCase sweep

React requires camelCase for SVG presentation attributes. Do a sweep on
`FolderNode.tsx` and `LeafNode.tsx` after copy-paste:

| SVG attribute | JSX prop |
|---|---|
| `font-family` | `fontFamily` |
| `font-size` | `fontSize` |
| `font-weight` | `fontWeight` |
| `letter-spacing` | `letterSpacing` |
| `fill-opacity` | `fillOpacity` |
| `stroke-width` | `strokeWidth` |
| `clip-path` | `clipPath` |

Attributes that stay the same: `x`, `y`, `width`, `height`, `rx`, `fill`,
`stroke`, `transform`, `overflow`, `viewBox`.

### Suggested migration order (smallest → largest)

1. `types.ts`, `constants.ts`, `utils.ts` — copy, add TS types, no logic changes
2. `Legend.tsx`
3. `Tooltip.tsx`
4. `FolderNode.tsx`
5. `LeafNode.tsx`
6. `GradientPicker.tsx`
7. `HeatmapOptions.tsx`
8. `ConfigPanel/index.tsx`
9. `Header.tsx`
10. `TreemapViz.tsx` — most complex; do the @visx/zoom swap here
11. `App.tsx` — add `data` prop, thread it to TreemapViz
12. `dataAdapter.ts` — implement with static data first, then wire vault API
13. `VaultTreemapView.ts` — wire ItemView to App and dataAdapter
14. Register in `main.ts`

---

## CSS migration

Extract the `<style>` block from the prototype to `styles/vault-treemap.css`.

**Scope every rule** under `.vault-treemap-view { ... }` to avoid leaking into
Obsidian's UI. The ItemView's content pane (`containerEl.children[1]`) should
have this class added in `onOpen()`:

```typescript
this.containerEl.children[1].addClass('vault-treemap-view');
```

**Map prototype variables to Obsidian theme variables** so light/dark themes
work automatically. In the scoped block:

```css
.vault-treemap-view {
  --bg:       var(--background-primary);
  --surface:  var(--background-secondary);
  --border:   var(--background-modifier-border);
  --border2:  var(--background-modifier-border);
  --text:     var(--text-normal);
  --text-dim: var(--text-muted);
  --text-mut: var(--text-faint);

  /* File-type and gradient colours have no Obsidian equivalent — keep as-is */
  --md:     #4a5ed4;
  --canvas: #be7220;
  --exd:    #1e9e8e;
  /* ... etc */
}
```

**`position: fixed` inside an ItemView:** the prototype uses `position: fixed`
for the header, config panel, and tooltip. Inside an Obsidian leaf this positions
relative to the viewport, not the leaf — which may or may not be correct depending
on whether the view is in the main pane or a sidebar. Investigate at runtime and
switch to `position: absolute` with `overflow: hidden` on the container if needed.

---

## Architectural layers (keep these boundaries hard)

```
┌─────────────────────────────────────────────────────┐
│  Obsidian layer                                     │
│  VaultTreemapView.ts, dataAdapter.ts                │
│  Only files that import from 'obsidian'             │
├─────────────────────────────────────────────────────┤
│  Config/UI layer                                    │
│  App, Header, Legend, ConfigPanel/*                 │
│  Pure React — no Obsidian, no D3                    │
├─────────────────────────────────────────────────────┤
│  Visualisation layer                                │
│  TreemapViz, FolderNode, LeafNode, Tooltip          │
│  Knows D3 layout math + SVG — no Obsidian           │
└─────────────────────────────────────────────────────┘
```

Keeping the Obsidian layer thin means the component tree can be developed and
tested in isolation (e.g., Storybook, or the standalone HTML prototype itself)
without an Obsidian environment.

---

## Known gaps and deferred decisions

| Item | Status | Notes |
|---|---|---|
| `lastVisitedAt` tracking | Deferred | See §lastVisitedAt above |
| `position: fixed` in leaf | Investigate | May need `position: absolute` |
| Click-to-open file | Not implemented | Add `onClick` to `LeafNode` calling `app.workspace.openLinkText(path, '')` |
| Vault refresh on file change | Sketched | `vault.on('create/delete/rename')` in ItemView |
| Settings persistence | Not scoped | Scale factors and gradient choice could be persisted via plugin `saveData` |
| @visx/zoom swap | Deferred to step 10 | Can merge without it; add as follow-up |
