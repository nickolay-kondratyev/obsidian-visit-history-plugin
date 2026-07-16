import { TFile } from 'obsidian';
import { DeviceNameProvider } from '../core/util/env/DeviceNameProvider';
import { TrackedFile, VaultUtil } from '../core/util/vault/VaultUtil';
import { DocIdService } from 'obsidian-id-lib';

/** VaultUtil fake serving a fixed file list as tracked files (never-visited). */
export class FakeVaultUtil implements VaultUtil {
  constructor(private readonly files: TFile[]) {
  }

  getName(): string {
    return 'test-vault';
  }

  getTrackedTFiles(): TFile[] {
    return [...this.files];
  }

  async getTrackedFiles(): Promise<TrackedFile[]> {
    return this.files.map(file => ({
      file,
      timeMetadata: { createdMs: 0, modifiedMs: 0, visitedMs: null },
    }));
  }
}

/**
 * DocIdService fake keyed by file path. ensureId assigns `docid-for:<path>`
 * unless an id was pre-seeded; getDocId is strictly read-only.
 */
export class FakeDocIdService implements DocIdService {
  private readonly idByPath = new Map<string, string>();
  /** Paths ensureDocId returned null for (simulates unhandled content). */
  readonly failingPaths = new Set<string>();
  /** Paths ensureDocId throws for (simulates IO failure). */
  readonly throwingPaths = new Set<string>();
  readonly ensuredPaths: string[] = [];

  seedId(path: string, id: string): void {
    this.idByPath.set(path, id);
  }

  async ensureDocId(file: TFile): Promise<string | null> {
    this.ensuredPaths.push(file.path);
    if (this.throwingPaths.has(file.path)) {
      throw new Error(`simulated ensureDocId IO failure path=[${file.path}]`);
    }
    if (this.failingPaths.has(file.path)) return null;
    if (!this.isEligible(file)) return null;
    const existing = this.idByPath.get(file.path);
    if (existing !== undefined) return existing;
    // Deterministic per path, filename-safe (VH uses ids as filenames).
    const generated = `docid-for-${file.path.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    this.idByPath.set(file.path, generated);
    return generated;
  }

  async getDocId(file: TFile): Promise<string | null> {
    return this.idByPath.get(file.path) ?? null;
  }

  isEligible(file: TFile): boolean {
    return file.extension === 'md' || file.extension === 'canvas';
  }
}

export class FixedDeviceNameProvider implements DeviceNameProvider {
  constructor(private readonly name: string) {
  }

  getDeviceName(): string {
    return this.name;
  }
}
