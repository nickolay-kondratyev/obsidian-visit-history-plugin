import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { VhV1ToV2MigrationService } from './VhV1ToV2MigrationService';
import { V1FocusFileRepo, V1VhFile } from './V1FocusFileRepo';
import { VhV2FocusStore } from '../visitHistoryService/v2/VhV2FocusStore';
import { DocIdBackfillResult, DocIdBackfillService } from '../docId/DocIdBackfillService';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FakeLinkUtil } from '../../../testSupport/fakes';

const ISO_1 = '2026-01-01T00:00:00.000Z';
const ISO_2 = '2026-02-02T00:00:00.000Z';
const LEGACY_EPOCH_MS = 1781639192842;
const LEGACY_AS_ISO = new Date(LEGACY_EPOCH_MS).toISOString();

class FakeV1FocusFileRepo implements V1FocusFileRepo {
  treeExists = true;
  files: V1VhFile[] = [];
  deleted = false;

  v1TreeExists(): boolean {
    return this.treeExists;
  }

  findAllV1FocusFiles(): V1VhFile[] {
    return this.files;
  }

  async deleteV1TreePermanently(): Promise<void> {
    this.deleted = true;
  }
}

class RecordingBackfillService implements DocIdBackfillService {
  callCount = 0;

  async backfillAll(): Promise<DocIdBackfillResult> {
    this.callCount++;
    return { eligibleFileCount: 0, failedPaths: [] };
  }
}

interface Setup {
  service: VhV1ToV2MigrationService;
  v1Repo: FakeV1FocusFileRepo;
  noteFileUtil: FakeNoteFileUtil;
  linkUtil: FakeLinkUtil;
  docIdService: FakeDocIdService;
  backfill: RecordingBackfillService;
  hidden: FakeHiddenFileUtil;
}

function setup(hidden: FakeHiddenFileUtil = new FakeHiddenFileUtil()): Setup {
  const v1Repo = new FakeV1FocusFileRepo();
  const noteFileUtil = new FakeNoteFileUtil();
  const linkUtil = new FakeLinkUtil();
  const docIdService = new FakeDocIdService();
  const backfill = new RecordingBackfillService();
  const service = new VhV1ToV2MigrationService(
    v1Repo,
    noteFileUtil,
    linkUtil,
    docIdService,
    backfill,
    new VhV2FocusStore(hidden),
  );
  return { service, v1Repo, noteFileUtil, linkUtil, docIdService, backfill, hidden };
}

/** Seeds a V1 focus file pointing at notePath, with the given stamp lines. */
function seedV1File(s: Setup, opts: {
  vhPath: string;
  deviceName: string;
  notePath: string | null;
  stampLines: string[];
}): TFile {
  const backlinkLine = opts.notePath === null ? '' : `VISIT_HISTORY_V1_FOR:[[${opts.notePath}]]\n`;
  const content = `${backlinkLine}### VISIT_HISTORY_V1:\n${opts.stampLines.map(l => l + '\n').join('')}`;
  const file = s.noteFileUtil.seedNote(opts.vhPath, content);
  s.v1Repo.files.push({ file, deviceName: opts.deviceName });
  return file;
}

/** Registers notePath as a resolvable, id-carrying note. */
function seedNote(s: Setup, notePath: string, docId: string): void {
  s.linkUtil.seedLinkTarget(notePath);
  s.docIdService.seedId(notePath, docId);
}

function v2Content(s: Setup, deviceName: string, docId: string): string | undefined {
  return s.hidden.getContent(`.visit_history/v2/focus_per_device/${deviceName}/${docId}.vh_v2`);
}

function suppressConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('VhV1ToV2MigrationService', () => {
  describe('migrateIfV1Present — detection', () => {
    it('should return null (and not backfill) when no V1 tree exists', async () => {
      // GIVEN no V1 tree
      const s = setup();
      s.v1Repo.treeExists = false;
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN nothing ran
      expect({ result, backfills: s.backfill.callCount }).toEqual({ result: null, backfills: 0 });
    });

    it('should run the doc id backfill before migrating', async () => {
      // GIVEN a V1 tree
      const s = setup();
      // WHEN
      await s.service.migrateIfV1Present();
      // THEN the vault-wide backfill ran
      expect(s.backfill.callCount).toBe(1);
    });

    it('should delete an empty V1 tree (validation is trivially satisfied)', async () => {
      // GIVEN a V1 tree with no focus files
      const s = setup();
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN the leftover tree is removed
      expect({ deleted: s.v1Repo.deleted, passed: result?.validationPassed })
        .toEqual({ deleted: true, passed: true });
    });
  });

  describe('migrateIfV1Present — writing V2', () => {
    it('should convert stamps to sorted ISO ms lines (legacy epoch included)', async () => {
      // GIVEN one V1 file with a legacy epoch stamp (2026-06-16, the newest)
      // listed BEFORE an older ISO stamp
      const s = setup();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md',
        stampLines: [String(LEGACY_EPOCH_MS), ISO_2],
      });
      // WHEN
      await s.service.migrateIfV1Present();
      // THEN the V2 file is ISO-only, sorted ascending
      expect(v2Content(s, 'mac', 'doc-a')).toBe(`${ISO_2}\n${LEGACY_AS_ISO}\n`);
    });

    it('should merge multiple V1 files of the same (device, note) into one V2 file', async () => {
      // GIVEN two V1 files for the same note on the same device
      const s = setup();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_2],
      });
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01B.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN one V2 file holds both, sorted
      expect({ content: v2Content(s, 'mac', 'doc-a'), docFiles: result?.migratedDocFileCount })
        .toEqual({ content: `${ISO_1}\n${ISO_2}\n`, docFiles: 1 });
    });

    it('should keep devices in separate V2 files', async () => {
      // GIVEN the same note visited from two devices
      const s = setup();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/phone/_vh_01B.md',
        deviceName: 'phone', notePath: 'notes/a.md', stampLines: [ISO_2],
      });
      // WHEN
      await s.service.migrateIfV1Present();
      // THEN each device dir has its own file
      expect({ mac: v2Content(s, 'mac', 'doc-a'), phone: v2Content(s, 'phone', 'doc-a') })
        .toEqual({ mac: `${ISO_1}\n`, phone: `${ISO_2}\n` });
    });

    it('should union with stamps already present in V2 (idempotent re-run)', async () => {
      // GIVEN a V2 file that already holds a live-recorded stamp AND one V1 stamp
      const hidden = new FakeHiddenFileUtil();
      hidden.seedFile(`.visit_history/v2/focus_per_device/mac/doc-a.vh_v2`, `${ISO_2}\n${ISO_1}\n`);
      const s = setup(hidden);
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      // WHEN
      await s.service.migrateIfV1Present();
      // THEN the duplicate collapses; existing V2 stamps survive, sorted
      expect(v2Content(s, 'mac', 'doc-a')).toBe(`${ISO_1}\n${ISO_2}\n`);
    });

    it('should count a stamp-less V1 file as migrated without writing a V2 file', async () => {
      // GIVEN a header-only V1 file
      const s = setup();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN migrated (it has no data to lose), V2 file created empty
      expect({ migrated: result?.migratedV1FileCount, deleted: s.v1Repo.deleted })
        .toEqual({ migrated: 1, deleted: true });
    });
  });

  describe('migrateIfV1Present — unmigratable files', () => {
    it('should count a file with an unresolvable backlink as unmigratable', async () => {
      // GIVEN the target note no longer exists
      const s = setup();
      const errorSpy = suppressConsoleError();
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'gone/deleted.md', stampLines: [ISO_1],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN unmigratable — and still deleted with the tree (owner decision)
      expect({ unmigratable: result?.unmigratableV1FileCount, deleted: s.v1Repo.deleted })
        .toEqual({ unmigratable: 1, deleted: true });
      errorSpy.mockRestore();
    });

    it('should count a file without a backlink line as unmigratable', async () => {
      // GIVEN a corrupt V1 file (no backlink line)
      const s = setup();
      const errorSpy = suppressConsoleError();
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: null, stampLines: [ISO_1],
      });
      // WHEN / THEN
      expect((await s.service.migrateIfV1Present())?.unmigratableV1FileCount).toBe(1);
      errorSpy.mockRestore();
    });

    it('should count a note that cannot carry an id as unmigratable', async () => {
      // GIVEN a resolvable note the id service cannot handle
      const s = setup();
      const errorSpy = suppressConsoleError();
      s.linkUtil.seedLinkTarget('draw/raw.excalidraw');
      s.docIdService.failingPaths.add('draw/raw.excalidraw');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'draw/raw.excalidraw', stampLines: [ISO_1],
      });
      // WHEN / THEN
      expect((await s.service.migrateIfV1Present())?.unmigratableV1FileCount).toBe(1);
      errorSpy.mockRestore();
    });

    it('should count a note with a filename-unsafe id as unmigratable', async () => {
      // GIVEN a note whose existing id cannot be a filename
      const s = setup();
      const errorSpy = suppressConsoleError();
      seedNote(s, 'notes/a.md', 'evil/../id');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      // WHEN / THEN
      expect((await s.service.migrateIfV1Present())?.unmigratableV1FileCount).toBe(1);
      errorSpy.mockRestore();
    });

    it('should still migrate the other files when one is unmigratable', async () => {
      // GIVEN one orphaned and one healthy V1 file
      const s = setup();
      const errorSpy = suppressConsoleError();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_orphan.md',
        deviceName: 'mac', notePath: 'gone/deleted.md', stampLines: [ISO_1],
      });
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_2],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN the healthy file migrated
      expect({ migrated: result?.migratedV1FileCount, content: v2Content(s, 'mac', 'doc-a') })
        .toEqual({ migrated: 1, content: `${ISO_2}\n` });
      errorSpy.mockRestore();
    });
  });

  describe('migrateIfV1Present — validation gate', () => {
    it('should delete the V1 tree when validation passes', async () => {
      // GIVEN a healthy migration
      const s = setup();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN validated and deleted
      expect({ passed: result?.validationPassed, deleted: s.v1Repo.deleted })
        .toEqual({ passed: true, deleted: true });
    });

    it('should NOT delete the V1 tree when V2 readback is missing stamps', async () => {
      // GIVEN a hidden-file layer whose writes are silently lost
      class WriteLosingHiddenFileUtil extends FakeHiddenFileUtil {
        override async write(_filePath: string, _content: string): Promise<void> {
          // lost
        }
      }
      const s = setup(new WriteLosingHiddenFileUtil());
      const errorSpy = suppressConsoleError();
      seedNote(s, 'notes/a.md', 'doc-a');
      seedV1File(s, {
        vhPath: '_visit_history/v1/focus/mac/_vh_01A.md',
        deviceName: 'mac', notePath: 'notes/a.md', stampLines: [ISO_1],
      });
      // WHEN
      const result = await s.service.migrateIfV1Present();
      // THEN validation failed and NOTHING was deleted
      expect({ passed: result?.validationPassed, deleted: s.v1Repo.deleted })
        .toEqual({ passed: false, deleted: false });
      errorSpy.mockRestore();
    });
  });
});
