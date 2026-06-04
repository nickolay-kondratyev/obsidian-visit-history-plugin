import { LinkUtil } from "../../core/util";
import { UserNotifier } from "../../core/util/userComm/UserNotifier";
import { TFile } from 'obsidian';
import { ulid } from 'ulid';
import { LRUCache } from 'lru-cache';
import { NoteFileUtil } from "../../core/util/file/note/NoteFileUtil";
import { DeviceNameProvider } from "../../core/util/env/DeviceNameProvider";
import { FocusFile } from "../data/FocusFile";

// Only cache paths for VH files that THIS plugin created. We intentionally
// do NOT cache backlink-resolved paths because the user may rename/move notes,
// which would make a cached path stale. Newly created VH files are safe to
// cache because their paths are stable ulid-based identifiers we control.
const createdVhPathCache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 1, // 1 min — short enough that a vault refactor is picked
  // up quickly if the user somehow deletes and recreates
  // a VH file manually
});

export class VHFileProvider {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil,
    private readonly deviceNameProvider: DeviceNameProvider) {
  }

  private static readonly V1_VH_FOCUS_DIR: string = "_visit_history/v1/focus";

  /** Gets all the Visit history V1 files if they exist (focus files). */
  async getAllVHFocusFiles(file: TFile): Promise<FocusFile[]> {
    const allBacklinks = this.linkUtil.getBacklinks(file);

    const vhBacklinks =
      allBacklinks
        .filter(bl =>
          bl.path.startsWith(VHFileProvider.V1_VH_FOCUS_DIR)
        );

    if (vhBacklinks.length === 0) return [];

    return vhBacklinks.map((bl) => {
      return new FocusFile(bl.file)
    });
  }

  /** Gets or Creates the VH file for this machine. */
  async getOrCreateVHFilePathForThisMachine(file: TFile): Promise<string | null> {
    const noteFilePathInVault = file.path;

    // Fast path: we previously created this VH file ourselves and cached the
    // result. Skip backlink querying and file creation entirely.
    const cachedVHPath = createdVhPathCache.get(noteFilePathInVault);
    if (cachedVHPath) {
      console.log("[VHP][getOrCreateVHFilePath] Found cached path", cachedVHPath);
      return cachedVHPath;
    }

    // Always re-query backlinks rather than caching the result. The user may
    // rename or move notes, and a stale cached path would silently log visits
    // to the wrong (or nonexistent) VH file.
    const allBacklinks = this.linkUtil.getBacklinks(file);
    const vhBacklinks =
      allBacklinks
        .filter(bl =>
          bl.path.startsWith(VHFileProvider.V1_VH_FOCUS_DIR)
          && bl.path.contains(this.deviceNameProvider.getDeviceName())
        );

    if (vhBacklinks === undefined) {
      this.userNotifier.showError("[VHP][getOrCreateVHFilePath] visit history backlinks are undefined");
      return null;
    }

    let vhFilePath: string;

    if (vhBacklinks.length > 0) {
      if (vhBacklinks.length > 1) {
        // Warn but don't crash — use the first one and let the user clean up.
        this.userNotifier.showError("More than one visit history backlink found for the file=" + noteFilePathInVault);
      }

      const bl = vhBacklinks[0];
      if (bl?.file === undefined) {
        this.userNotifier.showError("[VHP][getOrCreateVHFilePath] backlink has no associated file");
        return null;
      }

      vhFilePath = bl.file.path;
      console.log("[VHP][getOrCreateVHFilePath] Found from backlinks", vhFilePath, noteFilePathInVault);

      // Intentionally NOT writing to createdVhPathCache here. This path was
      // resolved via backlinks, meaning the user or a refactor tool controls
      // its location. We must re-derive it fresh each focus event.

    } else {
      // No existing VH file found — create one. Use a ulid so the filename is
      // unique, time-sortable, and not derived from the note title (which
      // could change). The backlink embedded in the file content is what ties
      // it to the source note.
      const filePathInVault = `${VHFileProvider.V1_VH_FOCUS_DIR}/${this.deviceNameProvider.getDeviceName()}/_vh_${ulid()}.md`;

      vhFilePath = (await this.noteFileUtil.createNote(
        filePathInVault,
        `VISIT_HISTORY_V1_FOR:[[${noteFilePathInVault}]]\n` +
        "### VISIT_HISTORY_V1:\n"
      )).path;

      // Cache only paths we created ourselves. We know these are stable
      // because we named them with a ulid — they won't move unless the user
      // manually intervenes, at which point the TTL will expire anyway.
      createdVhPathCache.set(noteFilePathInVault, vhFilePath);

      console.log("[VHP][getOrCreateVHFilePath] CREATED for note", vhFilePath, noteFilePathInVault);
      console.log("[VHP][getOrCreateVHFilePath] AFTER_CREATE createdVhPathCache=", Object.fromEntries(createdVhPathCache.entries()));
    }

    return vhFilePath;
  }

}