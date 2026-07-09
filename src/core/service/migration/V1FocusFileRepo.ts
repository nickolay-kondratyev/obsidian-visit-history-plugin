import { App, TFile, TFolder } from 'obsidian';
import { VISIT_HISTORY_TOP_DIR } from '../../../Constants';

const V1_FOCUS_DIR = `${VISIT_HISTORY_TOP_DIR}/v1/focus`;

/** One V1 focus file together with the device directory it lives in. */
export interface V1VhFile {
  file: TFile;
  deviceName: string;
}

/**
 * Access to the legacy V1 visit-history tree (`_visit_history/`). V1 is a
 * regular (non-dot) folder, so the Vault API sees it — no adapter needed.
 * Exists only to feed VhV1ToV2MigrationService.
 */
export interface V1FocusFileRepo {
  /** True when the legacy `_visit_history/` folder is present. */
  v1TreeExists(): boolean;

  /** Every V1 focus file across all device directories. */
  findAllV1FocusFiles(): V1VhFile[];

  /**
   * PERMANENTLY deletes the whole `_visit_history/` tree (owner decision —
   * migration validates before calling this; no trash fallback).
   */
  deleteV1TreePermanently(): Promise<void>;
}

export class V1FocusFileRepoDefault implements V1FocusFileRepo {
  constructor(private readonly app: App) {
  }

  v1TreeExists(): boolean {
    return this.app.vault.getFolderByPath(VISIT_HISTORY_TOP_DIR) !== null;
  }

  findAllV1FocusFiles(): V1VhFile[] {
    const focusFolder = this.app.vault.getFolderByPath(V1_FOCUS_DIR);
    if (!focusFolder) {
      return [];
    }
    const result: V1VhFile[] = [];
    for (const deviceFolder of focusFolder.children) {
      if (!(deviceFolder instanceof TFolder)) continue;
      for (const child of deviceFolder.children) {
        if (child instanceof TFile) {
          result.push({ file: child, deviceName: deviceFolder.name });
        }
      }
    }
    return result;
  }

  async deleteV1TreePermanently(): Promise<void> {
    const topFolder = this.app.vault.getFolderByPath(VISIT_HISTORY_TOP_DIR);
    if (topFolder) {
      // WHY-NOT trashFile: permanent deletion is an explicit owner decision —
      // migration only reaches this after validating every stamp in V2.
      // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file
      await this.app.vault.delete(topFolder, true);
    }
  }
}
