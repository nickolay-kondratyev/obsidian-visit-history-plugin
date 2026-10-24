import { App, Notice, TFile } from 'obsidian';
import { ConfirmModal } from '../../../../settingsTab/ConfirmModal';
import { TimestampClusterDetector } from '../../../util/time/TimestampClusterDetector';
import { UserNotifier } from '../../../util/userComm/UserNotifier';
import { VaultUtil } from '../../../util/vault/VaultUtil';
import { GitHistory } from '../GitHistory';
import { GitMtimeRestorer } from '../GitMtimeRestorer';
import { GitMtimeRestoreTexts } from '../GitMtimeRestoreTexts';
import { IsomorphicGitHistory } from './IsomorphicGitHistory';

type GitDirKind = 'folder' | 'file' | 'none';

/**
 * "Restore modified times from git" — the ONE code path behind the command
 * and the heatmap banner's button. Obsidian boundary (modal, notices, `.git`
 * probe) — intentionally thin and unit-untested (the 'obsidian' stand-in has
 * no DOM); the decisions live in GitMtimeRestorer / GitCommitTimeResolver /
 * TimestampClusterDetector, the texts in GitMtimeRestoreTexts.
 *
 * Targets = the tracked files whose mtime is in the cluster — the SAME
 * detector as the banner, over ALL tracked files (not just the current view).
 * Runs only when the user acts, and writes only after they confirm.
 */
export class GitMtimeRestoreAction {
  /** Concurrent runs would race on the same files. */
  private running = false;

  constructor(
    private readonly app: App,
    private readonly vaultUtil: VaultUtil,
    private readonly restorer: GitMtimeRestorer,
    /** Fresh reader per run — its object cache is released with the run. */
    private readonly createHistory: () => GitHistory,
    private readonly userNotifier: UserNotifier,
    /** Re-reads open heatmaps: they don't listen to modify events. */
    private readonly onRestored: () => void,
  ) {
  }

  /** Whether the vault root holds a `.git` FOLDER — gates the banner button. Never throws. */
  async hasGitRepo(): Promise<boolean> {
    try {
      return (await this.gitDirKind()) === 'folder';
    } catch (error) {
      console.error('[VHP][GitMtimeRestoreAction] probing .git failed', error);
      return false;
    }
  }

  /** Entry point: checks, asks to confirm, then restores. Never throws. */
  async run(): Promise<void> {
    if (this.running) {
      this.userNotifier.showInfo(GitMtimeRestoreTexts.ALREADY_RUNNING);
      return;
    }
    try {
      const gitDir = await this.gitDirKind();
      if (gitDir !== 'folder') {
        this.userNotifier.showInfo(gitDir === 'none' ? GitMtimeRestoreTexts.NOT_A_REPO : GitMtimeRestoreTexts.UNSUPPORTED_REPO);
        return;
      }
      const cluster = TimestampClusterDetector.detect(this.vaultUtil.getTrackedTFiles(), f => f.stat.mtime);
      if (cluster === undefined) {
        this.userNotifier.showInfo(GitMtimeRestoreTexts.NOTHING_CLUSTERED);
        return;
      }
      new ConfirmModal(this.app, {
        title: GitMtimeRestoreTexts.ACTION_NAME,
        body: GitMtimeRestoreTexts.confirmBody(cluster.members.length),
        ctaLabel: GitMtimeRestoreTexts.CONFIRM_CTA,
        onConfirm: () => void this.restore(cluster.members),
      }).open();
    } catch (error) {
      console.error('[VHP][GitMtimeRestoreAction] preparing the restore failed', error);
      this.userNotifier.showError(GitMtimeRestoreTexts.READ_FAILED);
    }
  }

  private async restore(files: readonly TFile[]): Promise<void> {
    if (this.running) {
      this.userNotifier.showInfo(GitMtimeRestoreTexts.ALREADY_RUNNING);
      return;
    }
    this.running = true;
    const progress = new DelayedProgressNotice(GitMtimeRestoreTexts.CHECKING_FILES);
    try {
      const run = await this.restorer.restore(
        files,
        this.createHistory(),
        p => progress.update(GitMtimeRestoreTexts.progress(p)),
      );
      progress.close();
      if (run.kind === 'noCommits') {
        this.userNotifier.showInfo(GitMtimeRestoreTexts.NO_COMMITS);
        return;
      }
      this.userNotifier.showInfo(GitMtimeRestoreTexts.result(run.outcome));
      this.onRestored();
    } catch (error) {
      progress.close();
      console.error('[VHP][GitMtimeRestoreAction] restoring modified times failed', error);
      this.userNotifier.showError(GitMtimeRestoreTexts.READ_FAILED);
    } finally {
      this.running = false;
    }
  }

  /**
   * A `.git` FILE means a worktree/submodule pointing elsewhere — not supported.
   * A repo root above the vault has no `.git` here → 'none' (non-goal).
   */
  private async gitDirKind(): Promise<GitDirKind> {
    const stat = await this.app.vault.adapter.stat(IsomorphicGitHistory.GIT_DIR);
    if (stat === null) return 'none';
    return stat.type === 'folder' ? 'folder' : 'file';
  }
}

/**
 * Progress Notice that appears only once the run passes
 * {@link DelayedProgressNotice.SHOW_AFTER_MS} (quick runs stay silent until
 * the result), then shows the latest message, refreshed at most every
 * {@link DelayedProgressNotice.UPDATE_EVERY_MS} (the walk reports per commit).
 */
class DelayedProgressNotice {
  static readonly SHOW_AFTER_MS = 1000;
  static readonly UPDATE_EVERY_MS = 250;
  /** Obsidian Notice duration 0 = stays until hidden. */
  private static readonly UNTIL_HIDDEN = 0;

  private notice: Notice | undefined;
  private lastShownAtMs = 0;
  private readonly showTimer: number;

  constructor(private latestMessage: string) {
    this.showTimer = window.setTimeout(() => this.show(), DelayedProgressNotice.SHOW_AFTER_MS);
  }

  update(message: string): void {
    this.latestMessage = message;
    if (this.notice === undefined || Date.now() - this.lastShownAtMs < DelayedProgressNotice.UPDATE_EVERY_MS) return;
    this.notice.setMessage(message);
    this.lastShownAtMs = Date.now();
  }

  close(): void {
    window.clearTimeout(this.showTimer);
    this.notice?.hide();
    this.notice = undefined;
  }

  private show(): void {
    this.notice = new Notice(this.latestMessage, DelayedProgressNotice.UNTIL_HIDDEN);
    this.lastShownAtMs = Date.now();
  }
}
