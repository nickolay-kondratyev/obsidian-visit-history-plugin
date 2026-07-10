import { describe, expect, it } from 'vitest';
import { VhV3ReadmeWriter } from './VhV3ReadmeWriter';
import { VhV3Paths } from './VhV3Paths';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

const USER = 'alice';

describe('VhV3ReadmeWriter', () => {
  describe('writeReadme', () => {
    it('should write the V3 format README at the user-scoped path', async () => {
      // GIVEN a writer
      const hidden = new FakeHiddenFileUtil();
      const writer = new VhV3ReadmeWriter(hidden, USER);
      // WHEN
      await writer.writeReadme();
      // THEN the README documents the V3 duration format
      expect(hidden.getContent(VhV3Paths.readmePath(USER))).toContain('D:<millis spent in focus>');
    });
  });
});
