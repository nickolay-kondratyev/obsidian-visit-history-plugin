import { afterEach, describe, expect, it, vi } from 'vitest';
import { OsUserNameLookup, UserNameCache, UserNameProviderDefault } from './UserNameProvider';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';
import { FakeUserNamePrompt } from '../../../../testSupport/FakeUserNamePrompt';

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
  prompt: FakeUserNamePrompt;
  hidden: FakeHiddenFileUtil;
  cache: InMemoryUserNameCache;
}

function setup(osUserName: string | null, promptAnswer: string | null): Setup {
  const hidden = new FakeHiddenFileUtil();
  const cache = new InMemoryUserNameCache();
  const prompt = new FakeUserNamePrompt(promptAnswer);
  const provider = new UserNameProviderDefault(
    hidden, prompt, new FixedOsUserNameLookup(osUserName), cache,
  );
  return { provider, prompt, hidden, cache };
}

/** Seeds one `__visit_history/user/<name>/...` tree (a folder implied by a file). */
function seedVhUserTree(hidden: FakeHiddenFileUtil, userName: string): void {
  hidden.seedFile(`__visit_history/user/${userName}/v3/focus_duration_per_device/host/doc.vh_v3`, 'x\n');
}

describe('UserNameProviderDefault', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserName', () => {
    it('should return the cached name (first pin wins)', async () => {
      // GIVEN a previously pinned name
      const { provider, cache } = setup('os-name', 'other-answer');
      cache.seed('pinned-name');
      // WHEN / THEN the pinned name wins
      expect(await provider.getUserName()).toBe('pinned-name');
    });

    it('should never prompt an already-pinned device', async () => {
      // GIVEN a previously pinned name
      const { provider, prompt, cache } = setup('os-name', 'other-answer');
      cache.seed('pinned-name');
      // WHEN
      await provider.getUserName();
      // THEN the modal is never shown
      expect(prompt.promptCount).toBe(0);
    });

    it('should offer the existing VH user names to the prompt', async () => {
      // GIVEN two user dirs synced into the vault
      const { provider, prompt, hidden } = setup(null, 'alice');
      seedVhUserTree(hidden, 'alice');
      seedVhUserTree(hidden, 'bob');
      // WHEN
      await provider.getUserName();
      // THEN both are offered as joinable identities
      expect(prompt.lastRequest?.existingNames.sort()).toEqual(['alice', 'bob']);
    });

    it('should pre-fill the prompt with the SANITIZED OS login name on desktop', async () => {
      // GIVEN a desktop OS login name with uppercase and a space
      const { provider, prompt } = setup('John Doe', 'john_doe');
      // WHEN
      await provider.getUserName();
      // THEN the pre-fill is the sanitized form
      expect(prompt.lastRequest?.defaultName).toBe('john_doe');
    });

    it('should pre-fill nothing on mobile (no OS user name)', async () => {
      // GIVEN mobile — the OS lookup returns null
      const { provider, prompt } = setup(null, 'alice');
      // WHEN
      await provider.getUserName();
      // THEN there is no pre-fill
      expect(prompt.lastRequest?.defaultName).toBeNull();
    });

    it('should return the confirmed name', async () => {
      // GIVEN the human confirms a typed name
      const { provider } = setup(null, 'alice');
      // WHEN / THEN
      expect(await provider.getUserName()).toBe('alice');
    });

    it('should pin the confirmed name to the cache', async () => {
      // GIVEN the human confirms a typed name
      const { provider, cache } = setup(null, 'alice');
      // WHEN
      await provider.getUserName();
      // THEN the name is pinned for all future loads
      expect(cache.get()).toBe('alice');
    });

    it('should return null when the prompt is dismissed', async () => {
      // GIVEN the human dismisses the modal (Esc/close/cancel)
      const { provider } = setup('os-name', null);
      // WHEN / THEN no name this session
      expect(await provider.getUserName()).toBeNull();
    });

    it('should pin nothing when the prompt is dismissed', async () => {
      // GIVEN a dismissed modal
      const { provider, cache } = setup('os-name', null);
      // WHEN
      await provider.getUserName();
      // THEN the device stays unpinned
      expect(cache.get()).toBeNull();
    });

    it('should prompt again on the next resolution after a dismissal', async () => {
      // GIVEN a dismissed modal
      const { provider, prompt } = setup('os-name', null);
      await provider.getUserName();
      // WHEN resolving again (next plugin start)
      await provider.getUserName();
      // THEN the modal is shown again
      expect(prompt.promptCount).toBe(2);
    });

    it('should not pin an invalid name returned by the prompt (defense in depth)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // GIVEN a (buggy) prompt returning a name outside the strict charset
      const { provider, cache } = setup(null, 'Bad Name!');
      // WHEN
      await provider.getUserName();
      // THEN nothing is pinned
      expect(cache.get()).toBeNull();
    });

    it('should return null when the prompt returns an invalid name', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // GIVEN a (buggy) prompt returning an invalid name
      const { provider } = setup(null, 'Bad Name!');
      // WHEN / THEN
      expect(await provider.getUserName()).toBeNull();
    });

    it('should pin an EXISTING dir name even when outside the strict charset (joining)', async () => {
      // GIVEN an existing user dir named before the lowercase rule
      const { provider, hidden } = setup(null, 'Nickolay');
      seedVhUserTree(hidden, 'Nickolay');
      // WHEN / THEN picking it joins that identity
      expect(await provider.getUserName()).toBe('Nickolay');
    });
  });
});
