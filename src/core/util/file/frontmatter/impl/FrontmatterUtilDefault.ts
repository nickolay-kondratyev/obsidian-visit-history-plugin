import { App, TFile } from 'obsidian';
import { FrontmatterUtil } from '../FrontmatterUtil';

export class FrontmatterUtilDefault implements FrontmatterUtil {
  constructor(private readonly app: App) {
  }

  async processFrontMatter(file: TFile, mutate: (frontmatter: Record<string, unknown>) => void): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, mutate);
  }
}
