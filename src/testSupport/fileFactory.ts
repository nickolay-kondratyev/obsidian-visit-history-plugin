import { TFile } from 'obsidian';

interface TFileSpec {
  path: string;
  size?: number;
  ctime?: number;
  mtime?: number;
}

/**
 * Builds a TFile for unit tests.
 *
 * At test runtime 'obsidian' resolves to obsidianMock.ts (see vitest.config.ts),
 * so instanceof TFile checks in production code work against these instances.
 */
export function makeTFile(spec: TFileSpec): TFile {
  const file = new TFile();
  file.path = spec.path;
  const name = spec.path.split('/').at(-1) ?? spec.path;
  file.name = name;
  const dotIdx = name.lastIndexOf('.');
  file.basename = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  file.extension = dotIdx > 0 ? name.slice(dotIdx + 1) : '';
  file.stat = {
    ctime: spec.ctime ?? 0,
    mtime: spec.mtime ?? 0,
    size: spec.size ?? 0,
  };
  return file;
}
