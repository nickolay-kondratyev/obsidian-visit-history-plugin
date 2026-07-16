import { TFile } from 'obsidian';
import { DocIdService } from 'obsidian-id-lib';
import { VaultUtil } from '../../util/vault/VaultUtil';

/** Outcome of a vault-wide doc id backfill run. */
export interface DocIdBackfillResult {
  /**
   * Number of eligible files the run covered. Files that already had an id
   * are included (they are no-op reads).
   */
  eligibleFileCount: number;
  /** Paths whose content could not be handled (e.g. malformed canvas JSON). */
  failedPaths: string[];
}

/**
 * Vault-wide doc id backfill: ensures every eligible tracked file (md incl.
 * .excalidraw.md, canvas) carries a persistent doc id — the same per-file
 * operation DocIdFocusListener triggers on focus.
 * Invoked from the settings tab's "File modifying actions" area.
 */
export interface DocIdBackfillService {
  /**
   * Runs the backfill. Files that already have an id stay untouched.
   * Concurrent calls JOIN the in-flight run and receive its result.
   */
  backfillAll(): Promise<DocIdBackfillResult>;
}

export class DocIdBackfillServiceDefault implements DocIdBackfillService {
  // WHY-NOT InFlightDropGuard: it has DROP semantics and returns void, but
  // callers here need the result — joining the in-flight run is correct for
  // a vault-wide action (a second click reports the same outcome).
  private inFlight: Promise<DocIdBackfillResult> | null = null;

  constructor(
    private readonly vaultUtil: VaultUtil,
    private readonly docIdService: DocIdService,
  ) {
  }

  backfillAll(): Promise<DocIdBackfillResult> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<DocIdBackfillResult> {
    const tracked = await this.vaultUtil.getTrackedFiles();
    const eligibleFiles = tracked
      .map(t => t.file)
      .filter(f => this.docIdService.isEligible(f));

    const failedPaths: string[] = [];
    // Sequential on purpose: one write at a time keeps vault I/O gentle and
    // failure attribution simple; already-id'd files are cheap cached reads.
    for (const file of eligibleFiles) {
      if (await this.ensureIdSafely(file) === null) {
        failedPaths.push(file.path);
      }
    }
    return { eligibleFileCount: eligibleFiles.length, failedPaths };
  }

  /** ensureDocId that never throws — one broken file must not abort the run. */
  private async ensureIdSafely(file: TFile): Promise<string | null> {
    try {
      return await this.docIdService.ensureDocId(file);
    } catch (error) {
      console.error(`[VHP][DocIdBackfillService] ensure failed path=[${file.path}]`, error);
      return null;
    }
  }
}
