import { Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import { TRACKED_VIEW_TYPES, VISIT_HISTORY_TOP_DIR } from "../../Constants";
import { IsTrackedProvider } from "../util/vault/IsTrackedProvider";


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
    private readonly isTrackedProvider: IsTrackedProvider
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
      if (this.isTrackedProvider.isTrackedView(prev)) {
        const event = viewToFocusEvent(prev);
        for (const l of this.listeners) {
          await l.onUnfocus(event);
        }
      }
    }

    if (leaf && this.isTrackedProvider.isTrackedView(leaf.view)) {
      const event = viewToFocusEvent(leaf.view);
      for (const l of this.listeners) {
        await l.onFocus(event);
      }
    }

    this.previousLeaf = leaf;
  }
}