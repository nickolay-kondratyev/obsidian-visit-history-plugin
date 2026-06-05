# F3: Click-to-Open File from Treemap

> **Priority:** High (core UX feature)
> **Effort:** Small (~30 min)
> **Depends on:** Phase 5 (container components done) ✅

## Problem

Clicking a leaf node in the treemap does nothing. The prototype has a comment about this:

```tsx
// Future: add onClick to open file in Obsidian:
//   onClick={() => app.workspace.openLinkText(d.data.path, '')}
```

## Current State Analysis

### Data flow (top → bottom)

```
VaultTreemapView.refresh()           ← has `this.app` (Obsidian App)
  → buildVaultTree(vault, visitedMsMap) → VaultNode tree
  → <TreemapApp data={data} />
       → <TreemapViz data={data} ... />
            → <LeafNode d={d} ... />    ← no path, no onClick
```

### Key files involved

| File | Current state |
|------|---------------|
| `src/core/data/VaultNode.ts` | No `path` field — only `name`, `type`, `size`, timestamps |
| `src/viewModel/buildVaultTree.ts:58-65` | Builds leaf nodes but does NOT set `path` |
| `src/view/components/LeafNode.tsx` | Has `cursor: 'pointer'` style but no onClick handler. Has a "Future" comment |
| `src/view/components/TreemapViz.tsx` | Renders LeafNode with hover handlers, no click handler |
| `src/view/components/App.tsx` | Props: only `data: VaultNode` |
| `src/view/VaultTreemapView.tsx:75-78` | `refresh()` renders `<TreemapApp data={data}/>` — has access to `this.app` |

### Existing pattern for Obsidian abstraction (from codebase)

The codebase follows a consistent pattern for keeping Obsidian APIs out of non-view code:

```
Interface (abstraction) in core/ or viewModel/
    ↑
DefaultImpl (Obsidian-backed, takes `App` in constructor)
    ↑
PluginFactory wires them together
```

Examples:
- `VaultUtil` interface → `VaultUtilDefault(app, visitHistoryService)` — see `src/core/util/vault/VaultUtil.ts`
- `VisitHistoryService` interface → `VisitHistoryServiceDefault(vhFileProvider, noteFileUtil)`
- `UserNotifier` interface → `UserNotifierDefault(plugin)`

We follow this same pattern for file opening.

### Design decision

**The view model layer owns the file-opening abstraction.** The view layer (components) only touches the interface — never `obsidian` imports. The Obsidian-specific implementation lives in the view model and is wired in `VaultTreemapView` (the boundary between Obsidian and React).

```
View Model (touches Obsidian)          View (pure React, no Obsidian imports)
─────────────────────────────────      ─────────────────────────────────────
IFileOpener interface                  App receives IFileOpener
ObsidianFileOpener(app)                TreemapViz receives IFileOpener
  ↑ created in VaultTreemapView        LeafNode receives onClick?: () => void
```

---

## Detailed Implementation Plan

### Step 1: Add `path` to `VaultNode` interface

**File:** `src/core/data/VaultNode.ts` — add after line 20 (`name` field):

```typescript
/**
 * Full vault path (e.g. "Projects/Alpha/overview.md").
 * Only set on leaf (file) nodes; `undefined` on folder nodes.
 */
path?: string;
```

This is a leaf-only field, consistent with the existing pattern — `type`, `size`, `createdAt`, `lastModifiedAt`, `lastVisitedAt` are all leaf-only optional fields. No new imports needed.

### Step 2: Set `path` in `buildVaultTree`

**File:** `src/viewModel/buildVaultTree.ts` — in the leaf node creation block (currently lines 58-65):

```typescript
node.children!.push({
  name: file.name,
  path: file.path,     // ← NEW: full vault path for click-to-open
  type,
  size: file.stat.size,
  createdAt: file.stat.ctime,
  lastModifiedAt: file.stat.mtime,
  lastVisitedAt: visitedMs !== undefined ? visitedMs : null,
});
```

`file.path` is already available — `file` is `TFile` from the loop iteration. No new imports needed.

### Step 3: Create `IFileOpener` interface and `ObsidianFileOpener` implementation

**New file:** `src/viewModel/FileOpener.ts`

This follows the existing pattern from `VaultUtil.ts` — interface + default Obsidian-backed implementation in one module.

