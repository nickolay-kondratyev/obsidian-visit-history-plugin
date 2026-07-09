import { FocusEvent, FocusListener } from '../FocusTracker';
import { DocIdService } from '../../service/docId/DocIdService';
import { InFlightDropGuard } from '../../util/async/InFlightDropGuard';

/**
 * On focus, ensures the focused document has a persistent doc id.
 * Registered BEFORE the visit-history listener so id assignment is the first
 * thing that happens when a file is opened.
 */
export class DocIdFocusListener implements FocusListener {
  private readonly inFlightGuard = new InFlightDropGuard();

  constructor(private readonly docIdService: DocIdService) {
  }

  async onFocus(event: FocusEvent): Promise<void> {
    // Guard against events with no file path — nothing meaningful we can do.
    if (!event.file?.path) {
      return;
    }
    await this.inFlightGuard.run(event.file.path, async () => {
      await this.docIdService.ensureDocId(event.file);
    });
  }

  async onUnfocus(_event: FocusEvent): Promise<void> {
    // Doc id assignment only happens on focus.
  }
}
