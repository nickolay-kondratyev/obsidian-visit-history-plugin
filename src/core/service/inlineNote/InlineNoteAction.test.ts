import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { InlineNoteAction } from './InlineNoteAction';
import { InlineNotePlanner } from './InlineNotePlanner';
import { InlineConfirmRequest, InlineNoteDialogs } from './InlineNoteDialogs';
import { InlineRefusal } from './InlineRefusal';
import { FocusSessionReleaser } from '../../focusDuration/FocusSessionReleaser';
import { UserNotifier } from '../../util/userComm/UserNotifier';
import { VhV3HistoryMerger } from '../visitHistoryService/v3/VhV3HistoryMerger';
import { VisitStatsCache } from '../visitHistoryService/v3/VisitStatsCache';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService } from '../../../testSupport/fakes';
import { FixedReferenceCollector } from '../../../testSupport/FixedReferenceCollector';

const NOTE1_ID = 'docid_note1_e';
const NOTE2_ID = 'docid_note2_e';
const NOTE1_CONTENT = '---\nid: docid_note1_e\n---\n## Topic\nSee [[note2]].\n';
const NOTE2_CONTENT = '---\nid: docid_note2_e\ntags: [moved]\n---\nnote2 body\n';
const USER_V3 = '.plugin_data/visit_history/user/alice/v3';
const NOTE2_HISTORY = `${USER_V3}/focus_duration_per_device/host/${NOTE2_ID}.vh_v3`;
const SESSION_LINE = '2026-07-09T10:00:00.000Z D:100\n';

function mergedHistoryPath(receivingDocId: string): string {
  return `${USER_V3}/merged_in_focus_duration_per_device/host/${receivingDocId}/${NOTE2_ID}.vh_v3`;
}

/** Dialogs fake: records refusals and holds the confirm callback. */
class RecordingDialogs implements InlineNoteDialogs {
  readonly refusals: InlineRefusal[] = [];
  readonly confirmRequests: InlineConfirmRequest[] = [];
  pendingConfirm: (() => void) | null = null;

  showRefusal(refusal: InlineRefusal): void {
    this.refusals.push(refusal);
  }

  confirmInline(request: InlineConfirmRequest, onConfirm: () => void): void {
    this.confirmRequests.push(request);
    this.pendingConfirm = onConfirm;
  }
}

class RecordingNotifier implements UserNotifier {
  readonly errors: string[] = [];
  readonly infos: string[] = [];

  showError(msg: string): void {
    this.errors.push(msg);
  }

  showInfo(msg: string): void {
    this.infos.push(msg);
  }
}

class RecordingReleaser implements FocusSessionReleaser {
  constructor(private readonly log: string[]) {
  }

  async releaseAndFlush(docId: string): Promise<void> {
    this.log.push(`release:${docId}`);
  }
}

/** History store whose renames fail — simulates an IO failure mid-move. */
class FailingRenameHiddenFileUtil extends FakeHiddenFileUtil {
  override async rename(_fromPath: string, _toPath: string): Promise<void> {
    throw new Error('simulated rename failure');
  }
}

/** Note store logging edits and trashing, to check ordering. */
class LoggingNoteFileUtil extends FakeNoteFileUtil {
  constructor(private readonly log: string[]) {
    super();
  }

  override async process(file: TFile, transform: (content: string) => string): Promise<void> {
    this.log.push(`edit:${file.path}`);
    await super.process(file, transform);
  }

  override async trashFile(file: TFile): Promise<void> {
    this.log.push(`trash:${file.path}`);
    await super.trashFile(file);
  }
}

interface SetupOptions {
  hidden?: FakeHiddenFileUtil;
  note1Content?: string;
  /** undefined → NOTE1_ID seeded; null → note1 has no id yet. */
  note1Id?: string | null;
  /** undefined → NOTE2_ID seeded; null → note2 has no id. */
  note2Id?: string | null;
  /** false → nothing references note2. */
  linked?: boolean;
}

/** GIVEN note1 linking note2 once; note2 has one session of history. */
function setup(options: SetupOptions = {}) {
  const log: string[] = [];
  const notes = new LoggingNoteFileUtil(log);
  const hidden = options.hidden ?? new FakeHiddenFileUtil();
  const docIds = new FakeDocIdService();
  const dialogs = new RecordingDialogs();
  const notifier = new RecordingNotifier();
  const collector = new FixedReferenceCollector();
  const note1Content = options.note1Content ?? NOTE1_CONTENT;
  const note1 = notes.seedNote('note1.md', note1Content);
  const note2 = notes.seedNote('note2.md', NOTE2_CONTENT);
  const note1Id = options.note1Id === undefined ? NOTE1_ID : options.note1Id;
  const note2Id = options.note2Id === undefined ? NOTE2_ID : options.note2Id;
  if (note1Id !== null) docIds.seedId(note1.path, note1Id);
  if (note2Id !== null) docIds.seedId(note2.path, note2Id);
  if (options.linked !== false) {
    collector.references = [FixedReferenceCollector.bodyReferenceIn(note1, note1Content, '[[note2]]')];
  }
  hidden.seedFile(NOTE2_HISTORY, SESSION_LINE);
  const action = new InlineNoteAction(
    new InlineNotePlanner(collector, notes),
    notes,
    docIds,
    new VhV3HistoryMerger(hidden, new VisitStatsCache()),
    new RecordingReleaser(log),
    dialogs,
    notifier,
  );
  return { action, notes, hidden, dialogs, notifier, docIds, log, note2 };
}

