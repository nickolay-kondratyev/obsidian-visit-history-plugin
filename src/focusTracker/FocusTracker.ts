import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';

const TRACKED_VIEW_TYPES = new Set(['markdown', 'canvas', 'excalidraw']);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FocusEvent {
  type: string;   // 'markdown' | 'canvas' | 'excalidraw'
  title: string;
  file: TFile;
}

export interface FocusListener {
  onFocus(event: FocusEvent): void;

  onUnfocus(event: FocusEvent): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function viewToFocusEvent(view: View): FocusEvent {
  return {
    type: view.getViewType(),
    title: view.getDisplayText(),
    file: (view as any).file,
  };
}

// ── FocusTracker ──────────────────────────────────────────────────────────────

export class FocusTracker {
  private previousLeaf: WorkspaceLeaf | null = null;
  private listeners: FocusListener[] = [];

  constructor(
    private readonly plugin: Plugin,
  ) {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        this.handleLeafChange(leaf ?? null);
      })
    );
  }

  registerListener(listener: FocusListener): void {
    this.listeners.push(listener);
  }

  // ── private ───────────────────────────────────────────────────────────────

  private handleLeafChange(leaf: WorkspaceLeaf | null): void {
    if (this.previousLeaf && this.previousLeaf !== leaf) {
      const prev = this.previousLeaf.view;
      if (this.isTrackedView(prev)) {
        const event = viewToFocusEvent(prev);
        this.listeners.forEach((l) => l.onUnfocus(event));
      }
    }

    if (leaf && this.isTrackedView(leaf.view)) {
      const event = viewToFocusEvent(leaf.view);
      this.listeners.forEach((l) => l.onFocus(event));
    }

    this.previousLeaf = leaf;
  }

  private isTrackedView(view: View | null): boolean {
    if (view === null) {
      console.log("[VHP] isTrackedView [view] is null skipping.");
      return false;
    }

    const file = (view as any).file ?? null;
    if (file === null) {
      console.log("[VHP] isTrackedView [file] is null skipping.");
      return false;
    }

    if (file.path == null) {
      console.log("[VHP] isTrackedView [path] is null skipping.");
      return false;
    }

    if (file.path.startsWith("_visit_history")){
      console.log("[VHP] isTrackedView skipping visit history file: " + file.path);
      return false;
    }

    let ofRightType = TRACKED_VIEW_TYPES.has(view?.getViewType() ?? '');
    return ofRightType && (view as any).file !== null;
  }
}