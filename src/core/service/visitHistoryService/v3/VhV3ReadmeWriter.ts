import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { VhV3Paths } from './VhV3Paths';

const README_CONTENT = `<!--
  ⚠️ GENERATED FILE — DO NOT EDIT BY HAND.
  Written by the Visit History plugin on every load; manual edits are overwritten.
-->

# Visit History V3 — focus durations: layout & format

\`\`\`
.visit_history/
  v3/
    README__generated__vh_v3_format.md    # this file
    focus_duration_per_device/
      <device-name>/                      # hostname on desktop; mobile-XXXXXXXX on mobile
        <doc-id>.vh_v3                    # one duration file per (device, document)
\`\`\`

- V3 is recorded ALONGSIDE V2 (V2 stays the main visit history). The filename
  is the document's persistent id — same keying as V2.
- Each \`.vh_v3\` line is one COMPLETED focus session, newline-terminated:
  \`<ISO 8601 UTC ms stamp of focus start> D:<millis spent in focus>\`
  e.g. \`2026-07-09T22:02:15.745Z D:5600\`
- A session ends (and its line is written) when the user navigates away from
  the document, when the Obsidian window HOSTING it loses focus (including
  switching to another Obsidian popout window), or after 3 minutes without
  any user interaction (idle) — the idle session's duration ends at the LAST
  interaction, and OS sleep is never counted. Refocusing the document's
  window or interacting again starts a new session for the same document.
- Per-device directories keep synced devices from ever writing the same file
  (no sync conflicts).
- Documents whose id is not filename-safe cannot be tracked and are skipped.
`;

/**
 * Writes the generated V3 format README on every plugin load, overwriting any
 * previous version so it always documents the CURRENT format.
 */
export class VhV3ReadmeWriter {
  constructor(private readonly hiddenFileUtil: HiddenFileUtil) {
  }

  async writeReadme(): Promise<void> {
    await this.hiddenFileUtil.write(VhV3Paths.README_PATH, README_CONTENT);
  }
}
