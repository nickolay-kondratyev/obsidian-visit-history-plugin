// ── registerSampleCommands ────────────────────────────────────────────────────
// Registers all boilerplate sample functionality onto the given plugin instance.
// Call from onload() after settings are ready.
import { MarkdownView, Notice, Plugin } from "obsidian";
import { VisitHistorySampleModal } from "./visitHistorySampleModal";
import { SampleSettingTab } from "../settings";
import VisitHistoryPlugin from "../main";
import { ulid } from 'ulid';
import { NoteFileUtilDefault } from "../util/file/note/impl/NoteFileUtilDefault";

export function registerSampleCommands(plugin: VisitHistoryPlugin): void {
  plugin.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
    new Notice('This is a notice!');
  });

  const statusBarItemEl = plugin.addStatusBarItem();
  statusBarItemEl.setText('Status bar text');

  plugin.addCommand({
    id: 'open-modal-simple',
    name: 'Open modal (simple)',
    callback: () => {
      new VisitHistorySampleModal(plugin.app).open();
    },
  });

  plugin.addCommand({
    id: 'open-modal-complex',
    name: 'Open modal (complex)',
    checkCallback: (checking: boolean) => {
      const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (markdownView) {
        if (!checking) {
          new VisitHistorySampleModal(plugin.app).open();
        }
        return true;
      }
      return false;
    },
  });

  plugin.addSettingTab(new SampleSettingTab(plugin.app, plugin));

  plugin.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {

    const id = ulid();

    plugin.userNotifier.showInfo("Click14");

    const util = new NoteFileUtilDefault(plugin.app);

  });

}