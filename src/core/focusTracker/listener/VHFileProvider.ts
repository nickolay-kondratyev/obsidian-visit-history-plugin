import { LinkUtil } from "../../util/linkUtil/LinkUtil";
import { UserNotifier } from "../../util/userComm/UserNotifier";
import { TFile } from 'obsidian';
import { ulid } from 'ulid';
import { LRUCache } from 'lru-cache';
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { DeviceNameProvider } from "../../util/env/DeviceNameProvider";
import { FocusFile } from "../data/FocusFile";

export class VHFileProvider {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil,
    private readonly deviceNameProvider: DeviceNameProvider) {
  }

  private static readonly V1_VH_FOCUS_DIR: string = "_visit_history/v1/focus";

  // Only cache paths for VH files that THIS plugin created. We intentionally
  // do NOT cache backlink-resolved paths because the user may rename/move notes,
  // which would make a cached path stale. Newly created VH files are safe to
  // cache because their paths are stable ulid-based identifiers we control.
  private readonly createdVhPathCache = new LRUCache<string, string>({
    max: 500,
    ttl: 1000 * 60 * 1, // 1 min — short enough that a vault refactor is picked
    // up quickly if the user somehow deletes and recreates
    // a VH file manually
  });

  /** Gets all the Visit history V1 files if they exist (focus files), across ALL devices. */
  async getAllVHFocusFiles(file: TFile): Promise<FocusFile[]> {
    return this.linkUtil.getBacklinks(file)
      .filter(bl => bl.path.startsWith(`${VHFileProvider.V1_VH_FOCUS_DIR}/`))
      .map(bl => new FocusFile(bl.file));
  }

  /** Gets or Creates the VH file for this machine. */
  async getOrCreateVHFilePathForThisMachine(file: TFile): Promise<string | null> {
    const noteFilePathInVault = file.path;

    // Fast path: we previously created this VH file ourselves and cached the
    // result. Skip backlink querying and file creation entirely.
    const cachedVHPath = this.createdVhPathCache.get(noteFilePathInVault);
    if (cachedVHPath) {
      return cachedVHPath;
    }

    // Always re-query backlinks rather than caching the result. The user may
    // rename or move notes, and a stale cached path would silently log visits
    // to the wrong (or nonexistent) VH file.
    //
    // Match the device as an exact directory segment — a substring match
    // would wrongly write into another device's file (e.g. device "mac"
    // matching ".../macbook-pro/...").
    const thisDeviceDir = `${VHFileProvider.V1_VH_FOCUS_DIR}/${this.deviceNameProvider.getDeviceName()}/`;
    const vhBacklinks = this.linkUtil.getBacklinks(file)
      .filter(bl => bl.path.startsWith(thisDeviceDir));

    if (vhBacklinks.length === 0) {
      return this.createVHFile(noteFilePathInVault, thisDeviceDir);
    }

    if (vhBacklinks.length > 1) {
      // Warn but don't crash — use the first one and let the user clean up.
      this.userNotifier.showError("More than one visit history backlink found for the file=" + noteFilePathInVault);
    }

    const vhFilePath = vhBacklinks[0]!.file.path;

    // Intentionally NOT writing to createdVhPathCache here. This path was
    // resolved via backlinks, meaning the user or a refactor tool controls
    // its location. We must re-derive it fresh each focus event.
    return vhFilePath;
  }

  // ── private ─────────────────────────────────────────────────────────────

  /**
   * Creates a new VH file. Uses a ulid so the filename is unique,
   * time-sortable, and not derived from the note title (which could change).
   * The backlink embedded in the file content is what ties it to the source note.
   */
  private async createVHFile(noteFilePathInVault: string, thisDeviceDir: string): Promise<string> {
    const filePathInVault = `${thisDeviceDir}_vh_${ulid()}.md`;

    const vhFilePath = (await this.noteFileUtil.createNote(
      filePathInVault,
      `VISIT_HISTORY_V1_FOR:[[${noteFilePathInVault}]]\n` +
      "### VISIT_HISTORY_V1:\n"
    )).path;

    // Cache only paths we created ourselves. We know these are stable
    // because we named them with a ulid — they won't move unless the user
    // manually intervenes, at which point the TTL will expire anyway.
    this.createdVhPathCache.set(noteFilePathInVault, vhFilePath);

    return vhFilePath;
  }
}
