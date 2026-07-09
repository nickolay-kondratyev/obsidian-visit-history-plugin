import { TFile } from 'obsidian';

export interface VisitHistoryService {
  /** Records the visit to this file NOW. */
  recordVisitNowOnFocus(file: TFile): Promise<void>;

  /** Last visit stamp (epoch ms) across all devices, or null if never visited. */
  getLastVisitStamp(file: TFile): Promise<number | null>;
}
