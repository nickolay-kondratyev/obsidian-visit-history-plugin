import { TFile } from 'obsidian';
import { LastVisitProvider } from '../LastVisitProvider';
import { DocIdService } from 'obsidian-id-lib';
import { VhV3DurationStore } from './VhV3DurationStore';
import { LastVisitCache } from './LastVisitCache';

/**
 * LastVisitProvider backed by V3 focus-duration files: last visit = most
 * recent session START stamp across ALL users and devices (matches the old V2
 * semantics, where the stamp was recorded at focus time).
 */
export class VisitHistoryServiceV3 implements LastVisitProvider {
  constructor(
    private readonly docIdService: DocIdService,
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly lastVisitCache: LastVisitCache,
  ) {
  }

  async getLastVisitStamp(file: TFile): Promise<number | null> {
    // READ-ONLY id lookup: this runs for every vault file when the heatmap
    // aggregates — it must never write into user files.
    const docId = await this.docIdService.getDocId(file);
    if (docId === null) {
      return null;
    }

    const cached = this.lastVisitCache.get(docId);
    if (cached) {
      return cached.value;
    }

    const diskMs = await this.vhV3DurationStore.getLastFocusStartMsAcrossUsersAndDevices(docId);
    // A recorder write-through can land WHILE we read from disk; caching the
    // (possibly older) disk value blindly would lose it — merge by max.
    const racedInMs = this.lastVisitCache.get(docId)?.value ?? null;
    const lastVisitMs = diskMs === null || racedInMs === null
      ? diskMs ?? racedInMs
      : Math.max(diskMs, racedInMs);
    // "Never visited" (null) is cached too — absence of files is just as
    // expensive to establish as presence.
    this.lastVisitCache.set(docId, lastVisitMs);
    return lastVisitMs;
  }
}
