import { StampLineParser } from '../../../util/time/StampLineParser';

/** One completed focus session parsed from a `.vh_v3` line. */
export interface VhV3FocusSession {
  /** Epoch ms of when focus started (the ISO stamp of the line). */
  focusStartEpochMs: number;
  /** Millis spent in focus during the session. */
  durationMs: number;
}

// `<ISO 8601 UTC ms stamp> D:<millis>` e.g. `2026-07-09T22:02:15.745Z D:5600`
// (format owned by VhV3DurationStore — its appendFocusDuration writes it).
// Millis must be a plain non-negative integer; the ISO part is validated
// strictly by StampLineParser. Anything else is not a session line.
const SESSION_LINE_PATTERN = /^(\S+) D:(\d+)$/;

/**
 * Strict parser for single V3 session lines. Unparseable lines yield null —
 * callers skip them, never throw (one bad file must not break aggregation).
 */
export class VhV3SessionLineParser {
  static parseSession(rawLine: string): VhV3FocusSession | null {
    const match = SESSION_LINE_PATTERN.exec(rawLine.trim());
    if (match === null) {
      return null;
    }
    const [, isoStamp, millisDigits] = match;
    if (isoStamp === undefined || millisDigits === undefined) {
      return null;
    }
    const focusStartEpochMs = StampLineParser.parseIsoMs(isoStamp);
    if (focusStartEpochMs === null) {
      return null;
    }
    return { focusStartEpochMs, durationMs: Number(millisDigits) };
  }
}
