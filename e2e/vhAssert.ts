// On-disk `.vh_v3` helpers: path building + bounded polling for the async append.
//
// All assertions in the suite read the real files the plugin writes — never plugin
// internals. Polling is BOUNDED and throws with the last-seen content on timeout, so
// a slow/absent write fails loudly instead of silently passing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICE_NAME, SESSION_LINE_RE, USER_NAME, VH_TOP_DIR } from './constants';

/** Full path of the per-doc session log inside a vault copy. */
export function vhFilePath(vaultDir: string, docId: string): string {
  return join(
    vaultDir,
    VH_TOP_DIR,
    'user',
    USER_NAME,
    'v3',
    'focus_duration_per_device',
    DEVICE_NAME,
    `${docId}.vh_v3`,
  );
}

export interface PollOptions {
  readonly timeoutMs: number;
  readonly intervalMs?: number;
}

/** Read the current file content, or `undefined` if the file does not exist yet. */
export function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/** All complete session lines currently in the file (empty if none/absent). */
export function sessionLines(file: string): string[] {
  const content = readIfExists(file);
  if (content === undefined) return [];
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => SESSION_LINE_RE.test(l));
}

export interface PollResult {
  readonly content: string;
  readonly lines: string[];
  /** First matched session line (guaranteed present — poll only resolves with ≥1 line). */
  readonly firstLine: string;
  readonly elapsedMs: number;
}

/**
 * Poll until the file contains at least one session line, or throw on timeout with
 * the last-seen content. Never a fixed sleep masking the append.
 */
export async function pollForSessionLine(file: string, opts: PollOptions): Promise<PollResult> {
  const interval = opts.intervalMs ?? 250;
  const start = Date.now();
  const deadline = start + opts.timeoutMs;
  let lastSeen = '(file absent)';
  for (;;) {
    const content = readIfExists(file);
    if (content !== undefined) {
      lastSeen = content;
      const lines = sessionLines(file);
      const firstLine = lines[0];
      if (firstLine !== undefined) {
        return { content, lines, firstLine, elapsedMs: Date.now() - start };
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `pollForSessionLine timed out after ${opts.timeoutMs}ms for ${file}\n` +
          `last-seen content: ${JSON.stringify(lastSeen)}`,
      );
    }
    await sleep(interval);
  }
}

/**
 * Assert a file records NO session line for the whole window: poll it repeatedly
 * and fail the moment a line appears. Unlike a single check after a sleep, this
 * catches a late append at any point in the window (the write is async), so a
 * dropped sub-threshold session is proven absent — not merely "not yet written".
 */
export async function assertNoSessionLineWithin(file: string, opts: PollOptions): Promise<void> {
  const interval = opts.intervalMs ?? 250;
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    const lines = sessionLines(file);
    if (lines.length > 0) {
      throw new Error(
        `expected no session line in ${file}, but found ${lines.length}: ${JSON.stringify(lines)}`,
      );
    }
    if (Date.now() >= deadline) return;
    await sleep(interval);
  }
}

/** Parse the integer duration (ms) from a `<stamp> D:<millis>` line. */
export function parseDurationMs(line: string): number {
  const m = line.trim().match(/ D:(\d+)$/);
  const digits = m?.[1];
  if (digits === undefined) throw new Error(`not a session line: ${JSON.stringify(line)}`);
  return Number.parseInt(digits, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
