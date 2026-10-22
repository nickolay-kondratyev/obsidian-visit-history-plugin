import { TFile } from 'obsidian';
import { DocIdService } from 'stable-ids-for-obsidian';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';
import { UserNotifier } from '../../util/userComm/UserNotifier';
import { FocusSessionReleaser } from '../../focusDuration/FocusSessionReleaser';
import { DocIdFilenameSafety } from '../visitHistoryService/DocIdFilenameSafety';
import { VhV3HistoryMerger } from '../visitHistoryService/v3/VhV3HistoryMerger';
import { InlineNotePlanner, InlinePlan, InlinePlanResult } from './InlineNotePlanner';
import { InlineNoteDialogs } from './InlineNoteDialogs';
import { InlineRefusals } from './InlineRefusal';
import { MarkdownSectionPlacer } from './MarkdownSectionPlacer';
import { FrontmatterMerger } from './FrontmatterMerger';

/**
 * "Inline note (visit history aware)": moves note2 — linked from exactly ONE
 * place, in note1 — into note1, moves note2's visit history under note1, and
 * trashes note2.
 *
 * Flow: plan (refuse early, with reasons) → confirm → RE-plan (the vault may
 * have changed while the dialog was open) → execute:
 *   1. close note2's open focus session and flush it (no line may land at
 *      the old path after the move),
 *   2. edit note1 atomically (Vault.process; the link is re-verified at its
 *      offsets inside the transform — nothing is guessed),
 *   3. ensure note1's doc id (AFTER the edit: adding an id line would shift
 *      the link offsets the edit relies on),
 *   4. move note2's history files under note1,
 *   5. trash note2 — LAST, so any earlier failure leaves note2 in place.
 */
export class InlineNoteAction {
  constructor(
    private readonly planner: InlineNotePlanner,
    private readonly noteFileUtil: NoteFileUtil,
    private readonly docIdService: DocIdService,
    private readonly historyMerger: VhV3HistoryMerger,
    private readonly focusSessionReleaser: FocusSessionReleaser,
    private readonly dialogs: InlineNoteDialogs,
    private readonly userNotifier: UserNotifier,
  ) {
  }

  /** Entry point (file menu / command): checks, then asks to confirm. Never throws. */
  async run(note2: TFile): Promise<void> {
    try {
      const result = await this.planner.plan(note2);
      if (result.kind === 'refused') {
        this.dialogs.showRefusal(result.refusal);
        return;
      }
      this.dialogs.confirmInline(
        { inlinedNoteName: note2.basename, receivingNoteName: result.plan.note1.basename },
        () => void this.inlineConfirmed(note2),
      );
    } catch (error) {
      this.reportFailure(`Could not check whether "${note2.basename}" can be inlined. Nothing was changed.`, error);
    }
  }

  /** Runs after confirmation. Never throws — every outcome is reported. */
  async inlineConfirmed(note2: TFile): Promise<void> {
    let result: InlinePlanResult;
    try {
      result = await this.planner.plan(note2);
    } catch (error) {
      this.reportFailure(`Could not inline "${note2.basename}". Nothing was changed.`, error);
      return;
    }
    if (result.kind === 'refused') {
      this.dialogs.showRefusal(result.refusal);
      return;
    }
    await this.execute(result.plan);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async execute(plan: InlinePlan): Promise<void> {
    const note2Name = plan.note2.basename;
    const note1Name = plan.note1.basename;
    let note2Id: string | null;
    try {
      note2Id = await this.docIdService.getDocId(plan.note2);
      if (note2Id !== null && note2Id === await this.docIdService.getDocId(plan.note1)) {
        this.dialogs.showRefusal(InlineRefusals.sameDocId(note2Name, plan.note1.path));
        return;
      }
      if (note2Id !== null) {
        await this.focusSessionReleaser.releaseAndFlush(note2Id);
      }
      if (!(await this.editReceivingNote(plan))) {
        this.dialogs.showRefusal(InlineRefusals.noteChanged(plan.note1.path));
        return;
      }
    } catch (error) {
      this.reportFailure(`Could not inline "${note2Name}" into "${note1Name}". Nothing was changed.`, error);
      return;
    }

    try {
      await this.moveHistory(plan, note2Id);
    } catch (error) {
      this.reportFailure(
        `Inlined the content of "${note2Name}" into "${note1Name}", but moving its visit history failed, `
        + `so "${note2Name}" was kept. Delete it yourself once you no longer need it.`,
        error,
      );
      return;
    }

    try {
      await this.noteFileUtil.trashFile(plan.note2);
    } catch (error) {
      this.reportFailure(
        `Inlined "${note2Name}" into "${note1Name}" (content and visit history), but could not move `
        + `"${note2Name}" to the trash. Delete it yourself.`,
        error,
      );
      return;
    }
    this.userNotifier.showInfo(`Inlined "${note2Name}" into "${note1Name}".`);
  }

  /** @returns false when note1 changed so the link is no longer where planned. */
  private async editReceivingNote(plan: InlinePlan): Promise<boolean> {
    let placed = false;
    await this.noteFileUtil.process(plan.note1, (content) => {
      const result = MarkdownSectionPlacer.place(content, plan.note1Title, plan.linkSite, plan.inlined);
      if (result.kind !== 'placed') {
        return content;
      }
      placed = true;
      return FrontmatterMerger.merge(result.content, plan.inlined.frontmatterAdditions);
    });
    return placed;
  }

  /** Ensures note1's id, then moves note2's history under it (when note2 has any). */
  private async moveHistory(plan: InlinePlan, note2Id: string | null): Promise<void> {
    const note1Id = await this.docIdService.ensureDocId(plan.note1);
    // An id that is not filename-safe never got a history file — nothing to move.
    if (note2Id === null || !DocIdFilenameSafety.isFilenameSafeId(note2Id)) {
      return;
    }
    if (note1Id === null || !DocIdFilenameSafety.isFilenameSafeId(note1Id)) {
      throw new Error(`Receiving note has no usable doc id path=[${plan.note1.path}] docId=[${String(note1Id)}]`);
    }
    await this.historyMerger.mergeInto(note2Id, note1Id);
  }

  private reportFailure(message: string, error: unknown): void {
    console.error('[VHP][InlineNoteAction] inline note failed', error);
    this.userNotifier.showError(message);
  }
}
