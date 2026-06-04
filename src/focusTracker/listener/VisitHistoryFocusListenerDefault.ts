import { FocusEvent, FocusListener } from "../FocusTracker";
import { LinkUtil } from "../../util";
import { UserNotifier } from "../../util/userComm/UserNotifier";
import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { ulid } from 'ulid';
import { LRUCache } from 'lru-cache';

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


export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly linkUtil: LinkUtil,
    private readonly userNotifier: UserNotifier,
    private readonly noteFileUtil: NoteFileUtil) {
  }

  private static readonly V1_VH_FOCUS_DIR: string = "_visit_history/v1/focus";

  private lastRecordedVhPath: string = "I_DONT_EXIST_PATH";

  // Tracks in-flight onFocus executions keyed by note path.
  //
  // Problem this solves: focus events can fire rapidly (e.g. switching tabs,
  // Obsidian internals triggering multiple events for one user action). Each
  // onFocus call is async and yields at awaits, so without this guard a second
  // call can interleave with the first — resulting in duplicate VH file
  // creation or double-writes to the same VH file.
  //
  // We use DROP semantics: if an onFocus is already running for a given path,
  // the new call exits immediately. We do NOT await the in-flight promise
  // because that would still trigger a second write once the first finishes.
  // A dropped focus event is acceptable — the first one already recorded the
  // visit.
  private readonly inFlightFocus = new Map<string, Promise<void>>();

  async onFocus(event: FocusEvent): Promise<void> {
    // Guard against events with no file path — nothing meaningful we can do.
    if (!event.file?.path) {
      console.log("[VHP][onFocus] Dropping focus event with no file path");
      return;
    }

    const noteFilePathInVault = event.file.path;

    // Drop duplicate: an onFocus for this file is already running. Any work
    // we would do here (VH file creation, appending a timestamp) would either
    // race the in-flight call or double-write. Skip it.
    if (this.inFlightFocus.has(noteFilePathInVault)) {
      console.log("[VHP][onFocus] Dropping duplicate focus event for", noteFilePathInVault);
      return;
    }

    // Register before the first await inside _doOnFocus so any concurrent
    // call that reaches this point sees the in-flight entry immediately.
    const promise = this._doOnFocus(event);
    this.inFlightFocus.set(noteFilePathInVault, promise);
    try {
      await promise;
    } finally {
      // Always clean up so future focus events for this path are processed
      // normally, regardless of whether _doOnFocus succeeded or threw.
      this.inFlightFocus.delete(noteFilePathInVault);
    }
  }

  private async _doOnFocus(event: FocusEvent): Promise<void> {
    const vhFilePath = await this.getOrCreateVHFilePath(event);
    if (vhFilePath === null) {
      return;
    }

    if (this.lastRecordedVhPath === vhFilePath) {
      console.log("[VHP] Skip — last focus was already the same file.");
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

  private async getOrCreateVHFilePath(event: FocusEvent): Promise<string | null> {
    const noteFilePathInVault = event.file.path;
    console.log("[VHP][getOrCreateVHFilePath] AT_START createdVhPathCache=", Object.fromEntries(createdVhPathCache.entries()));

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
      const filePathInVault = `${VisitHistoryFocusListenerDefault.V1_VH_FOCUS_DIR}/_vh_${ulid()}.md`;

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