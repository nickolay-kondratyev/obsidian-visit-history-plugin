/** Receives completed focus sessions. Implementations must never throw. */
export interface FocusDurationSink {
  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void;
}

/**
 * Supplies the CURRENT idle timeout in ms (user-configurable in settings,
 * default 180 s). Read at every idle decision so settings changes apply live,
 * without plugin reload.
 */
export type IdleTimeoutMsProvider = () => number;

/**
 * Opaque identity of one Obsidian OS window (main or popout), compared by
 * reference. Callers use the window's `Document` object — stable for the
 * window's lifetime and reachable both from a leaf's `containerEl` and from
 * the DOM event boundary. Kept opaque so this class stays DOM-agnostic.
 */
export type WindowHandle = object;

interface CurrentDoc {
  docId: string;
  /** The window hosting the doc's leaf — sessions live and die with ITS focus. */
  windowHandle: WindowHandle;
}

interface ActiveSession {
  docId: string;
  startMs: number;
}

/**
 * V3 focus-duration state machine (Obsidian-agnostic).
 *
 * A session = one continuous stretch of attention on one document. It opens
 * when a tracked doc is focused while ITS OS window (main or popout) is
 * focused, and CLOSES — emitting exactly one sink record — on the first of:
 *  - the user navigates to another doc (or to an untracked view),
 *  - the window HOSTING the doc loses OS focus (incl. switching to another
 *    Obsidian popout window),
 *  - the idle timeout (IdleTimeoutMsProvider) passes without any user
 *    interaction; the recorded duration then ends at the LAST interaction
 *    (owner decision — the idle tail is not counted). Enforced retroactively
 *    too (OS sleep suspends timers) — a session can never include a
 *    sleep/idle gap,
 *  - dispose() (plugin unload) — best-effort flush.
 *
 * After a window blur or idle close, the document stays "current": refocusing
 * its window or a new interaction opens a fresh session for the same doc.
 * A doc MOVED to another window (tab dragged out) keeps its session — only
 * the hosting window updates.
 *
 * Idle detection is cheap under mousemove storms: activity only updates
 * lastActivityMs; the single timer re-arms itself for the remainder instead
 * of being reset per event.
 */
export class FocusDurationTracker {
  /** Doc shown in the active leaf — outlives sessions closed by blur/idle. */
  private currentDoc: CurrentDoc | null = null;
  /** OS-focused Obsidian windows. Multiple only transiently (event ordering). */
  private readonly focusedWindows = new Set<WindowHandle>();
  private session: ActiveSession | null = null;
  private lastActivityMs = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sink: FocusDurationSink,
    private readonly getIdleTimeoutMs: IdleTimeoutMsProvider,
  ) {
  }

  onDocFocused(docId: string, windowHandle: WindowHandle): void {
    if (this.session?.docId === docId) {
      // Obsidian fires several leaf-change events for one user action — an
      // already-running session for the same doc must not be fragmented.
      // Still adopt the (possibly new) hosting window: a tab dragged out to
      // a popout keeps its session but lives in that window from now on.
      this.currentDoc = { docId, windowHandle };
      return;
    }
    // Same-leaf navigation changes the file WITHOUT an unfocus event —
    // closing any running session here covers that pathway.
    this.endSession(Date.now());
    this.currentDoc = { docId, windowHandle };
    if (this.focusedWindows.has(windowHandle)) {
      this.startSession(docId);
    }
  }

  onDocUnfocused(): void {
    this.endSession(Date.now());
    this.currentDoc = null;
  }

  onWindowBlurred(windowHandle: WindowHandle): void {
    this.focusedWindows.delete(windowHandle);
    // Close when the doc's OWN window blurred (covers popout → popout
    // switches), or when no Obsidian window is focused at all (drift safety).
    if (this.currentDoc?.windowHandle === windowHandle || this.focusedWindows.size === 0) {
      this.endSession(Date.now());
    }
  }

  onWindowFocused(windowHandle: WindowHandle): void {
    this.focusedWindows.add(windowHandle);
    // Reopen only when the focused window is the one HOSTING the current doc
    // — focusing an unrelated popout must not revive another window's doc.
    if (this.session === null && this.currentDoc?.windowHandle === windowHandle) {
      this.startSession(this.currentDoc.docId);
    }
  }

  onUserActivity(): void {
    const now = Date.now();
    if (this.session !== null && now - this.lastActivityMs >= this.getIdleTimeoutMs()) {
      // The idle timeout elapsed without the timer firing (OS sleep suspends
      // timers): enforce the idle close retroactively before stamping this
      // interaction, or the sleep gap would count as focus time.
      this.endSession(this.lastActivityMs);
    }
    this.lastActivityMs = now;
    // Idle resume: interaction re-opens a session for the still-current doc,
    // provided its hosting window is focused.
    if (
      this.session === null
      && this.currentDoc !== null
      && this.focusedWindows.has(this.currentDoc.windowHandle)
    ) {
      this.startSession(this.currentDoc.docId);
    }
  }

  /** Best-effort flush on plugin unload: closes any open session. */
  dispose(): void {
    this.endSession(Date.now());
    this.currentDoc = null;
    this.focusedWindows.clear();
  }

  // ── private ─────────────────────────────────────────────────────────────

  private startSession(docId: string): void {
    const now = Date.now();
    this.session = { docId, startMs: now };
    this.lastActivityMs = now;
    this.armIdleTimer(this.getIdleTimeoutMs());
  }

  /** Emits the sink record and clears the session; no-op when none is open. */
  private endSession(endMs: number): void {
    this.clearIdleTimer();
    if (this.session === null) {
      return;
    }
    // Sleep safety net: if the idle timeout elapsed without the timer firing
    // (OS sleep suspends timers), apply the idle cutoff here — the session
    // ends at the last interaction, never counting the gap. Normal closes
    // (gap < timeout) are untouched.
    const effectiveEndMs = endMs - this.lastActivityMs >= this.getIdleTimeoutMs()
      ? this.lastActivityMs
      : endMs;
    const { docId, startMs } = this.session;
    this.session = null;
    this.sink.recordFocusDuration(docId, startMs, Math.max(0, effectiveEndMs - startMs));
  }

  private armIdleTimer(delayMs: number): void {
    this.clearIdleTimer();
    // WHY-NOT window.setTimeout: the idle timer is app-wide logic, not tied
    // to any (popout) window's lifetime, and this class stays DOM-agnostic
    // so it is unit-testable in a plain node environment.
    // eslint-disable-next-line obsidianmd/prefer-window-timers
    this.idleTimer = setTimeout(() => this.onIdleTimerFired(), delayMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      // eslint-disable-next-line obsidianmd/prefer-window-timers -- see armIdleTimer
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private onIdleTimerFired(): void {
    this.idleTimer = null;
    if (this.session === null) {
      return;
    }
    // Read the CURRENT timeout — a settings change applies from this check on.
    const idleTimeoutMs = this.getIdleTimeoutMs();
    const idleForMs = Date.now() - this.lastActivityMs;
    if (idleForMs >= idleTimeoutMs) {
      // currentDoc intentionally stays set — the next interaction or window
      // refocus starts a NEW session for the same document.
      this.endSession(this.lastActivityMs);
    } else {
      this.armIdleTimer(idleTimeoutMs - idleForMs);
    }
  }
}
