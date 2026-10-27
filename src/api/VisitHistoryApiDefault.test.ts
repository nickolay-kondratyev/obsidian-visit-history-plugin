import { beforeEach, describe, expect, it } from 'vitest';
import type { App, TFile } from 'obsidian';
import { VisitHistoryApiDefault } from './VisitHistoryApiDefault';
import { VisitHistoryChangeNotifier } from './VisitHistoryChangeNotifier';
import { VaultUtilDefault } from '../core/util/vault/VaultUtil';
import { IsTrackedProviderDefault } from '../core/util/vault/IsTrackedProvider';
import { VisitHistoryServiceV3 } from '../core/service/visitHistoryService/v3/VisitHistoryServiceV3';
import { VhV3DurationStore } from '../core/service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../core/service/visitHistoryService/v3/VisitStatsCache';
import { VhV3Paths } from '../core/service/visitHistoryService/v3/VhV3Paths';
import { DEFAULT_HEATMAP_CONFIG, type HeatmapConfig } from '../viewModel/heatmapConfig';
import { GRADIENTS, TYPE_C } from '../view/constants';
import { FakeHiddenFileUtil } from '../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService } from '../testSupport/fakes';
import { makeTFile } from '../testSupport/fileFactory';

const MS_PER_DAY = 86400000;
const NOTE_PATH = 'notes/a.md';
const CANVAS_PATH = 'board.canvas';
const DOC_ID = 'docid_aaaaaaaaaaaaaaaaaaaaaaaa_e';
const SESSION_START_ISO = '2026-07-09T22:02:15.745Z';
const SESSION_DURATION_MS = 5600;
/** Heatmap-mode config: hot ≤ 3 days, cold ≥ 21 days (the defaults' slider values). */
const HEATMAP_BY_MODIFIED: HeatmapConfig = { ...DEFAULT_HEATMAP_CONFIG, colorMode: 'heatmap', gradKey: 'nature', field: 'lastModifiedAt' };

function daysAgo(days: number): number {
  return Date.now() - days * MS_PER_DAY;
}

