import { TFile } from 'obsidian';
import { FrontmatterUtil } from '../core/util/file/frontmatter/FrontmatterUtil';

/**
 * In-memory FrontmatterUtil for unit tests. Holds frontmatter as plain
 * objects keyed by path (does NOT serialize YAML back into note content).
 */
export class FakeFrontmatterUtil implements FrontmatterUtil {
  readonly frontmatterByPath = new Map<string, Record<string, unknown>>();
  processFrontMatterCallCount = 0;

  seedFrontmatter(path: string, frontmatter: Record<string, unknown>): void {
    this.frontmatterByPath.set(path, frontmatter);
  }

  async processFrontMatter(file: TFile, mutate: (frontmatter: Record<string, unknown>) => void): Promise<void> {
    this.processFrontMatterCallCount++;
    const frontmatter = this.frontmatterByPath.get(file.path) ?? {};
    mutate(frontmatter);
    this.frontmatterByPath.set(file.path, frontmatter);
  }
}
