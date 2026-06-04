import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import { TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../Constants";


// ── Types ─────────────────────────────────────────────────────────────────────

export interface FocusEvent {
  type: string;   // 'markdown' | 'canvas' | 'excalidraw'
  title: string;
  file: TFile;
}

export interface FocusListener {
  onFocus(event: FocusEvent): Promise<void>;

  onUnfocus(event: FocusEvent): Promise<void>;
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
        void this.handleLeafChange(leaf ?? null);
      })
    );
  }

  registerListener(listener: FocusListener): void {
    this.listeners.push(listener);
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async handleLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    if (this.previousLeaf && this.previousLeaf !== leaf) {
      const prev = this.previousLeaf.view;
      if (this.isTrackedView(prev)) {
        const event = viewToFocusEvent(prev);
        for (const l of this.listeners) {
          await l.onUnfocus(event);
        }
      }
    }

    if (leaf && this.isTrackedView(leaf.view)) {
      const event = viewToFocusEvent(leaf.view);
      for (const l of this.listeners) {
        await l.onFocus(event);
      }
    }

    this.previousLeaf = leaf;
  }

  private isTrackedView(view: View | null): boolean {
    if (view === null) {
      console.log("[VHP][isTrackedView] [view] is null skipping.");
      return false;
    }

    const file = (view as any).file ?? null;
    if (file === null) {
      console.log("[VHP][isTrackedView] [file] is null skipping.");
      return false;
    }

    if (file.path == null) {
      console.log("[VHP][isTrackedView] [path] is null skipping.");
      return false;
    }

    if (file.path.startsWith(VISIT_HISTORY_TOP_DIR)) {
      console.log("[VHP][isTrackedView] skipping visit history file: " + file.path);
      return false;
    }

    let ofRightType = TRACKED_VIEW_TYPES.has(view?.getViewType() ?? '');

    return ofRightType && (view as any).file !== null;
  }
}