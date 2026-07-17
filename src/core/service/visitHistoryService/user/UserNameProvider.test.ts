import { describe, expect, it } from 'vitest';
import { OsUserNameLookup, UserNameCache, UserNameProviderDefault } from './UserNameProvider';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

class FixedOsUserNameLookup implements OsUserNameLookup {
  constructor(private readonly name: string | null) {
  }

  getOsUserName(): string | null {
    return this.name;
  }
}

class InMemoryUserNameCache implements UserNameCache {
  private cached: string | null = null;

  seed(userName: string): void {
    this.cached = userName;
  }

  get(): string | null {
    return this.cached;
  }

  set(userName: string): void {
    this.cached = userName;
  }
}

interface Setup {
  provider: UserNameProviderDefault;
  hidden: FakeHiddenFileUtil;
  cache: InMemoryUserNameCache;
}

function setup(osUserName: string | null): Setup {
  const hidden = new FakeHiddenFileUtil();
  const cache = new InMemoryUserNameCache();
  const provider = new UserNameProviderDefault(hidden, new FixedOsUserNameLookup(osUserName), cache);
  return { provider, hidden, cache };
}

/** Seeds one `__visit_history/user/<name>/...` tree (a folder implied by a file). */
function seedVhUserTree(hidden: FakeHiddenFileUtil, userName: string): void {
  hidden.seedFile(`__visit_history/user/${userName}/v2/focus_per_device/host/doc.vh_v2`, 'x\n');
}

describe('UserNameProviderDefault', () => {
  describe('getUserName', () => {
    it('should return the cached name without re-resolving (first resolution wins)', async () => {
      // GIVEN a previously persisted name, and an OS that would now resolve differently
      const { provider, cache } = setup('different-os-name');
      cache.seed('persisted-name');
      // WHEN / THEN the cached name wins
      expect(await provider.getUserName()).toBe('persisted-name');
    });

    it('should use the OS user name on desktop', async () => {
      // GIVEN a desktop OS user
      const { provider } = setup('nickolay');
      // WHEN / THEN
      expect(await provider.getUserName()).toBe('nickolay');
    });

    it('should persist the resolved name to the cache', async () => {
      // GIVEN a first-ever resolution
      const { provider, cache } = setup('nickolay');
      // WHEN
      await provider.getUserName();
      // THEN the name is cached for all future loads
      expect(cache.get()).toBe('nickolay');
    });

    it('should adopt the single existing VH user name on mobile', async () => {
      // GIVEN mobile (no OS user name) and exactly one user dir synced in
      const { provider, hidden } = setup(null);
      seedVhUserTree(hidden, 'nickolay');
      // WHEN / THEN this device joins that user
      expect(await provider.getUserName()).toBe('nickolay');
    });

    it('should fall back to a mobile-user id when multiple VH user names exist', async () => {
      // GIVEN mobile and two user dirs — ambiguous, cannot pick one
      const { provider, hidden } = setup(null);
      seedVhUserTree(hidden, 'alice');
      seedVhUserTree(hidden, 'bob');
      // WHEN / THEN a generated persistent id is used instead
      expect(await provider.getUserName()).toMatch(/^mobile-user-/);
    });

    it('should fall back to a mobile-user id when no VH user dir exists yet', async () => {
      // GIVEN mobile on a fresh vault
      const { provider } = setup(null);
      // WHEN / THEN
      expect(await provider.getUserName()).toMatch(/^mobile-user-/);
    });

    it('should return the same generated name on subsequent calls (persisted)', async () => {
      // GIVEN a generated mobile fallback name
      const { provider } = setup(null);
      const first = await provider.getUserName();
      // WHEN resolving again
      const second = await provider.getUserName();
      // THEN the persisted name is stable
      expect(second).toBe(first);
    });
  });
});