describe('InlineNoteAction', () => {
  describe('run', () => {
    it('should ask to confirm naming both notes', async () => {
      const { action, dialogs, note2 } = setup();
      await action.run(note2);
      expect(dialogs.confirmRequests).toEqual([{ inlinedNoteName: 'note2', receivingNoteName: 'note1' }]);
    });

    it('should change nothing until the user confirms', async () => {
      const { action, notes, note2 } = setup();
      await action.run(note2);
      expect(notes.getContent('note1.md')).toBe(NOTE1_CONTENT);
    });

    it('should inline once the user confirms', async () => {
      // GIVEN the confirm dialog is open
      const { action, dialogs, notes, note2 } = setup();
      await action.run(note2);
      // WHEN the user confirms
      dialogs.pendingConfirm?.();
      // THEN note2 ends up in the trash
      await vi.waitFor(() => expect(notes.trashedPaths).toEqual(['note2.md']));
    });

    it('should show the refusal and never ask to confirm when the note is not inlinable', async () => {
      const { action, dialogs, note2 } = setup({ linked: false });
      await action.run(note2);
      expect([dialogs.refusals.map(refusal => refusal.kind), dialogs.confirmRequests]).toEqual([['no-links'], []]);
    });
  });

  describe('inlineConfirmed', () => {
    it('should inline note2 content and tags into note1', async () => {
      const { action, notes, note2 } = setup();
      await action.inlineConfirmed(note2);
      expect(notes.getContent('note1.md')).toBe(
        '---\nid: docid_note1_e\ntags:\n  - moved\n---\n## Topic\nSee note2.\n### note2\nnote2 body\n',
      );
    });

    it('should move note2 to the trash', async () => {
      const { action, notes, note2 } = setup();
      await action.inlineConfirmed(note2);
      expect(notes.trashedPaths).toEqual(['note2.md']);
    });

    it('should move note2 visit history under note1', async () => {
      const { action, hidden, note2 } = setup();
      await action.inlineConfirmed(note2);
      expect(hidden.getContent(mergedHistoryPath(NOTE1_ID))).toBe(SESSION_LINE);
    });

    it('should release note2 focus session first, then edit note1, and trash note2 last', async () => {
      const { action, log, note2 } = setup();
      await action.inlineConfirmed(note2);
      expect(log).toEqual([`release:${NOTE2_ID}`, 'edit:note1.md', 'trash:note2.md']);
    });

    it('should report success', async () => {
      const { action, notifier, note2 } = setup();
      await action.inlineConfirmed(note2);
      expect(notifier.infos).toEqual(['Inlined "note2" into "note1".']);
    });

    it('should give note1 a doc id when it has none and move the history under it', async () => {
      // GIVEN note1 without an id (FakeDocIdService generates `docid-for-<path>`)
      const { action, hidden, note2 } = setup({ note1Content: '## Topic\nSee [[note2]].', note1Id: null });
      // WHEN inlined
      await action.inlineConfirmed(note2);
      // THEN the history lands under note1's new id
      expect(hidden.getContent(mergedHistoryPath('docid-for-note1.md'))).toBe(SESSION_LINE);
    });

    it('should still inline and trash when note2 has no doc id (no history to move)', async () => {
      const { action, notes, note2 } = setup({ note2Id: null });
      await action.inlineConfirmed(note2);
      expect(notes.trashedPaths).toEqual(['note2.md']);
    });

    it('should refuse and change nothing when note1 changed after confirmation was asked', async () => {
      // GIVEN the user rewrote note1 so the planned offsets are stale
      const { action, dialogs, notes, note2 } = setup();
      notes.seedNote('note1.md', 'Totally rewritten, see [[note2]] here');
      // WHEN confirmed
      await action.inlineConfirmed(note2);
      // THEN the change is detected and note2 stays
      expect([dialogs.refusals.map(refusal => refusal.kind), notes.trashedPaths]).toEqual([['note-changed'], []]);
    });

    it('should refuse when both notes carry the same doc id', async () => {
      const { action, dialogs, note2 } = setup({ note1Id: NOTE2_ID });
      await action.inlineConfirmed(note2);
      expect(dialogs.refusals.map(refusal => refusal.kind)).toEqual(['same-doc-id']);
    });

    it('should keep note2 when moving the history fails', async () => {
      const { action, notes, note2 } = setup({ hidden: new FailingRenameHiddenFileUtil() });
      await action.inlineConfirmed(note2);
      expect(notes.trashedPaths).toEqual([]);
    });

    it('should tell the user note2 was kept when moving the history fails', async () => {
      const { action, notifier, note2 } = setup({ hidden: new FailingRenameHiddenFileUtil() });
      await action.inlineConfirmed(note2);
      expect(notifier.errors[0]).toContain('was kept');
    });
  });
});
