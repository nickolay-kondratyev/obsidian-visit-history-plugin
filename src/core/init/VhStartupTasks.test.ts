import { describe, expect, it, vi } from 'vitest';
import { VhStartupTasks } from './VhStartupTasks';
import { VhV3ReadmeWriter } from '../service/visitHistoryService/v3/VhV3ReadmeWriter';
import { VhV3Paths } from '../service/visitHistoryService/v3/VhV3Paths';
import { HiddenFileUtil } from '../util/file/hidden/HiddenFileUtil';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';

const USER = 'alice';

function setup(hidden: HiddenFileUtil = new FakeHiddenFileUtil()): VhStartupTasks {
  return new VhStartupTasks(new VhV3ReadmeWriter(hidden, USER));
}

describe('VhStartupTasks', () => {
  describe('run', () => {
    it('should write the V3 format README on every run', async () => {
      // GIVEN a vault without the README
      const hidden = new FakeHiddenFileUtil();
      // WHEN startup tasks run
      await setup(hidden).run();
      // THEN the README exists
      expect(hidden.getContent(VhV3Paths.readmePath(USER))).toContain('Visit History V3');
    });

    it('should not reject when the README write fails (plugin load must survive)', async () => {
      // GIVEN a hidden-file layer whose writes fail
      const failingHidden = new FakeHiddenFileUtil();
      failingHidden.write = async () => {
        throw new Error('disk exploded');
      };
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN startup tasks run
      // THEN run() resolves (error is logged, not thrown)
      await expect(setup(failingHidden).run()).resolves.toBeUndefined();
      errorSpy.mockRestore();
    });
  });
});
