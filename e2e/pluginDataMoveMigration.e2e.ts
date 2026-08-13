// S8 — Interim-top-dir → plugin-data migration (VhPluginDataMoveMigrationService).
//
// Seeds the retired interim VISIBLE top dir (`__visit_history/`) with a live V3
// payload (a `.vh_v3` file + the generated README) plus a NON-matching leftover
// file, launches real Obsidian, and asserts the plugin's onload migration:
//   - moves the `.vh_v3` + README under `.plugin_data/visit_history/…` (same
//     relative path, content byte-preserved),
//   - LEAVES the non-matching leftover behind (never touched),
//   - prunes the now-empty legacy subdirs, and removes `__visit_history/` itself
//     only when nothing is left in it.
//
// The seeded tree uses a DISTINCT user (`migrateduser`) so the pinned e2e_user's
// own README write (VhStartupTasks) can never overwrite the seeded payload —
// the moved bytes we assert on are purely the migration's doing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { VH_LEGACY_INTERIM_TOP_DIR, VH_README_FILENAME, VH_TOP_DIR } from './constants';
import { ObsidianHarness, SeedFile } from './obsidianHarness';
import { pollUntil } from './vhAssert';

const MIGRATED_USER = 'migrateduser';
const MIGRATED_DEVICE = 'olddevice';
const MIGRATED_DOC_ID = 'docid_aaaaaaaaaaaaaaaaaaaaaaaa_e';
const SEEDED_SESSION = '2026-01-02T03:04:05.678Z D:4200\n';
const SEEDED_README = '# seeded README — must survive the move verbatim\n';
const LEFTOVER_CONTENT = 'not a migratable file — must stay behind\n';

/** Relative path (under either top dir) of the seeded `.vh_v3` file. */
const VH_REL = `user/${MIGRATED_USER}/v3/focus_duration_per_device/${MIGRATED_DEVICE}/${MIGRATED_DOC_ID}.vh_v3`;
/** Relative path (under either top dir) of the seeded README. */
const README_REL = `user/${MIGRATED_USER}/v3/${VH_README_FILENAME}`;

function legacyPath(vaultDir: string, rel: string): string {
  return join(vaultDir, VH_LEGACY_INTERIM_TOP_DIR, rel);
}
function destPath(vaultDir: string, rel: string): string {
  return join(vaultDir, VH_TOP_DIR, rel);
}

/** The live V3 payload seeds present in every scenario. */
const PAYLOAD_SEEDS: readonly SeedFile[] = [
  { path: `${VH_LEGACY_INTERIM_TOP_DIR}/${VH_REL}`, content: SEEDED_SESSION },
  { path: `${VH_LEGACY_INTERIM_TOP_DIR}/${README_REL}`, content: SEEDED_README },
];

const POLL = { timeoutMs: 15_000 } as const;

test.describe('S8 __visit_history → .plugin_data/visit_history migration', () => {
  let harness: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  async function launchWith(seedFiles: readonly SeedFile[]): Promise<ObsidianHarness> {
    harness = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      seedFiles,
    });
    return harness;
  }

  test('moves live V3 payload to plugin-data, leaves a non-matching leftover behind', async () => {
    const leftoverSeed: SeedFile = {
      path: `${VH_LEGACY_INTERIM_TOP_DIR}/leftover.txt`,
      content: LEFTOVER_CONTENT,
    };
    const h = await launchWith([...PAYLOAD_SEEDS, leftoverSeed]);

    // Migration ran once the `.vh_v3` reached its destination (proves the walk moved it).
    const destVh = destPath(h.vaultDir, VH_REL);
    await pollUntil(() => existsSync(destVh), `moved .vh_v3 at ${destVh}`, POLL);

    // The two migratable payloads moved with byte-identical content.
    expect(readFileSync(destVh, 'utf8')).toBe(SEEDED_SESSION);
    expect(readFileSync(destPath(h.vaultDir, README_REL), 'utf8')).toBe(SEEDED_README);

    // Sources are gone (moved, not copied): now-empty legacy subdirs are pruned.
    await pollUntil(
      () => !existsSync(join(h.vaultDir, VH_LEGACY_INTERIM_TOP_DIR, 'user')),
      'legacy user/ subtree pruned',
      POLL,
    );
    expect(existsSync(legacyPath(h.vaultDir, VH_REL))).toBe(false);

    // The non-matching leftover is untouched, so `__visit_history/` itself survives.
    const leftover = join(h.vaultDir, VH_LEGACY_INTERIM_TOP_DIR, 'leftover.txt');
    expect(existsSync(leftover)).toBe(true);
    expect(readFileSync(leftover, 'utf8')).toBe(LEFTOVER_CONTENT);
  });

  test('removes __visit_history entirely once fully emptied (no leftover)', async () => {
    const h = await launchWith(PAYLOAD_SEEDS);

    const destVh = destPath(h.vaultDir, VH_REL);
    await pollUntil(() => existsSync(destVh), `moved .vh_v3 at ${destVh}`, POLL);
    expect(readFileSync(destVh, 'utf8')).toBe(SEEDED_SESSION);

    // Nothing left behind → the whole interim top dir is pruned post-order.
    await pollUntil(
      () => !existsSync(join(h.vaultDir, VH_LEGACY_INTERIM_TOP_DIR)),
      'interim __visit_history/ removed',
      POLL,
    );
  });
});
