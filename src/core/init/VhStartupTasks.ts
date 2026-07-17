import { VhV3ReadmeWriter } from '../service/visitHistoryService/v3/VhV3ReadmeWriter';

/**
 * Deferred plugin-load work, run once from
 * PluginFactory.activateUserScopedRecording after the user name is pinned —
 * keeps file IO off the load path (and off unpinned sessions).
 * Error-isolated: it never crashes the plugin.
 */
export class VhStartupTasks {
  constructor(
    private readonly vhV3ReadmeWriter: VhV3ReadmeWriter,
  ) {
  }

  async run(): Promise<void> {
    try {
      await this.vhV3ReadmeWriter.writeReadme();
    } catch (error) {
      console.error('[VHP][VhStartupTasks] V3 README write failed', error);
    }
  }
}
