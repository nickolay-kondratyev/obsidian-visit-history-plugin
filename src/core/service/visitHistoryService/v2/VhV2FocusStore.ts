import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { StampLineParser } from '../../../util/time/StampLineParser';
import { VhV2Paths } from './VhV2Paths';

/**
 * Owns the on-disk V2 focus format: one file per (device, doc id) holding one
 * ISO 8601 UTC stamp (millisecond precision) per line, newline-terminated,
 * sorted ascending, exact-duplicate-free.
 *
 * Reading never throws on malformed content — unparseable lines are skipped
 * so one bad file cannot break aggregation.
 *
 * Callers must pre-validate ids with VhV2Paths.isFilenameSafeId; write
 * methods throw on unsafe ids (programming error), read methods treat them
 * as "no file".
 */
export class VhV2FocusStore {
  constructor(private readonly hiddenFileUtil: HiddenFileUtil) {
  }

  /** Appends one visit stamp for this device's doc file (creates it when absent). */
  async appendVisit(deviceName: string, docId: string, epochMs: number): Promise<void> {
    this.assertSafeId(docId);
    await this.hiddenFileUtil.append(
      VhV2Paths.focusFilePath(deviceName, docId),
      new Date(epochMs).toISOString() + '\n',
    );
  }

  /** All stamps (epoch ms) recorded for the doc on one device; [] when absent. */
  async readStampsMs(deviceName: string, docId: string): Promise<number[]> {
    if (!VhV2Paths.isFilenameSafeId(docId)) {
      return [];
    }
    const content = await this.hiddenFileUtil.readIfExists(
      VhV2Paths.focusFilePath(deviceName, docId),
    );
    if (content === null) {
      return [];
    }
    return content
      .split('\n')
      .map(line => StampLineParser.parseIsoMs(line))
      .filter((ms): ms is number => ms !== null);
  }

  /**
   * Overwrites the doc's file for one device with the given stamps,
   * normalized to the format invariants (sorted ascending, deduplicated).
   * Used by V1→V2 migration; live recording uses appendVisit.
   */
  async writeStampsMs(deviceName: string, docId: string, epochMsList: number[]): Promise<void> {
    this.assertSafeId(docId);
    const normalized = [...new Set(epochMsList)].sort((a, b) => a - b);
    const content = normalized.map(ms => new Date(ms).toISOString() + '\n').join('');
    await this.hiddenFileUtil.write(VhV2Paths.focusFilePath(deviceName, docId), content);
  }

  /** Most recent stamp for the doc across ALL devices, or null if never visited. */
  async getLastVisitMsAcrossDevices(docId: string): Promise<number | null> {
    const deviceNames = await this.hiddenFileUtil.listSubfolderNames(
      VhV2Paths.FOCUS_PER_DEVICE_DIR,
    );
    const stampsPerDevice = await Promise.all(
      deviceNames.map(deviceName => this.readStampsMs(deviceName, docId)),
    );
    const allStamps = stampsPerDevice.flat();
    return allStamps.length > 0 ? Math.max(...allStamps) : null;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private assertSafeId(docId: string): void {
    if (!VhV2Paths.isFilenameSafeId(docId)) {
      throw new Error(`Doc id is not filename-safe docId=[${docId}]`);
    }
  }
}
