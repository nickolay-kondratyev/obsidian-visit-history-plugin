import { TFile } from 'obsidian';
import { LRUCache } from 'lru-cache';
import { VisitHistoryService } from '../VisitHistoryService';
import { DocIdService } from '../../docId/DocIdService';
import { DeviceNameProvider } from '../../../util/env/DeviceNameProvider';
import { VhV2FocusStore } from './VhV2FocusStore';
import { DocIdFilenameSafety } from '../DocIdFilenameSafety';

/**
 * V2 visit history: doc-id-keyed focus files under
 * `.visit_history/user/<user>/v2/focus_per_device/<device>/<doc-id>.vh_v2`
 * (format owned by VhV2FocusStore).
 */
export class VisitHistoryServiceV2 implements VisitHistoryService {
  constructor(
    private readonly docIdService: DocIdService,
    private readonly vhV2FocusStore: VhV2FocusStore,
    private readonly deviceNameProvider: DeviceNameProvider,
  ) {
  }

  // Cache to speed up retrieval of last visit metadata.
  // Values are wrapped in {value} so a cached "never visited" (null) result
  // stays distinguishable from a cache miss (LRUCache rejects nullish values).
  private readonly pathToLastVisit = new LRUCache<string, { value: number | null }>({
    // Set to high value as it will be of most use in very high note count vaults.
    max: 10000,
  });

  // Doc id of the most recently recorded visit.
  //
  // Dedup rule: skip recording only when the previous recorded visit went to
  // the SAME doc (Obsidian can fire several leaf-change events for one user
  // action). Intentionally NOT time-window based — navigation pathways
  // between notes (A → B → A) are interesting data and must stay fully
  // recorded; a time window would silently drop the second A.
  private lastRecordedDocId: string | null = null;

  /**
   * Drops all cached last-visit values. Called after V1→V2 migration lands
   * new stamps — values cached mid-migration would otherwise stay stale
   * (the cache has no TTL).
   */
  invalidateLastVisitCache(): void {
    this.pathToLastVisit.clear();
  }

  async getLastVisitStamp(file: TFile): Promise<number | null> {
    const path = file.path;
    const cached = this.pathToLastVisit.get(path);
    if (cached) {
      return cached.value;
    }

    // READ-ONLY id lookup: this runs for every vault file when the heatmap
    // aggregates — it must never write into user files.
    const docId = await this.docIdService.getDocId(file);
    const lastVisit = docId === null
      ? null
      : await this.vhV2FocusStore.getLastVisitMsAcrossUsersAndDevices(docId);

    this.pathToLastVisit.set(path, { value: lastVisit });
    return lastVisit;
  }

  async recordVisitNowOnFocus(file: TFile): Promise<void> {
    // ensureDocId (not getDocId): recording must work even when the doc id
    // listener hasn't persisted the id yet; for an already-id'd doc this is
    // a cheap cached read.
    const docId = await this.docIdService.ensureDocId(file);
    if (docId === null) {
      return;
    }
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      console.error(`[VHP][VisitHistoryServiceV2] doc id not filename-safe, visit not recorded path=[${file.path}] docId=[${docId}]`);
      return;
    }

    if (this.lastRecordedDocId !== docId) {
      const nowStamp = Date.now();
      await this.vhV2FocusStore.appendVisit(
        this.deviceNameProvider.getDeviceName(),
        docId,
        nowStamp,
      );
      this.pathToLastVisit.set(file.path, { value: nowStamp });
    }

    this.lastRecordedDocId = docId;
  }
}