```typescript
import { App } from 'obsidian';

/**
 * Abstraction for opening a vault file by its path.
 *
 * The view components depend on this interface — never on Obsidian APIs directly.
 * The Obsidian-specific wiring lives in ObsidianFileOpener and is created
 * in VaultTreemapView (the boundary between Obsidian and React).
 */
export interface IFileOpener {
  /**
   * Open a file in Obsidian's active leaf.
   * @param path — full vault path, e.g. "Projects/Alpha/overview.md"
   */
  openFile(path: string): void;
}

/**
 * Obsidian-backed implementation of {@link IFileOpener}.
 *
 * Wraps `app.workspace.openLinkText()`.
 * Constructed in VaultTreemapView with the Obsidian App instance.
 */
export class ObsidianFileOpener implements IFileOpener {
  constructor(private readonly app: App) {}

  openFile(path: string): void {
    // openLinkText(path, sourcePath, newLeaf):
    //   path       — full vault path to the file
    //   '/'        — source path for relative link resolution (vault root)
    //   false      — open in current leaf, not a new split
    this.app.workspace.openLinkText(path, '/', false);
  }
}
```

**Key design points:**
- `IFileOpener` lives in `src/viewModel/` — the view model layer owns the abstraction
- `ObsidianFileOpener` is the **only** place outside `VaultTreemapView.tsx` that imports from `obsidian` in the view layer
- View components (`App`, `TreemapViz`, `LeafNode`) only know about `IFileOpener`
- The `openFile` method signature is intentionally minimal — just a path string. If we later need "open in new tab" or "open in split," we extend the interface

### Step 4: Add `onClick` to `LeafNode` component

**File:** `src/view/components/LeafNode.tsx`

**4a.** Add `onClick` to `LeafNodeProps` interface:

```typescript
interface LeafNodeProps {
  d: HierarchyRectangularNode<VaultNode>;
  hovered: boolean;
  colorMode: 'type' | 'heatmap';
  gradKey: string;
  field: string;
  hotDays: number;
  coldDays: number;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onClick?: () => void;  // ← NEW: pre-wired by TreemapViz
}
```

**4b.** Destructure `onClick` and attach to the outer `<svg>` element:

```typescript
export function LeafNode({
  d,
  hovered,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  onMouseMove,
  onMouseLeave,
  onClick,  // ← NEW
}: LeafNodeProps) {
  // ... (fill/opacity calculations unchanged)
  return (
    <svg
      x={d.x0}
      y={d.y0}
      width={lw}
      height={lh}
      overflow="hidden"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}           // ← NEW
      style={{ cursor: 'pointer' }}
    >
```

**4c.** Remove the "Future" comment (currently lines 22-24) — it's now implemented.

**Design note:** `LeafNode` receives `onClick?: () => void` — a plain callback, not `IFileOpener`. The wiring from `path` → `IFileOpener.openFile(path)` happens one level up in `TreemapViz`. This keeps `LeafNode` maximally reusable and testable — it just renders a rect that can be clicked; it doesn't know _why_ it's clicked.

### Step 5: Thread `IFileOpener` through `TreemapViz`

**File:** `src/view/components/TreemapViz.tsx`

**5a.** Import the interface (not the implementation):

```typescript
import type { IFileOpener } from '../../viewModel/FileOpener';
```

**5b.** Add `fileOpener` to `TreemapVizProps`:

```typescript
interface TreemapVizProps {
  data: VaultNode;
  colorMode: 'type' | 'heatmap';
  gradKey: string;
  field: string;
  hotDays: number;
  coldDays: number;
  scales: Record<string, number>;
  onStatsChange: (stats: { files: number; folders: number; size: string }) => void;
  fileOpener: IFileOpener;  // ← NEW
}
```

**5c.** Destructure `fileOpener` and wire `onClick` for each leaf:

```typescript
export function TreemapViz({
  data,
  colorMode,
  gradKey,
  field,
  hotDays,
  coldDays,
  scales,
  onStatsChange,
  fileOpener,  // ← NEW
}: TreemapVizProps) {
```

In the LeafNode rendering block (currently around line 165-178), add onClick:

```typescript
{leaves.map((d, i) => (
  <LeafNode
    key={'l' + i}
    d={d}
    hovered={hoveredIdx === i}
    colorMode={colorMode}
    gradKey={gradKey}
    field={field}
    hotDays={hotDays}
    coldDays={coldDays}
    onMouseMove={e => handleLeafMove(e, d, i)}
    onMouseLeave={handleLeafLeave}
    onClick={
      d.data.path
        ? () => fileOpener.openFile(d.data.path!)
        : undefined
    }  // ← NEW
  />
))}
```

