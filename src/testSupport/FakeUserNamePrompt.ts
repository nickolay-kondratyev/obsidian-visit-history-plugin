import { UserNamePrompt, UserNamePromptRequest } from '../core/service/visitHistoryService/user/UserNamePrompt';

/**
 * UserNamePrompt fake: answers every prompt with a fixed name (or null =
 * dismissed) and records what it was asked.
 */
export class FakeUserNamePrompt implements UserNamePrompt {
  /** The request of the most recent prompt; null when never prompted. */
  lastRequest: UserNamePromptRequest | null = null;
  promptCount = 0;
  /** Runs while the prompt is "open" — models side effects mid-prompt. */
  onPrompt: (() => void) | null = null;

  constructor(private readonly answer: string | null) {
  }

  promptForUserName(request: UserNamePromptRequest): Promise<string | null> {
    this.lastRequest = request;
    this.promptCount += 1;
    this.onPrompt?.();
    return Promise.resolve(this.answer);
  }
}
