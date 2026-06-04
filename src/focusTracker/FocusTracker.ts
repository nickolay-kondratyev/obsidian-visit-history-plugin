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

function isTrackedView(view: View | null): boolean {
  let ofRightType = TRACKED_VIEW_TYPES.has(view?.getViewType() ?? '');

  return ofRightType && (view as any).file !== null;
}

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
      if (isTrackedView(prev)) {
        const event = viewToFocusEvent(prev);
        this.listeners.forEach((l) => l.onUnfocus(event));
      }
    }

    if (leaf && isTrackedView(leaf.view)) {
      const event = viewToFocusEvent(leaf.view);
      this.listeners.forEach((l) => l.onFocus(event));
    }

    this.previousLeaf = leaf;
  }
}