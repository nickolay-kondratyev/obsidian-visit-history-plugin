import { TFile } from 'obsidian';
import { VisitStats } from './VisitStats';

/**
 * Read-only per-note visit stats lookup (last visit + total focus time) — the
 * heatmap's single dependency on visit history (VaultUtilDefault.getTrackedFiles).
 *
 * Aggregated over V3 focus sessions across ALL users and devices. A visit
 * counts only once its session CLOSES (navigation away, blur, idle timeout,
 * unload flush) — accepted owner decision.
 */
export interface VisitStatsProvider {
  /** Stats for the file; {@link VisitStats.EMPTY} if never visited (or no doc id). */
  getVisitStats(file: TFile): Promise<VisitStats>;
}
