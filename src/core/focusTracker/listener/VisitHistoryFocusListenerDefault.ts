import { FocusEvent, FocusListener } from "../FocusTracker";

import { VisitHistoryService } from "../../service/visitHistoryService/VisitHistoryService";
import { InFlightDropGuard } from "../../util/async/InFlightDropGuard";


export class VisitHistoryFocusListenerDefault implements FocusListener {
  // Drops duplicate focus events per note path while one is being recorded —
  // see InFlightDropGuard for the rationale.
  private readonly inFlightGuard = new InFlightDropGuard();

  constructor(
    private readonly visitHistoryService: VisitHistoryService) {
  }

  async onFocus(event: FocusEvent): Promise<void> {
    // Guard against events with no file path — nothing meaningful we can do.
    if (!event.file?.path) {
      return;
    }
    await this.inFlightGuard.run(event.file.path, async () => {
      await this.visitHistoryService.recordVisitNowOnFocus(event.file);
    });
  }

  async onUnfocus(_event: FocusEvent): Promise<void> {
    // Unfocus is not recorded (yet) — only focus timestamps are persisted.
  }
}