describe('VisitHistoryApiDefault', () => {
  let hidden: FakeHiddenFileUtil;
  let docIdService: FakeDocIdService;
  let config: HeatmapConfig;
  let api: VisitHistoryApiDefault;
  let notifier: VisitHistoryChangeNotifier;

  /**
   * GIVEN shared setup: the REAL heatmap read stack (VaultUtilDefault →
   * VisitHistoryServiceV3 → VhV3DurationStore) over fakes. The App stub has
   * read methods only — any write attempt would throw.
   */
  beforeEach(() => {
    hidden = new FakeHiddenFileUtil();
    docIdService = new FakeDocIdService();
    config = HEATMAP_BY_MODIFIED;
    const files: TFile[] = [
      makeTFile({ path: NOTE_PATH, ctime: daysAgo(500), mtime: daysAgo(1) }),
      makeTFile({ path: CANVAS_PATH, ctime: daysAgo(1), mtime: daysAgo(500) }),
      makeTFile({ path: 'c.pdf' }),
      makeTFile({ path: '_visit_history/x.md' }),
    ];
    const app = {
      vault: {
        getFiles: () => files,
        getFileByPath: (path: string) => files.find(f => f.path === path) ?? null,
      },
    } as unknown as App;
    const visitStatsProvider = new VisitHistoryServiceV3(docIdService, new VhV3DurationStore(hidden), new VisitStatsCache());
    const vaultUtil = new VaultUtilDefault(app, visitStatsProvider, new IsTrackedProviderDefault());
    notifier = new VisitHistoryChangeNotifier();
    api = new VisitHistoryApiDefault(vaultUtil, () => config, notifier);
  });

  function seedVisit(): void {
    docIdService.seedId(NOTE_PATH, DOC_ID);
    hidden.seedFile(
      VhV3Paths.focusDurationFilePath('alice', 'host-a', DOC_ID),
      `${SESSION_START_ISO} D:${SESSION_DURATION_MS}\n`,
    );
  }

  describe('getVisitStatsV1', () => {
    it('should return undefined WHEN no file exists at the path', async () => {
      // WHEN asking for a missing file
      // THEN nothing comes back
      expect(await api.getVisitStatsV1('missing.md')).toBeUndefined();
    });

    it('should return undefined WHEN the file has an untracked extension', async () => {
      // WHEN asking for a pdf
      // THEN nothing comes back
      expect(await api.getVisitStatsV1('c.pdf')).toBeUndefined();
    });

    it('should return undefined WHEN the file is under a legacy visit-history dir', async () => {
      // WHEN asking for a legacy VH file
      // THEN nothing comes back
      expect(await api.getVisitStatsV1('_visit_history/x.md')).toBeUndefined();
    });

    it('should return empty stats WHEN the tracked file was never visited', async () => {
      // GIVEN a tracked note with no doc id and no history
      // WHEN asking for its stats
      // THEN it reads as never visited
      expect(await api.getVisitStatsV1(NOTE_PATH)).toEqual({ lastVisitMs: null, totalFocusMs: 0 });
    });

    it('should return the recorded stats WHEN the file was visited', async () => {
      // GIVEN one recorded session
      seedVisit();
      // WHEN asking for its stats
      // THEN the session start + duration come back
      expect(await api.getVisitStatsV1(NOTE_PATH)).toEqual({
        lastVisitMs: Date.parse(SESSION_START_ISO),
        totalFocusMs: SESSION_DURATION_MS,
      });
    });

    it('should return a plain object literal (no internal class instance)', async () => {
      // GIVEN one recorded session
      seedVisit();
      // WHEN asking for its stats
      const stats = await api.getVisitStatsV1(NOTE_PATH);
      // THEN its prototype is Object's
      expect(Object.getPrototypeOf(stats)).toBe(Object.prototype);
    });
  });

  describe('getFileColorV1', () => {
    it('should return undefined WHEN the file has an untracked extension', async () => {
      // WHEN asking for a pdf
      // THEN nothing comes back
      expect(await api.getFileColorV1('c.pdf')).toBeUndefined();
    });

    it('should color by the modified time WHEN the heatmap colors by modified', async () => {
      // GIVEN a note modified yesterday
      // WHEN asking for its color
      // THEN it is the hot color with data
      expect(await api.getFileColorV1(NOTE_PATH)).toEqual({ fill: GRADIENTS.nature.hot, hasData: true });
    });

    it('should color by the created time WHEN the heatmap colors by created', async () => {
      // GIVEN the heatmap colors by created time
      config = { ...HEATMAP_BY_MODIFIED, field: 'createdAt' };
      // WHEN asking for the color of a note created long ago
      // THEN it is the cold color
      expect((await api.getFileColorV1(NOTE_PATH))?.fill).toBe(GRADIENTS.nature.cold);
    });

    it('should return the nil color without data WHEN coloring by visits and never visited', async () => {
      // GIVEN the heatmap colors by visit time
      config = { ...HEATMAP_BY_MODIFIED, field: 'lastVisitedAt' };
      // WHEN asking for the color of a never-visited note
      // THEN it is the nil color without data
      expect(await api.getFileColorV1(NOTE_PATH)).toEqual({ fill: GRADIENTS.nature.nil, hasData: false });
    });

    it('should use the type fill WHEN the heatmap colors by type', async () => {
      // GIVEN the heatmap colors by type
      config = { ...HEATMAP_BY_MODIFIED, colorMode: 'type' };
      // WHEN asking for a canvas's color
      // THEN it is the canvas type fill with data
      expect(await api.getFileColorV1(CANVAS_PATH)).toEqual({ fill: TYPE_C.canvas!.fill, hasData: true });
    });

    it('should reflect a config change on the next call without re-creating the API', async () => {
      // GIVEN a first call under the ember gradient
      config = { ...HEATMAP_BY_MODIFIED, gradKey: 'ember' };
      await api.getFileColorV1(NOTE_PATH);
      // WHEN the live config switches to the mono gradient
      config = { ...HEATMAP_BY_MODIFIED, gradKey: 'mono' };
      // THEN the next call uses it
      expect((await api.getFileColorV1(NOTE_PATH))?.fill).toBe(GRADIENTS.mono.hot);
    });
  });

  describe('read-only', () => {
    it('should never assign a doc id WHEN reading colors and stats', async () => {
      // GIVEN a note without a doc id
      // WHEN reading its color and stats
      await api.getFileColorV1(NOTE_PATH);
      await api.getVisitStatsV1(NOTE_PATH);
      // THEN ensureDocId was never called
      expect(docIdService.ensuredPaths).toEqual([]);
    });

    it('should never write visit-history files WHEN reading colors and stats', async () => {
      // GIVEN one recorded session
      seedVisit();
      const before = hidden.allPaths().map(p => [p, hidden.getContent(p)]);
      // WHEN reading its color and stats
      await api.getFileColorV1(NOTE_PATH);
      await api.getVisitStatsV1(NOTE_PATH);
      // THEN the VH files are byte-for-byte unchanged
      expect(hidden.allPaths().map(p => [p, hidden.getContent(p)])).toEqual(before);
    });
  });

  describe('onChangeV1', () => {
    it('should call the subscriber WHEN the notifier fires', () => {
      // GIVEN a subscriber
      let calls = 0;
      api.onChangeV1(() => calls++);
      // WHEN a change is notified
      notifier.notify();
      // THEN it was called
      expect(calls).toBe(1);
    });

    it('should stop calling the subscriber AFTER it unsubscribed', () => {
      // GIVEN an unsubscribed subscriber
      let calls = 0;
      const unsubscribe = api.onChangeV1(() => calls++);
      unsubscribe();
      // WHEN a change is notified
      notifier.notify();
      // THEN it was not called
      expect(calls).toBe(0);
    });
  });
});
