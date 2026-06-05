# F3: Click-to-Open File from Treemap

> **Priority:** High (core UX feature)
> **Effort:** Small (~30 min)
> **Depends on:** Phase 5 (container components done)

## Problem

Clicking a leaf node in the treemap does nothing. The prototype has a comment about this:

```tsx
// Future: add onClick to open file in Obsidian:
//   onClick={() => app.workspace.openLinkText(d.data.path, '')}
```

## Solution

### Step 1: Add file path to VaultNode

Currently `VaultNode` has `name` but no `path` — the full vault path is needed to open the file.

Add to `VaultNode`:
```typescript
/** Full vault path (e.g. "Projects/Alpha/overview.md"). Only on leaf nodes. */
path?: string;
```

Update `buildVaultTree` to set it:
```typescript
node.children!.push({
  name: file.name,
  path: file.path,   // ← add this
  type,
  size: file.stat.size,
  // ...
});
```

### Step 2: Pass path through LeafNode props and add onClick

```typescript
// LeafNode adds:
onClick?: () => void;
```

### Step 3: Wire in TreemapViz

TreemapViz needs access to the Obsidian `App` instance to open files. Options:

**A) Pass `app` as prop through App → TreemapViz → LeafNode** — couples view to Obsidian.

**B) Pass `onFileClick` callback from VaultTreemapView** — keeps components Obsidian-agnostic.

Recommend **B**: VaultTreemapView provides the callback:
```typescript
// In VaultTreemapView.refresh():
const handleFileOpen = (path: string) => {
  this.app.workspace.openLinkText(path, '/', false);
};
this.root?.render(<TreemapApp data={data} onFileOpen={handleFileOpen} />);
```

Thread `onFileOpen` through App → TreemapViz → LeafNode.

### Step 4: Double-click to open (optional)

Click could highlight/select; double-click opens the file. UX TBD.
