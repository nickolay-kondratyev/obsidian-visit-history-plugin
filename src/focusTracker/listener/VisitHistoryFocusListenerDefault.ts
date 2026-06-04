import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";
import { UserNotifier } from "../../util/userComm/UserNotifier";

export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier) {
  }

  onFocus(event: FocusEvent) {
    const allBacklinks = this.linkUtil.getBacklinks(event.file);
    const vhBacklinks =
      allBacklinks.filter(bl => bl.path.startsWith("_visit_history/v1/"));

    console.log("");
    console.log('[FocusTracker] FOCUS EVENT:', event);

    if (vhBacklinks.length > 0) {
      if (vhBacklinks.length > 1) {
        this.userNotifier.showError("More than one visit history backlink found for the file=" + event.file.path);
      }

      console.log('[FocusTracker] FOCUS VH-BACKLINKS:', vhBacklinks);
    } else {

      console.log("No VH backlinks found");
    }
  }

  onUnfocus(event: FocusEvent) {
    console.log('[FocusTracker] UNFOCUS', event);
  }
};