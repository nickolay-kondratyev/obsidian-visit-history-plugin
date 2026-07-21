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
 * Grace before an unfocus becomes a session close. In-canvas UI (card picker,
 * "add note") fires a transient active-leaf-change(null|untracked) → unfocus →
 * refocus; a same-doc refocus within this window continues the session instead
 * of splitting it. A close that does happen is stamped at the ORIGINAL unfocus
 * moment, so the grace can never inflate a duration. Fixed (no user setting —
 * owner decision).
 */
export const UNFOCUS_GRACE_MS = 10_000;

/**
 * Opaque identity of one Obsidian OS window (main or popout), compared by
 * reference. Callers use the window's `Document` object — stable for the
 * window's lifetime and reachable both from a leaf's `containerEl` and from
 * the DOM event boundary. Kept opaque so this class stays DOM-agnostic.
 */
export type WindowHandle = object;

/**
 * The subset of a browser Window's timer API the tracker needs, INJECTED so
 * the class stays DOM-agnostic (unit-testable in plain node) AND rule-clean:
 * `this.timers.setTimeout(...)` is a member call, whereas a bare setTimeout()
 * trips obsidianmd/prefer-window-timers. Production passes the MAIN Obsidian
 * window (which structurally satisfies this); tests pass the vitest fake clock.
 */
export interface WindowTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface CurrentDoc {
  docId: string;
  /** The window hosting the doc's leaf — sessions live and die with ITS focus. */
  windowHandle: WindowHandle;
}

interface ActiveSession {
  docId: string;
  startMs: number;
}

/** An unfocus awaiting its grace verdict: cancel (same-doc refocus) or close. */
interface PendingClose {
  /** Wall-clock arrival of the unfocus — gates grace expiry (timers can fire late after OS sleep). */
  unfocusedAtMs: number;
  /**
   * Session end to record if the close finalizes: the unfocus time, already
   * idle/sleep-capped. Resolved AT unfocus time so activity during grace
   * cannot erase a pre-unfocus sleep gap (a session can never include a
   * sleep/idle gap — see class doc), and so the end is deterministic under a
   * live mid-grace idle-timeout settings change.
   */
  cappedEndMs: number;
}

