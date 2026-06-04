import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";
import { UserNotifier } from "../../util/userComm/UserNotifier";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { ulid } from 'ulid';

export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil) {
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
      this.noteFileUtil.createNote("_visit_history/v1/_visit_history_" + ulid() + ".md",
        `VISIT_HISTORY_V1_FOR:[[${event.file.path}]]\n" ` +
        "### VISIT_HISTORY_V1:\n")

      console.log("No VH backlinks found");
    }
  }

  onUnfocus(event: FocusEvent) {
    console.log('[FocusTracker] UNFOCUS', event);
  }
};