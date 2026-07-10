import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { VhUserPaths } from '../user/VhUserPaths';
import { VhV2Paths } from './VhV2Paths';

const README_CONTENT = `<!--
  ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
  Written by the Visit History plugin on every load; manual edits are overwritten.
-->

# Visit History V2 — layout & format

\`\`\`
${VhUserPaths.TOP_DIR}/
  user/
    <user-name>/                          # OS user name on desktop; see below for mobile
      v2/
        README__generated__vh_v2_format.md    # this file
        focus_per_device/
          <device-name>/                      # hostname on desktop; mobile-XXXXXXXX on mobile
            <doc-id>.vh_v2                    # one focus file per (device, document)
\`\`\`

- The filename is the document's persistent id: frontmatter \`id\` for .md
  (incl. .excalidraw.md), \`metadata.frontmatter.id\` for .canvas.
- Each \`.vh_v2\` file holds one focus timestamp per line — ISO 8601 UTC with
  millisecond precision (e.g. \`2026-07-09T12:34:56.789Z\`) — newline-terminated,
  sorted ascending, without exact duplicates.
- Per-user directories keep the histories of different people syncing one
  vault apart. Mobile devices adopt the single existing user name when there
  is exactly one, otherwise fall back to a persisted \`mobile-user-XXXXXXXX\`.
- Per-device directories keep synced devices from ever writing the same file
  (no sync conflicts).
- Documents whose id is not filename-safe cannot be tracked and are skipped.
`;

/**
 * Writes the generated format README on every plugin load, overwriting any
 * previous version so it always documents the CURRENT format.
 */
export class VhV2ReadmeWriter {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userName: string,
  ) {
  }

  async writeReadme(): Promise<void> {
    await this.hiddenFileUtil.write(VhV2Paths.readmePath(this.userName), README_CONTENT);
  }
}
