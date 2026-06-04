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

  // Tracks in-flight VH file creation promises keyed by note path.
  //
  // Problem this solves: JS is single-threaded but async functions yield at
  // every `await`, allowing the event loop to run other callbacks. If two
  // `onFocus` events fire in rapid succession for the same note, both calls
  // can pass the cache-miss check before either has finished creating the VH
  // file, resulting in two VH files for the same note.
  //
  // Fix: before spawning a creation, we register its promise here. Any
  // concurrent call for the same key finds the existing promise and awaits it
  // instead of starting a second creation. The entry is deleted once the
  // promise settles, so future calls (after creation) fall through to the LRU
  // cache hit as normal.
  private readonly inFlight = new Map<string, Promise<string | null>>();

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
    const noteFilePathInVault = event.file.path;
    console.log("[VHP][getOrCreateVHFilePath] AT_START createdVhPathCache=", Object.fromEntries(createdVhPathCache.entries()));

    // Fast path: we previously created this VH file ourselves and cached the
    // result. Skip backlink querying and file creation entirely.
    const cachedVHPath = createdVhPathCache.get(noteFilePathInVault);
    if (cachedVHPath) {
      console.log("[VHP][getOrCreateVHFilePath] Found cached path", cachedVHPath);
      return cachedVHPath;
    }

    // Dedup path: another onFocus call for the same note is already in the
    // middle of creating a VH file (it's suspended at an `await` inside
    // _doGetOrCreate). Attach to that promise instead of racing it.
    const existingPromise = this.inFlight.get(noteFilePathInVault);
    if (existingPromise) {
      console.log("[VHP][getOrCreateVHFilePath] Awaiting in-flight promise for", noteFilePathInVault);
      return existingPromise;
    }

    // Slow path: no cache hit, no in-flight work. Kick off resolution and
    // register the promise synchronously BEFORE the first await inside
    // _doGetOrCreate. This is the critical ordering — if we awaited first and
    // registered after, the window between the two would still allow a race.
    const promise = this._doGetOrCreate(event);
    this.inFlight.set(noteFilePathInVault, promise);
    try {
      return await promise;
    } finally {
      // Always clean up regardless of success or error, so future calls
      // go through the normal cache/backlink flow rather than re-attaching
      // to a settled (and now stale) promise.
      this.inFlight.delete(noteFilePathInVault);
    }
  }

  private async _doGetOrCreate(event: FocusEvent): Promise<string | null> {
    const noteFilePathInVault = event.file.path;

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
      // resolved via backlinks, which means the user or a refactor tool
      // controls its location. We must re-derive it fresh each focus event.

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

      // Cache only the paths we created ourselves. We know these are stable
      // because we named them with a ulid — they won't move unless the user
      // manually intervenes, at which point the cache TTL will expire anyway.
      createdVhPathCache.set(noteFilePathInVault, vhFilePath);

      console.log("[VHP][getOrCreateVHFilePath] CREATED for note", vhFilePath, noteFilePathInVault);
      console.log("[VHP][getOrCreateVHFilePath] AFTER_CREATE createdVhPathCache=", Object.fromEntries(createdVhPathCache.entries()));
    }

    return vhFilePath;
  }
}