import { describe, expect, it } from 'vitest';
import type { App, TFile } from 'obsidian';
import { VaultUtilDefault } from './VaultUtil';
import { IsTrackedProviderDefault } from './IsTrackedProvider';
import type { VisitStatsProvider } from '../../service/visitHistoryService/VisitStatsProvider';
import { VisitStats } from '../../service/visitHistoryService/VisitStats';
import { makeTFile } from '../../../testSupport/fileFactory';

/** GIVEN a vault holding exactly these files (system-boundary App stub). */
function makeVaultUtil(files: TFile[], visitStats: VisitStats = VisitStats.EMPTY): VaultUtilDefault {
  const app = {
    vault: {
      getName: () => 'test-vault',
      getFiles: () => files,
      getFileByPath: (path: string) => files.find(f => f.path === path) ?? null,
    },
  } as unknown as App;
  const visitStatsProvider: VisitStatsProvider = {
    getVisitStats: async () => visitStats,
  };
  return new VaultUtilDefault(app, visitStatsProvider, new IsTrackedProviderDefault());
}

describe('VaultUtilDefault', () => {
  describe('getTrackedTFiles', () => {
    it('should return exactly the tracked-filtered files', () => {
      // GIVEN tracked files next to an untracked extension and a legacy VH file
      const tracked = makeTFile({ path: 'notes/a.md' });
      const canvas = makeTFile({ path: 'b.canvas' });
      const untracked = makeTFile({ path: 'c.pdf' });
      const legacyVh = makeTFile({ path: '_visit_history/x.md' });
      const vaultUtil = makeVaultUtil([tracked, canvas, untracked, legacyVh]);
      // WHEN enumerating
      const files = vaultUtil.getTrackedTFiles();
      // THEN only the tracked ones come back
      expect(files.map(f => f.path)).toEqual(['notes/a.md', 'b.canvas']);
    });
  });

  describe('getTrackedFiles', () => {
    it('should return the same tracked set enriched with time metadata', async () => {
      // GIVEN one tracked and one untracked file
      const tracked = makeTFile({ path: 'a.md', ctime: 11, mtime: 22 });
      const vaultUtil = makeVaultUtil([tracked, makeTFile({ path: 'c.pdf' })]);
      // WHEN resolving tracked files (built on getTrackedTFiles)
      const files = await vaultUtil.getTrackedFiles();
      // THEN the tracked file carries its metadata
      expect(files).toEqual([
        { file: tracked, timeMetadata: { createdMs: 11, modifiedMs: 22, visitedMs: null, totalFocusMs: 0 } },
      ]);
    });

    it('should map the last visit of the visit stats to visitedMs', async () => {
      // GIVEN a tracked file with recorded visit stats
      const vaultUtil = makeVaultUtil([makeTFile({ path: 'a.md' })], new VisitStats(1234, 999));
      // WHEN resolving tracked files
      const [trackedFile] = await vaultUtil.getTrackedFiles();
      // THEN visitedMs is the last visit
      expect(trackedFile?.timeMetadata.visitedMs).toBe(1234);
    });

    it('should map the total focus of the visit stats to totalFocusMs', async () => {
      // GIVEN a tracked file with recorded visit stats
      const vaultUtil = makeVaultUtil([makeTFile({ path: 'a.md' })], new VisitStats(1234, 999));
      // WHEN resolving tracked files
      const [trackedFile] = await vaultUtil.getTrackedFiles();
      // THEN totalFocusMs is the summed focus time
      expect(trackedFile?.timeMetadata.totalFocusMs).toBe(999);
    });
  });

  describe('getTrackedFile', () => {
    it('should return the tracked file with its time metadata', async () => {
      // GIVEN a tracked file with recorded visit stats
      const tracked = makeTFile({ path: 'notes/a.md', ctime: 11, mtime: 22 });
      const vaultUtil = makeVaultUtil([tracked], new VisitStats(1234, 999));
      // WHEN resolving it by path
      const trackedFile = await vaultUtil.getTrackedFile('notes/a.md');
      // THEN it carries the same metadata getTrackedFiles would
      expect(trackedFile).toEqual(
        { file: tracked, timeMetadata: { createdMs: 11, modifiedMs: 22, visitedMs: 1234, totalFocusMs: 999 } },
      );
    });

    it('should normalize the path before the lookup', async () => {
      // GIVEN a tracked file
      const tracked = makeTFile({ path: 'notes/a.md' });
      const vaultUtil = makeVaultUtil([tracked]);
      // WHEN resolving it by a leading-slash path
      const trackedFile = await vaultUtil.getTrackedFile('/notes/a.md');
      // THEN the file is found
      expect(trackedFile?.file).toBe(tracked);
    });

    it('should return undefined WHEN no file exists at the path', async () => {
      // GIVEN an empty vault
      const vaultUtil = makeVaultUtil([]);
      // WHEN resolving a missing path
      // THEN nothing comes back
      expect(await vaultUtil.getTrackedFile('missing.md')).toBeUndefined();
    });

    it('should return undefined WHEN the file has an untracked extension', async () => {
      // GIVEN a pdf
      const vaultUtil = makeVaultUtil([makeTFile({ path: 'c.pdf' })]);
      // WHEN resolving it
      // THEN nothing comes back
      expect(await vaultUtil.getTrackedFile('c.pdf')).toBeUndefined();
    });

    it('should return undefined WHEN the file is under a legacy visit-history dir', async () => {
      // GIVEN a legacy VH file
      const vaultUtil = makeVaultUtil([makeTFile({ path: '_visit_history/x.md' })]);
      // WHEN resolving it
      // THEN nothing comes back
      expect(await vaultUtil.getTrackedFile('_visit_history/x.md')).toBeUndefined();
    });
  });
});
