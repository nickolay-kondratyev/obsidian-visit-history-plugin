import { App, ButtonComponent, Modal, Setting } from 'obsidian';
import { UserNamePrompt, UserNamePromptRequest } from '../UserNamePrompt';
import { UserNameSafety } from '../UserNameSafety';
import { VhUserPaths } from '../VhUserPaths';

/** UserNamePrompt backed by an Obsidian modal (one fresh modal per call). */
export class ModalUserNamePrompt implements UserNamePrompt {
  /** The currently open modal; null when none (or already resolved). */
  private openModal: UserNamePromptModal | null = null;

  constructor(private readonly app: App) {
  }

  promptForUserName(request: UserNamePromptRequest): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new UserNamePromptModal(this.app, request, (userName) => {
        this.openModal = null;
        resolve(userName);
      });
      this.openModal = modal;
      modal.open();
    });
  }

  /**
   * Closes a still-open prompt (resolving it as dismissed — nothing pinned).
   * Called on plugin unload so the modal cannot outlive the plugin.
   */
  closeOpenPrompt(): void {
    this.openModal?.close();
    this.openModal = null;
  }
}

/**
 * Thin, one-shot Obsidian adapter — intentionally UNTESTED (the unit-test
 * 'obsidian' stand-in has no Modal); all decision logic lives in
 * UserNameSafety / UserNameProviderDefault. Any close without an explicit
 * choice (Esc, X, Cancel) resolves null.
 */
class UserNamePromptModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly request: UserNamePromptRequest,
    private readonly onResolve: (userName: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Choose your visit history user name');
    this.contentEl.createEl('p', {
      text: `Focus time is recorded under this name in ${VhUserPaths.USERS_DIR}/. `
        + 'The choice is remembered on this device. Until a name is confirmed, '
        + 'no visit history is recorded.',
    });

    for (const existingName of this.request.existingNames) {
      new Setting(this.contentEl)
        .setName(existingName)
        .addButton(btn => btn
          .setButtonText('Use this name')
          .onClick(() => this.resolveAndClose(existingName)));
    }

    this.addNewNameInput();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.onResolve(null);
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private addNewNameInput(): void {
    let typedName = this.request.defaultName ?? '';
    let confirmButton: ButtonComponent | null = null;

    const setting = new Setting(this.contentEl)
      .setName(this.request.existingNames.length > 0 ? 'Or enter a new name' : 'Enter a name')
      .setDesc(UserNameSafety.ALLOWED_CHARSET_DESCRIPTION);
    const errorEl = this.contentEl.createEl('p', { cls: 'vh-user-name-prompt-error' });

    const refreshValidity = (): void => {
      const valid = UserNameSafety.isValidUserName(typedName);
      confirmButton?.setDisabled(!valid);
      errorEl.setText(valid || typedName.length === 0 ? '' : 'Invalid name.');
    };

    setting.addText(text => {
      text.setValue(typedName).onChange((value) => {
        // Live normalization: typed input is lowercased in place.
        const lowered = value.toLowerCase();
        if (lowered !== value) {
          text.setValue(lowered);
        }
        typedName = lowered;
        refreshValidity();
      });
      text.inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && UserNameSafety.isValidUserName(typedName)) {
          this.resolveAndClose(typedName);
        }
      });
    });
    setting.addButton(btn => {
      confirmButton = btn;
      btn.setButtonText('Confirm')
        .setCta()
        .onClick(() => {
          if (UserNameSafety.isValidUserName(typedName)) {
            this.resolveAndClose(typedName);
          }
        });
    });
    setting.addButton(btn => btn
      .setButtonText('Cancel')
      .onClick(() => this.close()));

    refreshValidity();
  }

  private resolveAndClose(userName: string): void {
    // Guard against a rapid double-click resolving twice (symmetric with the
    // onClose guard).
    if (this.resolved) return;
    this.resolved = true;
    this.onResolve(userName);
    this.close();
  }
}
