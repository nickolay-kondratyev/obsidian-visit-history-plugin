/**
 * Tree node for the vault treemap visualization.
 *
 * Dual-purpose type:
 * - Folder nodes have `children`, no file-specific fields.
 * - Leaf nodes have `type`, `size`, and timestamp fields, no `children`.
 *
 * Used by:
 * - `buildVaultTree` (viewModel) — constructs the tree from vault files
 * - View components — render the tree as SVG
 *
 * Relationship to FileTimeMetadata:
 * - `FileTimeMetadata` (src/core/data/FileTimeMetadata.ts) is the flat per-file
 *   tracking record with `visitedMs`.
 * - `buildVaultTree` maps `FileTimeMetadata.visitedMs` → `VaultNode.lastVisitedAt`.
 * - They remain separate types — different purposes, different consumers.
 */
export interface VaultNode {
  /** Display name — file name (leaf) or folder name (branch). */
  name: string;

  /** Present only on folder nodes. Absent on leaf nodes. */
  children?: VaultNode[];

  // ── Leaf-only fields (undefined on folders) ──────────────────

  /** File extension category. Only defined for leaf (file) nodes. */
  type?: 'md' | 'canvas' | 'excalidraw';

  /** File size in bytes. Only defined for leaf nodes. */
  size?: number;

  /** Unix milliseconds — from TFile.stat.ctime */
  createdAt?: number;

  /** Unix milliseconds — from TFile.stat.mtime */
  lastModifiedAt?: number;

  /**
   * Unix milliseconds — plugin-tracked last open time.
   * `null` means the file has never been opened (or tracking not yet active).
   * `undefined` on folder nodes.
   */
  lastVisitedAt?: number | null;
}