The `d.data.path ?` guard ensures folder nodes (which don't have `path`) don't get a click handler. Folders are rendered by `FolderNode`, not `LeafNode`, so this is a safety net — in practice, all `LeafNode` instances should have `path`.

### Step 6: Thread `IFileOpener` through `App`

**File:** `src/view/components/App.tsx`

**6a.** Import the interface:

```typescript
import type { IFileOpener } from '../../viewModel/FileOpener';
```

**6b.** Add `fileOpener` to `AppProps`:

```typescript
interface AppProps {
  data: VaultNode;
  fileOpener: IFileOpener;  // ← NEW
}
```

**6c.** Destructure and thread to `TreemapViz`:

```typescript
export function App({ data, fileOpener }: AppProps) {
```

```typescript
<TreemapViz
  data={data}
  colorMode={colorMode}
  gradKey={gradKey}
  field={field}
  hotDays={hotDays}
  coldDays={coldDays}
  scales={scales}
  onStatsChange={setStats}
  fileOpener={fileOpener}  // ← NEW
/>
```

### Step 7: Wire `ObsidianFileOpener` in `VaultTreemapView`

**File:** `src/view/VaultTreemapView.tsx`

**7a.** Import the concrete implementation (the boundary file is allowed to know about Obsidian):

```typescript
import { ObsidianFileOpener } from '../viewModel/FileOpener';
```

**7b.** In `refresh()`, create the file opener and pass it:

```typescript
private async refresh(): Promise<void> {
  const visitedMsMap = await this.getVisitedTimestamps();
  const data: VaultNode = await buildVaultTree(this.app.vault, visitedMsMap);

  const fileOpener = new ObsidianFileOpener(this.app);

  this.root?.render(<TreemapApp data={data} fileOpener={fileOpener} />);
}
```

The `fileOpener` is created fresh on each `refresh()` call. `ObsidianFileOpener` is stateless (it just wraps `this.app`), so this is cheap. If we later need a singleton, we can hoist it to a class field — but YAGNI for now.

---

## Architecture Summary

```
┌─ View Model (touches Obsidian) ─────────────────────────────────────┐
│                                                                      │
│  IFileOpener (interface)         ← view components depend on this    │
│  ObsidianFileOpener(app)         ← wraps app.workspace.openLinkText  │
│  buildVaultTree()                ← sets path on VaultNode leaves     │
│                                                                      │
├─ View Model / View Boundary ────────────────────────────────────────┤
│                                                                      │
│  VaultTreemapView.refresh():                                         │
│    const fileOpener = new ObsidianFileOpener(this.app);              │
│    render(<TreemapApp data={data} fileOpener={fileOpener} />)        │
│                                                                      │
├─ View (pure React, no Obsidian imports) ─────────────────────────────┤
│                                                                      │
│  App { data, fileOpener: IFileOpener }                               │
│    → TreemapViz { ..., fileOpener: IFileOpener }                     │
│         → LeafNode { ..., onClick?: () => void }                     │
│              onClick → fileOpener.openFile(d.data.path)              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Obsidian import locations (after change)

| File | Imports from `obsidian`? | Reason |
|------|--------------------------|--------|
| `src/view/VaultTreemapView.tsx` | ✅ Yes | ItemView — must extend Obsidian class |
| `src/viewModel/FileOpener.ts` | ✅ Yes | `ObsidianFileOpener` needs `App` type |
| `src/viewModel/buildVaultTree.ts` | ✅ Yes (existing) | Takes `Vault` param (type from obsidian) |
| `src/view/components/App.tsx` | ❌ No | Only touches `IFileOpener` |
| `src/view/components/TreemapViz.tsx` | ❌ No | Only touches `IFileOpener` |
| `src/view/components/LeafNode.tsx` | ❌ No | Only receives `onClick?: () => void` |

---

## Files Changed (summary)

| # | File | Change |
|---|------|--------|
| 1 | `src/core/data/VaultNode.ts` | Add `path?: string` field to interface |
| 2 | `src/viewModel/buildVaultTree.ts` | Set `path: file.path` on leaf nodes |
| 3 | **`src/viewModel/FileOpener.ts`** | **NEW** — `IFileOpener` interface + `ObsidianFileOpener` class |
| 4 | `src/view/components/LeafNode.tsx` | Add `onClick` prop, attach to SVG, remove "Future" comment |
| 5 | `src/view/components/TreemapViz.tsx` | Add `fileOpener: IFileOpener` prop, wire `onClick` per leaf |
| 6 | `src/view/components/App.tsx` | Add `fileOpener: IFileOpener` prop, thread to TreemapViz |
| 7 | `src/view/VaultTreemapView.tsx` | Create `ObsidianFileOpener(this.app)`, pass to App |

**1 new file, 6 modified files.** Pure threading of an interface through the existing component hierarchy. The Obsidian API touch-point is centralized in `ObsidianFileOpener`.

---

## Verification Checklist

- [ ] Click a `.md` leaf node → file opens in Obsidian
- [ ] Click a `.canvas` leaf node → canvas opens in Obsidian
- [ ] Click a `.excalidraw` leaf node → excalidraw opens in Obsidian
- [ ] Click a folder node → nothing happens (folders rendered by `FolderNode`, not `LeafNode`)
- [ ] Zoom/pan still works (click-to-open shouldn't fire during drag operations)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm run lint` passes
- [ ] Works after Obsidian reload
