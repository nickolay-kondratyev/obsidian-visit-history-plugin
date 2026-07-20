import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { VhV3Paths } from './VhV3Paths';

const README_CONTENT = `<!--
  ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
  Written by the Visit History plugin on every load; manual edits are overwritten.
-->

# Visit History V3 — focus durations: layout & format

### General Description of functionality

The Visit History plugin records how long you actively focus on each document.
A focus session begins when a document gains focus and ends when you navigate
away, when the Obsidian window hosting it loses focus (including switching to
another Obsidian popout window), or after the configured idle timeout without
any user interaction (plugin setting, default 3 minutes). For an idle session
the duration ends at the LAST interaction, and OS sleep is never counted.
Refocusing the window or interacting again starts a new session for the same
document.

V3 is the ONLY visit history the plugin reads and writes. Any \`v2/\` folder —
under \`__visit_history/\` or under a \`user/<user-name>/\` dir — and any
top-level \`_visit_history/\` or \`.visit_history/\` folder is legacy data from
older plugin versions: no longer read or written, left untouched.

The top-level folder is named \`__visit_history\` (not dot-hidden) because
Obsidian Sync does not sync folders starting with a dot, so the history must
be visible to sync across devices. The plugin's own tracking and heatmap
exclude it.

### File path format

\`\`\`
__visit_history/
  user/
    <user-name>/                          # chosen in the plugin's user-name modal; see below
      v3/
        README__generated__vh_v3_format.md    # this file
        focus_duration_per_device/
          <device-name>/                      # hostname on desktop; mobile-XXXXXXXX on mobile
            <doc-id>.vh_v3                    # one duration file per (device, document)
\`\`\`

- The \`.vh_v3\` filename is the document's persistent id. Documents whose id
  is not filename-safe cannot be tracked and are skipped.
- Per-user directories keep the histories of different people syncing one
  vault apart. The user name is confirmed by the human in a modal on first
  plugin start (existing name or a new lowercase one) and remembered per
  device; nothing is recorded until a name is confirmed.
- Per-device directories keep synced devices from ever writing the same file
  (no sync conflicts).

### File Format

Each \`.vh_v3\` line is one COMPLETED focus session, newline-terminated:

\`\`\`
<ISO 8601 UTC ms stamp of focus start> D:<millis spent in focus>
\`\`\`

Example:

\`\`\`
2026-07-09T22:02:15.745Z D:5600
\`\`\`
`;

/**
 * Writes the generated V3 format README on every plugin load, overwriting any
 * previous version so it always documents the CURRENT format.
 */
export class VhV3ReadmeWriter {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userName: string,
  ) {
  }

  async writeReadme(): Promise<void> {
    await this.hiddenFileUtil.write(VhV3Paths.readmePath(this.userName), README_CONTENT);
  }
}
