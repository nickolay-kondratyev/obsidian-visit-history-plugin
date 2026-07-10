import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';
import { LinkUtil } from '../../util/linkUtil/LinkUtil';
import { DocIdService } from '../docId/DocIdService';
import { DocIdBackfillService } from '../docId/DocIdBackfillService';
import { VhV2FocusStore } from '../visitHistoryService/v2/VhV2FocusStore';
import { DocIdFilenameSafety } from '../visitHistoryService/DocIdFilenameSafety';
import { V1FocusFileParser } from './V1FocusFileParser';
import { V1FocusFileRepo, V1VhFile } from './V1FocusFileRepo';

/** Outcome of one V1 → V2 migration run. */
export interface VhV1MigrationResult {
  /** V1 files whose stamps landed in V2. */
  migratedV1FileCount: number;
  /** Distinct (device, doc) V2 files written. */
  migratedDocFileCount: number;
  /**
   * V1 files that could NOT be migrated (missing/unresolvable backlink, doc
   * that cannot carry an id, filename-unsafe id). Deleted along with the V1
   * tree (owner decision) — their history is dropped.
   */
  unmigratableV1FileCount: number;
  /**
   * True when every migrated stamp was read back from V2 — only then is the
   * V1 tree deleted. False → nothing was deleted.
   */
  validationPassed: boolean;
}

/** V1 → V2 migration entry point (implemented by VhV1ToV2MigrationService). */
export interface VhV1Migration {
  /** Runs the migration when V1 exists; null when there is nothing to migrate. */
  migrateIfV1Present(): Promise<VhV1MigrationResult | null>;
}

/** Stamps destined for one (device, doc id) V2 focus file. */
interface MigrationGroup {
  deviceName: string;
  docId: string;
  v1StampsMs: number[];
}

/**
 * One-shot auto migration of legacy V1 visit history to V2 (see
 * docs/visit-history-format.md). Runs on plugin load when `_visit_history/`
 * exists:
 *
 *   1. Doc id backfill over the whole vault (V2 files are keyed by doc id).
 *   2. Parse every V1 focus file; group stamps per (device, doc id).
 *   3. Merge into V2 files (union with any existing V2 stamps; the store
 *      sorts + dedupes).
 *   4. Validate: every V1 stamp must be readable back from V2.
 *   5. All valid → PERMANENTLY delete the V1 tree (unmigratable files
 *      included — owner decision). Any failure → delete nothing.
 *
 * Unexpected I/O errors propagate to the caller (bootstrap notifies the
 * user); the V1 tree is never deleted on an aborted run.
 */
export class VhV1ToV2MigrationService implements VhV1Migration {
  constructor(
    private readonly v1FocusFileRepo: V1FocusFileRepo,
    private readonly noteFileUtil: NoteFileUtil,
    private readonly linkUtil: LinkUtil,
    private readonly docIdService: DocIdService,
    private readonly docIdBackfillService: DocIdBackfillService,
    private readonly vhV2FocusStore: VhV2FocusStore,
  ) {
  }

  async migrateIfV1Present(): Promise<VhV1MigrationResult | null> {
    if (!this.v1FocusFileRepo.v1TreeExists()) {
      return null;
    }

    // Every doc needs an id before its history can be keyed by it.
    await this.docIdBackfillService.backfillAll();

    const v1Files = this.v1FocusFileRepo.findAllV1FocusFiles();
    const groups = new Map<string, MigrationGroup>();
    let migratedV1FileCount = 0;
    let unmigratableV1FileCount = 0;

    for (const v1File of v1Files) {
      const stampsForDoc = await this.resolveToDocGroup(v1File);
      if (stampsForDoc === null) {
        unmigratableV1FileCount++;
        continue;
      }
      migratedV1FileCount++;
      this.mergeIntoGroups(groups, stampsForDoc);
    }

    for (const group of groups.values()) {
      await this.writeGroupToV2(group);
    }

    const validationPassed = await this.validateAllGroups(groups);
    if (validationPassed) {
      await this.v1FocusFileRepo.deleteV1TreePermanently();
    }

    return {
      migratedV1FileCount,
      migratedDocFileCount: groups.size,
      unmigratableV1FileCount,
      validationPassed,
    };
  }

  // ── private ─────────────────────────────────────────────────────────────

  /**
   * Parses one V1 file and resolves it to its (device, doc id) group.
   * Null when the file cannot be tied to an id-carrying doc (unmigratable).
   */
  private async resolveToDocGroup(v1File: V1VhFile): Promise<MigrationGroup | null> {
    const parsed = V1FocusFileParser.parse(await this.noteFileUtil.cachedRead(v1File.file));
    if (parsed.backlinkTargetLinkText === null) {
      this.logUnmigratable(v1File, 'missing backlink line');
      return null;
    }

    const note = this.linkUtil.resolveLinkTarget(parsed.backlinkTargetLinkText, v1File.file.path);
    if (note === null) {
      this.logUnmigratable(v1File, `backlink target not found target=[${parsed.backlinkTargetLinkText}]`);
      return null;
    }

    const docId = await this.docIdService.ensureDocId(note);
    if (docId === null) {
      this.logUnmigratable(v1File, `doc cannot carry an id notePath=[${note.path}]`);
      return null;
    }
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      this.logUnmigratable(v1File, `doc id not filename-safe docId=[${docId}]`);
      return null;
    }

    return { deviceName: v1File.deviceName, docId, v1StampsMs: parsed.stampsMs };
  }

  /** Accumulates a file's stamps into its (device, doc id) group. */
  private mergeIntoGroups(groups: Map<string, MigrationGroup>, addition: MigrationGroup): void {
    const key = `${addition.deviceName}/${addition.docId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.v1StampsMs.push(...addition.v1StampsMs);
    } else {
      groups.set(key, addition);
    }
  }

  /** Union of the group's V1 stamps with whatever V2 already holds. */
  private async writeGroupToV2(group: MigrationGroup): Promise<void> {
    const existingV2Stamps = await this.vhV2FocusStore.readStampsMs(group.deviceName, group.docId);
    await this.vhV2FocusStore.writeStampsMs(
      group.deviceName,
      group.docId,
      [...existingV2Stamps, ...group.v1StampsMs],
    );
  }

  /** Every V1 stamp of every group must be readable back from V2. */
  private async validateAllGroups(groups: Map<string, MigrationGroup>): Promise<boolean> {
    for (const group of groups.values()) {
      const v2Stamps = new Set(await this.vhV2FocusStore.readStampsMs(group.deviceName, group.docId));
      const missing = group.v1StampsMs.filter(ms => !v2Stamps.has(ms));
      if (missing.length > 0) {
        console.error(
          `[VHP][VhV1ToV2Migration] validation failed device=[${group.deviceName}] docId=[${group.docId}] missingStamps=[${missing.join(',')}]`,
        );
        return false;
      }
    }
    return true;
  }

  private logUnmigratable(v1File: V1VhFile, reason: string): void {
    console.error(`[VHP][VhV1ToV2Migration] unmigratable V1 file path=[${v1File.file.path}]: ${reason}`);
  }
}
