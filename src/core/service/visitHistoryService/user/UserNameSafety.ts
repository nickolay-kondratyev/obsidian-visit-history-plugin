// User names become path segments (`__visit_history/user/<user-name>` —
// VhUserPaths.userRootDir), so the charset must be filename-safe. STRICTER
// than DocIdFilenameSafety (which allows uppercase): user names are
// human-chosen and lowercase-only (owner decision, 2026-07) avoids
// case-collision surprises on case-insensitive filesystems. Boundary rules
// mirror DocIdFilenameSafety: no leading/trailing dot ('.', '..', hidden
// files), 200-char cap keeps derived paths under common 255-byte limits.
//
// Charset is checked with a single non-overlapping quantifier (linear, no
// backtracking — avoids S8786); length + leading/trailing-dot are separate
// O(1)/O(n) checks. A prior single boundary-anchored regex overlapped its
// quantifiers and backtracked polynomially on near-miss input.
const ALLOWED_CHARSET_PATTERN = /^[a-z0-9._-]+$/;

const MAX_USER_NAME_LENGTH = 200;
const DOT = '.';

/**
 * Validation + sanitization of VH user names (strict lowercase `a-z0-9._-`).
 * Used by the user-name prompt (live input validation) and by
 * UserNameProviderDefault (pin-time validation).
 */
export class UserNameSafety {
  /** Allowed-charset summary for UI error/help text. */
  static readonly ALLOWED_CHARSET_DESCRIPTION =
    'Lowercase letters, digits, dots, dashes and underscores (no leading/trailing dot).';

  /** True when the name may be pinned and used as a VH path segment. */
  static isValidUserName(userName: string): boolean {
    if (userName.length < 1 || userName.length > MAX_USER_NAME_LENGTH) {
      return false;
    }
    if (userName.startsWith(DOT) || userName.endsWith(DOT)) {
      return false;
    }
    return ALLOWED_CHARSET_PATTERN.test(userName);
  }

  /**
   * Best-effort sanitization of a free-form name (e.g. the OS login name)
   * into a valid user name: lowercase, whitespace runs → `_`, disallowed
   * chars stripped, leading/trailing dots stripped, capped at 200 chars.
   * `"John Doe"` → `"john_doe"`. Null when nothing valid remains.
   */
  static sanitizeToValidOrNull(rawName: string): string | null {
    const sanitized = rawName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^\.+/, '')
      .slice(0, MAX_USER_NAME_LENGTH)
      // Trailing dots stripped AFTER the length cap — truncation can expose one.
      .replace(/\.+$/, '');
    return UserNameSafety.isValidUserName(sanitized) ? sanitized : null;
  }
}
