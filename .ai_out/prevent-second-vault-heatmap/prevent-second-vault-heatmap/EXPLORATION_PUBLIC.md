# Exploration: Prevent-second-vault-heatmap guard

## Task
Guard preventing a NEW vault-level heatmap open when an existing vault-level heatmap is CURRENTLY at vault ROOT. If drilled into a folder, allow another open.

Owner decisions (from ticket):
- Blocked action: REVEAL existing vault-root heatmap SILENTLY via `workspace.revealLeaf` — no Notice.
- Nav bridge: MINIMAL CALLBACK FLAG — App gets `onAtVaultRootChange(atRoot: boolean)` prop; `VaultTreemapView` stores the boolean and exposes `isAtVaultRoot()`. Do NOT route nav through setState.
- Guard applies to vault-level opens only (command + ribbon). Folder-targeted opens unaffected.
- Scan `workspace.getLeavesOfType(VIEW_TYPE_TREEMAP)`; if multiple vault-root heatmaps, reveal FIRST found.
- Popouts: `getLeavesOfType` spans them — no extra work.

## 1. `src/main.ts` — heatmap open flow (`initVaultTreeMapView`, lines ~105–152)

```ts
private initVaultTreeMapView(pluginFactory: PluginFactory) {
  this.registerView(
    VIEW_TYPE_TREEMAP,
    (leaf) => new VaultTreemapView(leaf, pluginFactory),
  );

  /** Opens the heatmap in a new leaf, optionally drilled into a folder. */
  const openHeatmap = (folderPath?: string) => {
    void this.app.workspace.getLeaf(true).setViewState({
      type: VIEW_TYPE_TREEMAP,
      active: true,
      state: { folderPath },
    });
  };

  this.addCommand({
    id: 'open-vault-heatmap',
    name: 'Open vault heatmap',
    callback: () => openHeatmap(),
  });

  this.addRibbonIcon('layout-grid', 'Open vault heatmap', () => openHeatmap());

  // ... status bar CSS toggle (getActiveViewOfType(VaultTreemapView)) ...

  // File-tree context menu: open the heatmap drilled into the folder.
  this.registerEvent(
    this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFolder)) return;
      menu.addItem(item =>
        item.setTitle('Open heatmap for folder').setIcon('layout-grid')
          .onClick(() => openHeatmap(file.path)),
      );
    }),
  );
}
```

- `openHeatmap(folderPath?)` is the single open call site; always `getLeaf(true)` (new leaf) — no existing-leaf check today.
- Command `open-vault-heatmap` + ribbon call `openHeatmap()` (no folderPath) ⇒ vault-level ⇒ IN SCOPE.
- file-menu `openHeatmap(file.path)` ⇒ folder-targeted ⇒ OUT OF SCOPE.
- Precedent: `this.app.workspace.getActiveViewOfType(VaultTreemapView)` already used here (status bar toggle).
- No `getLeavesOfType`/`revealLeaf` anywhere in repo today.
- Imports: `Plugin, TFolder` from `obsidian`; `CSS_CLASS_HEATMAP_ACTIVE, VaultTreemapView, VIEW_TYPE_TREEMAP` from `./view/VaultTreemapView`.

## 2. `src/view/VaultTreemapView.tsx`

`VIEW_TYPE_TREEMAP` (line 10, the ONLY definition — not in constants.ts):
```ts
export const VIEW_TYPE_TREEMAP = 'vault-heatmap';
```

Class fields / constructor (lines ~32–47): `private folderPath: string | undefined;` — undefined ⇒ vault-level.

`setState`/`getState` (lines ~84–100): persists only `folderPath`. NOTE: `folderPath === undefined` (vault-level) does NOT tell whether the view is drilled in-app — in-app drill changes React nav state only. Hence the callback bridge is required.

