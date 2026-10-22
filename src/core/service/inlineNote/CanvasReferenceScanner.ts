import { TFile } from 'obsidian';
import { CanvasNoteReference } from './NoteReference';
import { MarkdownLinkSyntax } from './MarkdownLinkSyntax';

/** Resolves a link path written in `sourcePath` to a vault path (null when unresolved). */
export type LinkpathResolver = (linkpath: string, sourcePath: string) => string | null;

/**
 * Finds references to one note inside a canvas file's JSON.
 *
 * WHY our own scan: Obsidian's metadataCache does not index canvases, and a
 * canvas reference must never be missed by the inline-note link count (the
 * inlined note is trashed — a missed card would break).
 *
 * Counts file cards (`type: "file"`, `file` = vault path) and every internal
 * link in text cards. Unparseable JSON yields no references (Obsidian cannot
 * open such a canvas either).
 */
export class CanvasReferenceScanner {
  static scan(
    canvasFile: TFile,
    canvasJson: string,
    targetPath: string,
    resolveLinkpath: LinkpathResolver,
  ): CanvasNoteReference[] {
    const references: CanvasNoteReference[] = [];
    for (const node of CanvasReferenceScanner.nodesOf(canvasJson)) {
      if (node.type === 'file' && node.file === targetPath) {
        references.push({ kind: 'canvas', sourceFile: canvasFile, subpath: typeof node.subpath === 'string' ? node.subpath : '' });
      } else if (node.type === 'text' && typeof node.text === 'string') {
        for (const link of MarkdownLinkSyntax.findAllLinks(node.text)) {
          if (link.linkpath !== '' && resolveLinkpath(link.linkpath, canvasFile.path) === targetPath) {
            references.push({ kind: 'canvas', sourceFile: canvasFile, subpath: link.subpath });
          }
        }
      }
    }
    return references;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private static nodesOf(canvasJson: string): Record<string, unknown>[] {
    if (canvasJson.trim() === '') {
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(canvasJson);
    } catch {
      return [];
    }
    if (!CanvasReferenceScanner.isRecord(parsed) || !Array.isArray(parsed.nodes)) {
      return [];
    }
    return parsed.nodes.filter((node): node is Record<string, unknown> => CanvasReferenceScanner.isRecord(node));
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
