import { TFile } from 'obsidian';

/**
 * Read-only "when was this file last visited" lookup — the heatmap's single
 * dependency on visit history (VaultUtilDefault.getTrackedFiles).
 *
 * Last visited = most recent V3 focus-session START stamp across all devices.
 * A visit becomes visible only once its session CLOSES (navigation away,
 * blur, idle timeout, unload flush) — accepted owner decision.
 */
export interface LastVisitProvider {
  /** Last visit stamp (epoch ms) across all devices, or null if never visited. */
  getLastVisitStamp(file: TFile): Promise<number | null>;
}
