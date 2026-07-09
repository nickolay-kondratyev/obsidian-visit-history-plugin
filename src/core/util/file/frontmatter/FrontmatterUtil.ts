import { TFile } from 'obsidian';

/**
 * Atomic read-modify-write access to a note's YAML frontmatter.
 * Abstraction over Obsidian's FileManager.processFrontMatter so core logic
 * stays testable without the Obsidian runtime.
 */
export interface FrontmatterUtil {
  /**
   * Atomically reads, lets `mutate` modify, and saves the note's frontmatter.
   * A frontmatter block is created if the note has none.
   * NOTE: Obsidian re-serializes the whole frontmatter block on save — only
   * call this when a write is intended.
   */
  processFrontMatter(file: TFile, mutate: (frontmatter: Record<string, unknown>) => void): Promise<void>;
}
