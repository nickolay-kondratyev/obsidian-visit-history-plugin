import type { VaultUtil } from '../core/util/vault/VaultUtil';
import type { HeatmapConfig } from '../viewModel/heatmapConfig';
import { buildLeafNode } from '../viewModel/buildVaultTree';
import { LeafColorRule } from '../viewModel/LeafColorRule';
import type { VisitHistoryChangeNotifier } from './VisitHistoryChangeNotifier';
import type { FileColorV1, VisitHistoryApi, VisitStatsV1 } from './VisitHistoryApi';

/**
 * The public API over the SAME read path the heatmap uses: tracked-ness and
 * time metadata from {@link VaultUtil.getTrackedFile} (doc ids via the
 * read-only `getDocId` — never `ensureDocId`), leaf fields from
 * {@link buildLeafNode}, color from {@link LeafColorRule}. Read-only by
 * construction: none of its dependencies can write.
 */
export class VisitHistoryApiDefault implements VisitHistoryApi {
  constructor(
    private readonly vaultUtil: VaultUtil,
    /** LIVE heatmap config (`settings.heatmap`) — read per call, never cached. */
    private readonly currentHeatmapConfig: () => HeatmapConfig,
    private readonly changeNotifier: VisitHistoryChangeNotifier,
  ) {
  }

  async getFileColorV1(path: string): Promise<FileColorV1 | undefined> {
    const trackedFile = await this.vaultUtil.getTrackedFile(path);
    const leaf = trackedFile === undefined ? undefined : buildLeafNode(trackedFile);
    if (leaf === undefined) return undefined;
    const settings = LeafColorRule.settingsOf(this.currentHeatmapConfig());
    const { fill, hasData } = LeafColorRule.baseColor(leaf, settings, Date.now());
    return { fill, hasData };
  }

  async getVisitStatsV1(path: string): Promise<VisitStatsV1 | undefined> {
    const trackedFile = await this.vaultUtil.getTrackedFile(path);
    if (trackedFile === undefined) return undefined;
    const { visitedMs, totalFocusMs } = trackedFile.timeMetadata;
    return { lastVisitMs: visitedMs, totalFocusMs };
  }

  onChangeV1(callback: () => void): () => void {
    return this.changeNotifier.subscribe(callback);
  }
}
