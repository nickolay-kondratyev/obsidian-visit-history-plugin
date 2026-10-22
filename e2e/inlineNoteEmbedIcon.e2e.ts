// S10 — Inline note from the embed icon (live preview), key journey.
//
// note1 embeds note2 (`![[...]]`) — note2's only link. In live preview, the inline icon
// on that embed → confirm dialog → "Inline note" must leave on disk: note2's content in
// note1 (embed gone) and note2 in the trash. Which embeds get the icon is covered by
// unit tests (EmbedInlineIconRule); the action itself by inlineNote.e2e.ts + unit tests.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ObsidianHarness } from './obsidianHarness';
import { pollUntil } from './vhAssert';

const NOTE1 = 'Embed host.md';
const NOTE2 = 'Embedded only once.md';
const NOTE2_EMBED = '![[Embedded only once]]';
const NOTE2_BODY = 'Embedded body text.';
/** Keep in sync with ICON_TOOLTIP in EmbedInlineIconDecorator (its accessible name). */
const ICON_NAME = 'Inline note into this note';
const POLL = { timeoutMs: 15_000 } as const;
// The headless window boots tiny (300×200) — too small to click into the editor.
const VIEWPORT = { width: 1280, height: 800 } as const;

test.describe('S10 inline note from the embed icon', () => {
  let harness: ObsidianHarness | undefined;

  test.afterEach(async () => {
    if (harness) await harness.close();
    harness = undefined;
  });

  test('clicking the icon on the only embed of note2 in live preview inlines note2 into note1', async () => {
    const h = await ObsidianHarness.launch({
      idleTimeoutSeconds: 180,
      minFocusSecondsToRecord: 0,
      seedFiles: [
        { path: '.obsidian/app.json', content: JSON.stringify({ trashOption: 'local' }) },
        { path: NOTE1, content: `## Topic\n${NOTE2_EMBED}\n` },
        { path: NOTE2, content: `${NOTE2_BODY}\n` },
      ],
    });
    harness = h;
    await h.waitForResolvedLink(NOTE1, NOTE2);

    await h.page.setViewportSize(VIEWPORT);
    await h.trustVaultAuthor();
    await h.openFile(NOTE1); // a fresh vault opens notes in live preview
    const icon = h.page.locator('.cm-content').getByRole('button', { name: ICON_NAME, exact: true });
    await icon.click();
    await h.page.getByRole('button', { name: 'Inline note', exact: true }).click();

    const note2Path = join(h.vaultDir, NOTE2);
    await pollUntil(() => !existsSync(note2Path), `note2 gone from ${note2Path}`, POLL);
    expect(existsSync(join(h.vaultDir, '.trash', NOTE2))).toBe(true);

    const note1Content = readFileSync(join(h.vaultDir, NOTE1), 'utf8');
    expect(note1Content).toContain(NOTE2_BODY);
    expect(note1Content).not.toContain(NOTE2_EMBED);
  });
});