/**
 * V3 focus-duration state machine (Obsidian-agnostic).
 *
 * A session = one continuous stretch of attention on one document. It opens
 * when a tracked doc is focused while ITS OS window (main or popout) is
 * focused, and CLOSES — emitting exactly one sink record — on the first of:
 *  - the user navigates to another doc (or to an untracked view), after a
 *    fixed UNFOCUS_GRACE_MS grace: a same-doc refocus within grace continues
 *    the session (transient canvas-UI blips don't split it); an actual close
 *    is stamped at the ORIGINAL unfocus moment, so grace never inflates a
 *    duration,
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
  // `unknown` already admits null — no `| null` (it'd be a redundant union);
  // null still means "no timer armed" (see the checks below).
  private idleTimer: unknown = null;
  // Invariants: pendingClose !== null ⇒ session !== null (pending is created
  // only on unfocus of an open session; every close path with a pending goes
  // through finalizePendingClose, which clears both). graceTimer !== null ⇔
  // pendingClose !== null.
  private pendingClose: PendingClose | null = null;
  private graceTimer: unknown = null;

  constructor(
    private readonly sink: FocusDurationSink,
    private readonly getIdleTimeoutMs: IdleTimeoutMsProvider,
    private readonly timers: WindowTimers,
  ) {
  }

  onDocFocused(docId: string, windowHandle: WindowHandle): void {
    // Timers can fire late (OS sleep suspends them): a pending close whose
    // grace already expired in WALL-CLOCK time must never be cancelled —
    // finalize it first so a post-sleep refocus starts a FRESH session
    // instead of resurrecting one that would span the sleep gap.
    if (
      this.pendingClose !== null
      && Date.now() - this.pendingClose.unfocusedAtMs >= UNFOCUS_GRACE_MS
    ) {
      this.finalizePendingClose();
    }
    if (this.session?.docId === docId) {
      // A same-doc refocus within grace: the unfocus was a transient blip
      // (in-canvas picker/modal) — forgive it, the session continues and the
      // gap counts as focus time (owner decision).
      this.cancelPendingClose();
      // Obsidian fires several leaf-change events for one user action — an
      // already-running session for the same doc must not be fragmented.
      // Still adopt the (possibly new) hosting window: a tab dragged out to
      // a popout keeps its session but lives in that window from now on.
      this.currentDoc = { docId, windowHandle };
      return;
    }
    // A DIFFERENT doc resolves the grace: the old session closes at its
    // ORIGINAL unfocus time before the normal new-focus flow below.
    this.finalizePendingClose();
    // Defense in depth: FocusTracker dispatches unfocus before a new focus,
    // but a missed unfocus must never merge two docs' sessions.
    this.endSession(Date.now());
    this.currentDoc = { docId, windowHandle };
    if (this.focusedWindows.has(windowHandle)) {
      this.startSession(docId);
    }
  }

  /**
   * Marks the open session pending-close instead of closing it immediately:
   * the grace timer (UNFOCUS_GRACE_MS) decides. The eventual close — grace
   * expiry, different-doc focus, idle, or dispose — ends at THIS unfocus
   * moment; a same-doc refocus within grace cancels the close entirely.
   */
  onDocUnfocused(): void {
    if (this.session === null) {
      this.endSession(Date.now());
      this.currentDoc = null;
      return;
    }
    if (this.pendingClose !== null) {
      // Redundant unfocus while one is already pending (listener id-failure
      // path): the FIRST unfocus timestamp stays authoritative.
      return;
    }
    const now = Date.now();
    this.pendingClose = { unfocusedAtMs: now, cappedEndMs: this.idleCappedEndMs(now) };
    this.armGraceTimer();
  }

  onWindowBlurred(windowHandle: WindowHandle): void {
    this.focusedWindows.delete(windowHandle);
    if (this.pendingClose !== null) {
      // While a close is pending its end is already pinned at the unfocus
      // moment — a blur can't inflate anything, and closing here would
      // defeat grace for blips that ALSO blur the window (native-OS-surface
      // pickers). The grace timer decides.
      return;
    }
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
      if (this.pendingClose !== null) {
        // The pinned unfocus end wins — it is already idle-capped as of the
        // unfocus moment.
        this.finalizePendingClose();
      } else {
        this.endSession(this.lastActivityMs);
      }
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
    // A pending close flushes at its ORIGINAL unfocus time — never lost,
    // never inflated to unload time.
    this.finalizePendingClose();
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
    const effectiveEndMs = this.idleCappedEndMs(endMs);
    const { docId, startMs } = this.session;
    this.session = null;
    this.sink.recordFocusDuration(docId, startMs, Math.max(0, effectiveEndMs - startMs));
  }

  private armIdleTimer(delayMs: number): void {
    this.clearIdleTimer();
    this.idleTimer = this.timers.setTimeout(() => this.onIdleTimerFired(), delayMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      this.timers.clearTimeout(this.idleTimer);
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
      if (this.pendingClose !== null) {
        // Idle confirmed while a close is pending: the pinned unfocus end
        // wins — activity during grace was on an unfocused doc and must not
        // extend the end.
        this.finalizePendingClose();
        return;
      }
      // currentDoc intentionally stays set — the next interaction or window
      // refocus starts a NEW session for the same document.
      this.endSession(this.lastActivityMs);
    } else {
      this.armIdleTimer(idleTimeoutMs - idleForMs);
    }
  }

  /**
   * Retroactive idle/sleep cutoff: an end past the idle timeout since the
   * last interaction is pulled back to that interaction (sleep gaps never
   * count).
   */
  private idleCappedEndMs(endMs: number): number {
    return endMs - this.lastActivityMs >= this.getIdleTimeoutMs() ? this.lastActivityMs : endMs;
  }

  /** Closes the pending session at its pinned unfocus end; no-op when none. */
  private finalizePendingClose(): void {
    if (this.pendingClose === null) {
      return;
    }
    const { cappedEndMs } = this.pendingClose;
    this.pendingClose = null;
    this.clearGraceTimer();
    // Re-cap inside endSession is a safe backstop: it can only pull the end
    // earlier (live idle-timeout shrink), never later.
    this.endSession(cappedEndMs);
    // The doc really is gone — a later window refocus must not revive it.
    this.currentDoc = null;
  }

  /** Forgives the pending unfocus (same-doc refocus); no-op when none. */
  private cancelPendingClose(): void {
    this.pendingClose = null;
    this.clearGraceTimer();
  }

  private armGraceTimer(): void {
    this.clearGraceTimer();
    this.graceTimer = this.timers.setTimeout(() => this.onGraceTimerFired(), UNFOCUS_GRACE_MS);
  }

  private clearGraceTimer(): void {
    if (this.graceTimer !== null) {
      this.timers.clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  private onGraceTimerFired(): void {
    this.graceTimer = null;
    // Guarded no-op if the pending close was already cancelled/finalized.
    this.finalizePendingClose();
  }
}
