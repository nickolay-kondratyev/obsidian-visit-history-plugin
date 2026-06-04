import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";

export class ConsoleFocusListener implements FocusListener {
  constructor(private readonly linkUtil: LinkUtil) {
  }

  onFocus(event: FocusEvent) {
    const allBacklinks = this.linkUtil.getBacklinks(event.file);
    const vhBacklinks =
      allBacklinks.filter(bl => bl.path.startsWith("_visit_history/v1/"));

    console.log("");
    console.log('[FocusTracker] FOCUS EVENT:', event);


    if (vhBacklinks.length > 0) {

      console.log('[FocusTracker] FOCUS VH-BACKLINKS:', vhBacklinks);
    } else {
      console.log("No VH backlinks found");
    }
  }

  onUnfocus(event: FocusEvent) {
    console.log('[FocusTracker] UNFOCUS', event);
  }
};