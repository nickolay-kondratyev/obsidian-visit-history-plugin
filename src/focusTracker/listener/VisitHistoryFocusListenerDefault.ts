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

  private static readonly V1_VH_FOCUS_DIR: string = "_visit_history/v1/focus";

  private lastRecordedVhPath: string = "I_DONT_EXIST_PATH";

  async onFocus(event: FocusEvent): Promise<void> {
    const vhFile = await this.getVHFile(event);
    if (vhFile === null) {
      return;
    }
    const vhFilePath = vhFile.path;

    if (this.lastRecordedVhPath === vhFilePath) {
      console.log("[VHP] Skip last focus was already the same file.");
    } else {
      await this.noteFileUtil.appendLineToNote(
        vhFilePath,
        Date.now().toString()
      );
    }

    this.lastRecordedVhPath = vhFilePath;
  }

  async onUnfocus(event: FocusEvent): Promise<void> {
    console.log('[FocusTracker] UNFOCUS', event);
  }

  async getVHFile(event: FocusEvent): Promise<TFile | null> {
    const allBacklinks = this.linkUtil.getBacklinks(event.file);
    const vhBacklinks =
      allBacklinks.filter(bl => bl.path.startsWith(VisitHistoryFocusListenerDefault.V1_VH_FOCUS_DIR));
    if (vhBacklinks === undefined) {
      this.userNotifier.showError("[VHP] visit history backlinks are undefined");
      return null;
    }

    let vhFile: TFile;

    if (vhBacklinks.length > 0) {
      if (vhBacklinks.length > 1) {
        this.userNotifier.showError("More than one visit history backlink found for the file=" + event.file.path);
      }

      const bl = vhBacklinks[0];
      if (bl?.file === undefined) {
        this.userNotifier.showError("[VHP] backlink has no associated file");
        return null;
      }
      vhFile = bl.file;

    } else {
      let filePathInVault = `${VisitHistoryFocusListenerDefault.V1_VH_FOCUS_DIR}/_vh_${ulid()}.md`;

      vhFile = await this.noteFileUtil.createNote(filePathInVault,
        `VISIT_HISTORY_V1_FOR:[[${event.file.path}]]\n` +
        "### VISIT_HISTORY_V1:\n")
    }

    return vhFile;
  }
};