`refresh()` React render (lines ~119–140) — current props to `<TreemapApp>`:
```ts
this.root?.render(
  <TreemapApp
    key={this.folderPath ?? ''}
    data={data}
    fileOpener={fileOpener}
    initialFolderPath={this.folderPath}
    configStore={this.pluginFactory.heatmapConfigStore}
    contentTermMatcher={this.pluginFactory.contentTermMatcher}
  />,
);
```
New surface to add: private boolean field (e.g. `atVaultRoot`), `onAtVaultRootChange` prop pass-through, and public `isAtVaultRoot(): boolean`.
Imports: `ItemView, ViewStateResult, WorkspaceLeaf` from `obsidian`; `App as TreemapApp` from `./components/App`.

## 3. `src/view/components/App.tsx` — `folderSegments` nav state

`AppProps` (lines ~18–31): `data, fileOpener, configStore, contentTermMatcher, initialFolderPath?`. Add `onAtVaultRootChange?: (atRoot: boolean) => void`.

Nav state (lines ~174–212):
```ts
const [folderSegments, setFolderSegments] = useState<string[]>(
  () => (initialFolderPath ? initialFolderPath.split('/') : []),
);
const trail = useMemo(
  () => folderSegments.length > 0 ? (findFolderTrail(data, folderSegments.join('/')) ?? []) : [],
  [data, folderSegments],
);
const currentRoot = trail.length > 0 ? trail[trail.length - 1]! : null;
// handleFolderClick appends; handleBack drops last; breadcrumb = trail.map(n=>n.name)
```
**"At vault root" ⇔ `folderSegments.length === 0`** (equiv. `trail.length === 0` / `currentRoot === null` / `breadcrumb.length === 0`).
Existing callback-prop precedents in this file: `onStatsChange={setStats}` to TreemapViz; `registerResetZoom` ref-bridge. Add a `useEffect` keyed on the root boolean invoking `onAtVaultRootChange`.

Subtle correctness note for implementer: an unresolvable path (`folderSegments` non-empty but `findFolderTrail` returns null) yields `trail.length === 0` — i.e. it renders the vault root. So the reported "at root" boolean should derive from `trail`/`breadcrumb` (what is actually rendered), NOT raw `folderSegments`, to be truthful. (Consider: use `trail.length === 0`.)

## 4. Test patterns
- NO existing tests for main.ts / VaultTreemapView.tsx / App.tsx. Greenfield.
- Mirror `src/core/focusTracker/FocusTracker.test.ts`: hand-build a minimal duck-typed stub of `Plugin`/`workspace` touching only what's used, cast `as unknown as Plugin`. Stub `getLeavesOfType`, `revealLeaf`, `getLeaf(true).setViewState`; fake leaf `view` exposing `isAtVaultRoot()` + `folderPath`.
- Runner: `vitest run`. `obsidian` aliased to `src/testSupport/obsidianMock.ts` (no Workspace/WorkspaceLeaf/ItemView stand-ins — hand-roll inline).
- `makeTFile` in `src/testSupport/fileFactory.ts` for fixture files if needed.

## 5. Recommended implementation shape (to be validated by planner/impl)
1. `App.tsx`: add `onAtVaultRootChange?` prop + `useEffect` reporting `trail.length === 0`.
2. `VaultTreemapView.tsx`: store flag, pass prop in `refresh()`, expose `isAtVaultRoot(): boolean` (also require `folderPath === undefined`? — vault-level is defined by `folderPath === undefined`; guard must check BOTH vault-level AND at-root).
3. `main.ts`: extract guard — before vault-level `openHeatmap()`, scan `getLeavesOfType(VIEW_TYPE_TREEMAP)` for first leaf whose `view instanceof VaultTreemapView && view.folderPath === undefined && view.isAtVaultRoot()`; if found `revealLeaf(leaf)` and return; else open as today. Consider a testable pure helper for the selection logic.

## Files read
- src/main.ts, src/view/VaultTreemapView.tsx, src/view/components/App.tsx, src/view/constants.ts, src/viewModel/FileOpener.ts, src/viewModel/folderTrail.ts, src/testSupport/obsidianMock.ts, src/testSupport/fakes.ts, src/core/focusTracker/FocusTracker.test.ts, vitest.config.ts
