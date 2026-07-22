/**
 * A treemap leaf paired with the two predicates the "already open?" guard needs.
 *
 * Kept obsidian-free (predicates precomputed at the Obsidian boundary in
 * main.ts) so the selection logic is a pure, unit-testable function.
 *
 * @typeParam L - the leaf handle type (WorkspaceLeaf in production).
 */
export interface HeatmapLeafCandidate<L> {
  readonly leaf: L;
  /** Vault-LEVEL heatmap (opened with no target folder), not folder-targeted. */
  readonly isVaultLevel: boolean;
  /** Currently RENDERING the whole-vault root (not drilled into a folder). */
  readonly isAtVaultRoot: boolean;
}

/**
 * Selects the existing heatmap leaf to reveal instead of opening a new
 * vault-level heatmap. A new open is suppressed only when a vault-level view
 * is CURRENTLY at the vault root — a drilled-in or folder-targeted view never
 * blocks a fresh vault-level open (owner decision).
 */
export class VaultRootHeatmapFinder {
  private constructor() {}

  /**
   * The first candidate that is a vault-level heatmap currently at the vault
   * root, or `null` when none — the caller then opens a new heatmap.
   */
  static firstVaultRootLeaf<L>(
    candidates: ReadonlyArray<HeatmapLeafCandidate<L>>,
  ): L | null {
    for (const candidate of candidates) {
      if (candidate.isVaultLevel && candidate.isAtVaultRoot) {
        return candidate.leaf;
      }
    }
    return null;
  }
}
