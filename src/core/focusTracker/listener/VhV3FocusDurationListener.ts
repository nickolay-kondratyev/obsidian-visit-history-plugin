import { FocusEvent, FocusListener } from '../FocusTracker';
import { DocIdService } from '../../service/docId/DocIdService';
import { DocIdFilenameSafety } from '../../service/visitHistoryService/DocIdFilenameSafety';
import { FocusDurationTracker } from '../../focusDuration/FocusDurationTracker';

/**
 * V3 bridge from focus events to the duration tracker: resolves the focused
 * file to its doc id and forwards focus/unfocus. Recorded ALONGSIDE V2 —
 * the V2 listener stays untouched.
 *
 * No InFlightDropGuard here: FocusTracker serializes dispatch, and the
 * tracker itself ignores duplicate focus events for the same doc.
 */
export class VhV3FocusDurationListener implements FocusListener {
  constructor(
    private readonly docIdService: DocIdService,
    private readonly focusDurationTracker: FocusDurationTracker,
  ) {
  }

  async onFocus(event: FocusEvent): Promise<void> {
    if (!event.file?.path) {
      return;
    }
    // ensureDocId is a cheap cached read here — DocIdFocusListener (registered
    // first) has already persisted the id.
    const docId = await this.docIdService.ensureDocId(event.file);
    if (docId === null || !this.isTrackableId(docId, event.file.path)) {
      // The newly focused doc cannot be duration-tracked. Still tell the
      // tracker focus moved away, or a same-leaf navigation from a trackable
      // doc would leave its session running forever.
      this.focusDurationTracker.onDocUnfocused();
      return;
    }
    this.focusDurationTracker.onDocFocused(docId);
  }

  async onUnfocus(_event: FocusEvent): Promise<void> {
    this.focusDurationTracker.onDocUnfocused();
  }

  // ── private ─────────────────────────────────────────────────────────────

  private isTrackableId(docId: string, path: string): boolean {
    if (DocIdFilenameSafety.isFilenameSafeId(docId)) {
      return true;
    }
    console.error(`[VHP][VhV3FocusDurationListener] doc id not filename-safe, duration not tracked path=[${path}] docId=[${docId}]`);
    return false;
  }
}
