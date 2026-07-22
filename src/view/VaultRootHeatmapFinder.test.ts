import { describe, expect, it } from 'vitest';
import { HeatmapLeafCandidate, VaultRootHeatmapFinder } from './VaultRootHeatmapFinder';

/** A leaf handle is opaque to the finder — a tagged string suffices in tests. */
type Leaf = string;

function candidate(
  leaf: Leaf,
  isVaultLevel: boolean,
  isAtVaultRoot: boolean,
): HeatmapLeafCandidate<Leaf> {
  return { leaf, isVaultLevel, isAtVaultRoot };
}

describe('VaultRootHeatmapFinder', () => {
  describe('firstVaultRootLeaf', () => {
    it('should return the leaf when a vault-level view is at the vault root', () => {
      const atRoot = candidate('vault-root-leaf', true, true);

      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([atRoot]);

      expect(result).toBe('vault-root-leaf');
    });

    it('should return null when the only vault-level view is drilled into a folder', () => {
      const drilledIn = candidate('drilled-leaf', true, false);

      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([drilledIn]);

      expect(result).toBeNull();
    });

    it('should return null when a folder-targeted view is at its own root', () => {
      // Folder-targeted (isVaultLevel false) must never block a vault-level open,
      // even though its own view happens to render its target folder's root.
      const folderTargeted = candidate('folder-leaf', false, true);

      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([folderTargeted]);

      expect(result).toBeNull();
    });

    it('should return the FIRST matching leaf when multiple vault-root views exist', () => {
      const first = candidate('first-leaf', true, true);
      const second = candidate('second-leaf', true, true);

      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([first, second]);

      expect(result).toBe('first-leaf');
    });

    it('should skip non-matching leaves before returning the first vault-root leaf', () => {
      const drilledIn = candidate('drilled-leaf', true, false);
      const folderTargeted = candidate('folder-leaf', false, true);
      const atRoot = candidate('vault-root-leaf', true, true);

      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([
        drilledIn,
        folderTargeted,
        atRoot,
      ]);

      expect(result).toBe('vault-root-leaf');
    });

    it('should return null when there are no candidate leaves', () => {
      const result = VaultRootHeatmapFinder.firstVaultRootLeaf([]);

      expect(result).toBeNull();
    });
  });
});
