import { describe, expect, it } from 'vitest';
import { VhV2ReadmeWriter } from './VhV2ReadmeWriter';
import { VhV2Paths } from './VhV2Paths';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

describe('VhV2ReadmeWriter', () => {
  describe('writeReadme', () => {
    it('should write the README at the V2 path with a do-not-edit banner', async () => {
      // GIVEN
      const hidden = new FakeHiddenFileUtil();
      // WHEN
      await new VhV2ReadmeWriter(hidden).writeReadme();
      // THEN
      expect(hidden.getContent(VhV2Paths.README_PATH)).toContain('DO NOT EDIT BY HAND');
    });

    it('should overwrite a stale README (rewritten on every load)', async () => {
      // GIVEN a stale README
      const hidden = new FakeHiddenFileUtil();
      hidden.seedFile(VhV2Paths.README_PATH, 'stale');
      // WHEN
      await new VhV2ReadmeWriter(hidden).writeReadme();
      // THEN the stale content is gone
      expect(hidden.getContent(VhV2Paths.README_PATH)).not.toContain('stale');
    });
  });
});
