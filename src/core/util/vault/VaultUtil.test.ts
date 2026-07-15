import { describe, expect, it } from 'vitest';
import type { App, TFile } from 'obsidian';
import { VaultUtilDefault } from './VaultUtil';
import { IsTrackedProviderDefault } from './IsTrackedProvider';
import type { LastVisitProvider } from '../../service/visitHistoryService/LastVisitProvider';
import { makeTFile } from '../../../testSupport/fileFactory';

/** GIVEN a vault holding exactly these files (system-boundary App stub). */
function makeVaultUtil(files: TFile[]): VaultUtilDefault {
  const app = {
    vault: {
      getName: () => 'test-vault',
      getFiles: () => files,
    },
  } as unknown as App;
  const lastVisitProvider: LastVisitProvider = {
    getLastVisitStamp: async () => null,
  };
  return new VaultUtilDefault(app, lastVisitProvider, new IsTrackedProviderDefault());
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
        { file: tracked, timeMetadata: { createdMs: 11, modifiedMs: 22, visitedMs: null } },
      ]);
    });
  });
});
