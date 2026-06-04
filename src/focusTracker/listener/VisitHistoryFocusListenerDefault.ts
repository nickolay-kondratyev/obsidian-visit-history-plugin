import { FocusEvent, FocusListener } from "../FocusTracker";

import { NoteFileUtil } from "../../util/file/note/NoteFileUtil";
import { VHFileProvider } from "./VHFileProvider";


export class VisitHistoryFocusListenerDefault implements FocusListener {
  constructor(
    private readonly vhFileProvider: VHFileProvider,
    private readonly noteFileUtil: NoteFileUtil) {
  }


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
    const vhFilePath = await this.vhFileProvider.getOrCreateVHFilePath(event);
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
}