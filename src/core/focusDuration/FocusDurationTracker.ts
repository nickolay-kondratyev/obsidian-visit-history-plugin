/** Receives completed focus sessions. Implementations must never throw. */
export interface FocusDurationSink {
  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void;
}

interface ActiveSession {
  docId: string;
  startMs: number;
}

/**
 * V3 focus-duration state machine (Obsidian-agnostic).
 *
 * A session = one continuous stretch of attention on one document. It opens
 * when a tracked doc is focused while the window is focused, and CLOSES —
 * emitting exactly one sink record — on the first of:
 *  - the user navigates to another doc (or to an untracked view),
 *  - the Obsidian window loses focus,
 *  - IDLE_TIMEOUT_MS passes without any user interaction; the recorded
 *    duration then ends at the LAST interaction (owner decision — the idle
 *    tail is not counted),
 *  - dispose() (plugin unload) — best-effort flush.
 *
 * After a window blur or idle close, the document stays "current": window
 * refocus or a new interaction opens a fresh session for the same doc.
 *
 * Idle detection is cheap under mousemove storms: activity only updates
 * lastActivityMs; the single timer re-arms itself for the remainder instead
 * of being reset per event.
 */
export class FocusDurationTracker {
  static readonly IDLE_TIMEOUT_MS = 3 * 60 * 1000;

  /** Doc shown in the active leaf — outlives sessions closed by blur/idle. */
  private currentDocId: string | null = null;
  private windowFocused = true;
  private session: ActiveSession | null = null;
  private lastActivityMs = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly sink: FocusDurationSink) {
  }

  onDocFocused(docId: string): void {
    if (this.session?.docId === docId) {
      // Obsidian fires several leaf-change events for one user action —
      // an already-running session for the same doc must not be fragmented.
      return;
    }
    // Same-leaf navigation changes the file WITHOUT an unfocus event —
    // closing any running session here covers that pathway.
    this.endSession(Date.now());
    this.currentDocId = docId;
    if (this.windowFocused) {
      this.startSession(docId);
    }
  }

  onDocUnfocused(): void {
    this.endSession(Date.now());
    this.currentDocId = null;
  }

  onWindowBlurred(): void {
    if (!this.windowFocused) {
      return;
    }
    this.windowFocused = false;
    this.endSession(Date.now());
  }

  onWindowFocused(): void {
    if (this.windowFocused) {
      return;
    }
    this.windowFocused = true;
    if (this.currentDocId !== null) {
      this.startSession(this.currentDocId);
    }
  }

  onUserActivity(): void {
    this.lastActivityMs = Date.now();
    // Idle resume: interaction re-opens a session for the still-current doc.
    if (this.windowFocused && this.currentDocId !== null && this.session === null) {
      this.startSession(this.currentDocId);
    }
  }

  /** Best-effort flush on plugin unload: closes any open session. */
  dispose(): void {
    this.endSession(Date.now());
    this.currentDocId = null;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private startSession(docId: string): void {
    const now = Date.now();
    this.session = { docId, startMs: now };
    this.lastActivityMs = now;
    this.armIdleTimer(FocusDurationTracker.IDLE_TIMEOUT_MS);
  }

  /** Emits the sink record and clears the session; no-op when none is open. */
  private endSession(endMs: number): void {
    this.clearIdleTimer();
    if (this.session === null) {
      return;
    }
    const { docId, startMs } = this.session;
    this.session = null;
    this.sink.recordFocusDuration(docId, startMs, Math.max(0, endMs - startMs));
  }

  private armIdleTimer(delayMs: number): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.onIdleTimerFired(), delayMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private onIdleTimerFired(): void {
    this.idleTimer = null;
    if (this.session === null) {
      return;
    }
    const idleForMs = Date.now() - this.lastActivityMs;
    if (idleForMs >= FocusDurationTracker.IDLE_TIMEOUT_MS) {
      // currentDocId intentionally stays set — the next interaction or
      // window refocus starts a NEW session for the same document.
      this.endSession(this.lastActivityMs);
    } else {
      this.armIdleTimer(FocusDurationTracker.IDLE_TIMEOUT_MS - idleForMs);
    }
  }
}
