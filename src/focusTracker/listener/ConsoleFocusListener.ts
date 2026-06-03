import { FocusEvent, FocusListener } from "../FocusTracker";

export const ConsoleFocusListener: FocusListener = {
  onFocus(event: FocusEvent): void {
    console.log('[FocusTracker] FOCUS', event);
  },

  onUnfocus(event: FocusEvent): void {
    console.log('[FocusTracker] UNFOCUS', event);
  },
};