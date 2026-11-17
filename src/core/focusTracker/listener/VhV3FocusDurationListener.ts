import { TFile } from 'obsidian';
import { FocusEvent, FocusListener } from '../FocusTracker';
import { FocusDurationTracker } from '../../focusDuration/FocusDurationTracker';

/**
 * V3 bridge from focus events to the duration tracker: forwards the focused
 * FILE (the tracker's doc handle) and its hosting window.
 *
 * Deliberately never touches doc ids — focusing a note must not modify it.
 * The id is resolved (and assigned if missing) only when a session is
 * recorded (VhV3DurationRecorder).
 *
 * No per-event dedup here: FocusTracker serializes dispatch, and the
 * tracker itself ignores duplicate focus events for the same doc.
 */
export class VhV3FocusDurationListener implements FocusListener {
  constructor(
    private readonly focusDurationTracker: FocusDurationTracker<TFile>,
  ) {
  }

  async onFocus(event: FocusEvent): Promise<void> {
    if (!event.file?.path) {
      return;
    }
    // The hosting window's document is the tracker's per-window identity.
    this.focusDurationTracker.onDocFocused(event.file, event.ownerDocument);
  }

  async onUnfocus(_event: FocusEvent): Promise<void> {
    this.focusDurationTracker.onDocUnfocused();
  }
}
