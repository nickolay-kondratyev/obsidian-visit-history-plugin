import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";
import { UserNotifier } from "../../util/userComm/UserNotifier";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { ulid } from 'ulid';
import { TFile } from 'obsidian';

export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil) {
  }

  async onFocus(event: FocusEvent): Promise<void> {
    const allBacklinks = this.linkUtil.getBacklinks(event.file);
    const vhBacklinks =
      allBacklinks.filter(bl => bl.path.startsWith("_visit_history/v1/"));
    if (vhBacklinks === undefined) {
      this.userNotifier.showError("[VHP] visit history backlinks are undefined");
      return;
    }

    console.log("");
    console.log('[FocusTracker] FOCUS EVENT:', event);

    let vhFile: TFile;

    if (vhBacklinks.length > 0) {
      if (vhBacklinks.length > 1) {
        this.userNotifier.showError("More than one visit history backlink found for the file=" + event.file.path);
      }

      const bl = vhBacklinks[0];
      if (bl?.file === undefined) {
        this.userNotifier.showError("[VHP] backlink has no associated file");
        return;
      }
      vhFile = bl.file;

    } else {
      vhFile = await this.noteFileUtil.createNote("_visit_history/v1/_visit_history_" + ulid() + ".md",
        `VISIT_HISTORY_V1_FOR:[[${event.file.path}]]\n` +
        "### VISIT_HISTORY_V1:\n")
    }

    console.log("[VHP] VH FILE: ", vhFile);
  }

  async onUnfocus(event: FocusEvent): Promise<void> {
    console.log('[FocusTracker] UNFOCUS', event);
  }
};