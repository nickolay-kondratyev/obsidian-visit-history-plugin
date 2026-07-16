import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { DocIdBackfillServiceDefault } from './DocIdBackfillService';
import { DocIdService } from 'obsidian-id-lib';
import { FakeVaultUtil } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

class FakeDocIdService implements DocIdService {
  readonly ensuredPaths: string[] = [];
  readonly nullResultPaths = new Set<string>();
  readonly throwingPaths = new Set<string>();

  async ensureDocId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
    if (this.throwingPaths.has(file.path)) {
      throw new Error(`boom for ${file.path}`);
    }
    return this.nullResultPaths.has(file.path) ? null : 'some-id';
  }

  async getDocId(_file: TFile): Promise<string | null> {
    return null;
  }

  isEligible(file: TFile): boolean {
    return file.extension === 'md' || file.extension === 'canvas';
  }
}

interface Setup {
  service: DocIdBackfillServiceDefault;
  docIdService: FakeDocIdService;
}

function setup(paths: string[]): Setup {
  const docIdService = new FakeDocIdService();
  const vaultUtil = new FakeVaultUtil(paths.map(path => makeTFile({ path })));
  return { service: new DocIdBackfillServiceDefault(vaultUtil, docIdService), docIdService };
}

describe('DocIdBackfillServiceDefault', () => {
  describe('backfillAll', () => {
    it('should ensure a doc id for every eligible file and skip ineligible ones', async () => {
      // GIVEN md, canvas, excalidraw.md eligible; raw .excalidraw ineligible
      const { service, docIdService } = setup([
        'notes/a.md',
        'boards/b.canvas',
        'draw/c.excalidraw.md',
        'draw/raw.excalidraw',
      ]);
      // WHEN
      await service.backfillAll();
      // THEN
      expect(docIdService.ensuredPaths).toEqual([
        'notes/a.md',
        'boards/b.canvas',
        'draw/c.excalidraw.md',
      ]);
    });

    it('should report the eligible file count', async () => {
      // GIVEN
      const { service } = setup(['a.md', 'b.canvas', 'raw.excalidraw']);
      // WHEN
      const result = await service.backfillAll();
      // THEN
      expect(result.eligibleFileCount).toBe(2);
    });

    it('should report no failures when every file is handled', async () => {
      // GIVEN
      const { service } = setup(['a.md', 'b.canvas']);
      // WHEN
      const result = await service.backfillAll();
      // THEN
      expect(result.failedPaths).toEqual([]);
    });

    it('should collect paths where ensureDocId returns null (unhandled content)', async () => {
      // GIVEN
      const { service, docIdService } = setup(['a.md', 'broken.canvas']);
      docIdService.nullResultPaths.add('broken.canvas');
      // WHEN
      const result = await service.backfillAll();
      // THEN
      expect(result.failedPaths).toEqual(['broken.canvas']);
    });

    it('should continue past a throwing file and record it as failed', async () => {
      // GIVEN
      const { service, docIdService } = setup(['throws.md', 'b.md']);
      docIdService.throwingPaths.add('throws.md');
      // WHEN
      const result = await service.backfillAll();
      // THEN the file after the throwing one is still processed
      expect({ failedPaths: result.failedPaths, ensuredPaths: docIdService.ensuredPaths })
        .toEqual({ failedPaths: ['throws.md'], ensuredPaths: ['throws.md', 'b.md'] });
    });

    it('should join a concurrent call into the in-flight run (no duplicate work)', async () => {
      // GIVEN
      const { service, docIdService } = setup(['a.md', 'b.md']);
      // WHEN two calls are made before the first completes
      const [first, second] = await Promise.all([service.backfillAll(), service.backfillAll()]);
      // THEN each file was ensured exactly once and both callers see the outcome
      expect({ first, second, ensuredPaths: docIdService.ensuredPaths })
        .toEqual({
          first: { eligibleFileCount: 2, failedPaths: [] },
          second: { eligibleFileCount: 2, failedPaths: [] },
          ensuredPaths: ['a.md', 'b.md'],
        });
    });

    it('should run again after the previous run completed', async () => {
      // GIVEN
      const { service, docIdService } = setup(['a.md']);
      await service.backfillAll();
      // WHEN
      await service.backfillAll();
      // THEN
      expect(docIdService.ensuredPaths).toEqual(['a.md', 'a.md']);
    });
  });
});
