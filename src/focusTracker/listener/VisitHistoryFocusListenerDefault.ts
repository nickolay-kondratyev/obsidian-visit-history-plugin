import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";
import { UserNotifier } from "../../util/userComm/UserNotifier";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { ulid } from 'ulid';
import { LRUCache } from 'lru-cache';

const pathToVhPath = new LRUCache<string, string>({
  max: 500,           // max items
  ttl: 1000 * 60 * 1, // 1 min TTL in ms
});


export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil) {
  }


  private static readonly V1_VH_FOCUS_DIR: string = "_visit_history/v1/focus";

  private lastRecordedVhPath: string = "I_DONT_EXIST_PATH";

  async onFocus(event: FocusEvent): Promise<void> {
    const vhFilePath = await this.getOrCreateVHFilePath(event);
    if (vhFilePath === null) {
      return;
    }
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

  async getOrCreateVHFilePath(event: FocusEvent): Promise<string | null> {
    let noteFilePathInVault = event.file.path;
    console.log("[VHP][getOrCreateVHFilePath] AT_START pathToVhPath=", Object.fromEntries(pathToVhPath.entries()));

    const cachedVHPath = pathToVhPath.get(noteFilePathInVault);
    if (cachedVHPath) {
      console.log("[VHP][getOrCreateVHFilePath] Found cached path", cachedVHPath);
      return cachedVHPath;
    }


    const allBacklinks = this.linkUtil.getBacklinks(event.file);
    const vhBacklinks =
      allBacklinks.filter(bl => bl.path.startsWith(VisitHistoryFocusListenerDefault.V1_VH_FOCUS_DIR));
    if (vhBacklinks === undefined) {
      this.userNotifier.showError("[VHP][getOrCreateVHFilePath] visit history backlinks are undefined");

      return null;
    }

    let vhFilePath: string;


    if (vhBacklinks.length > 0) {
      if (vhBacklinks.length > 1) {
        this.userNotifier.showError("More than one visit history backlink found for the file=" + noteFilePathInVault);
      }

      const bl = vhBacklinks[0];
      if (bl?.file === undefined) {
        this.userNotifier.showError("[VHP][getOrCreateVHFilePath] backlink has no associated file");
        return null;
      }

      vhFilePath = bl.file.path;
      console.log("[VHP][getOrCreateVHFilePath] Found from backlinks", vhFilePath, noteFilePathInVault);

    } else {
      let filePathInVault = `${VisitHistoryFocusListenerDefault.V1_VH_FOCUS_DIR}/_vh_${ulid()}.md`;

      vhFilePath = (await this.noteFileUtil.createNote(filePathInVault,
        `VISIT_HISTORY_V1_FOR:[[${noteFilePathInVault}]]\n` +
        "### VISIT_HISTORY_V1:\n")).path

      pathToVhPath.set(noteFilePathInVault, vhFilePath);

      console.log("[VHP][getOrCreateVHFilePath] CREATED for note", vhFilePath, noteFilePathInVault);
      console.log("[VHP][getOrCreateVHFilePath] AFTER_CREATE pathToVhPath=", Object.fromEntries(pathToVhPath.entries()));
    }

    return vhFilePath;
  }
};