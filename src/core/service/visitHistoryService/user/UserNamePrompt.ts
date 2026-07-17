/** What the user-name prompt offers the human to choose from. */
export interface UserNamePromptRequest {
  /** Existing `__visit_history/user/<name>` dirs — picking one joins that identity. */
  existingNames: string[];
  /**
   * Pre-fill for the new-name input (sanitized OS login name); null when
   * unavailable (mobile, or nothing valid remains after sanitization).
   */
  defaultName: string | null;
}

/**
 * Asks the human which user name to record visit history under.
 * Obsidian-agnostic seam: the production impl is a Modal
 * (ModalUserNamePrompt); tests use FakeUserNamePrompt.
 */
export interface UserNamePrompt {
  /**
   * Resolves with the confirmed name, or null when the prompt was dismissed
   * (Esc / close / cancel) — the caller must then pin nothing.
   */
  promptForUserName(request: UserNamePromptRequest): Promise<string | null>;
}
