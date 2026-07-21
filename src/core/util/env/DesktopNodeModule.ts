import { Platform } from 'obsidian';

/**
 * Mobile-safe loader for desktop-only Node/Electron builtin modules.
 *
 * WHY centralized: several boundary readers (`DesktopOsInfo` → `os`,
 * `DevOverridesFileSource` → `fs`) need the IDENTICAL rule for reaching a Node
 * builtin — it exists ONLY in the desktop Electron app, never on mobile. The
 * single knowledge of "how to safely require a desktop-only builtin" (the
 * `Platform` guard + typed require + try/catch + the eslint-disable
 * justification) lives here, in exactly one place, so callers never re-derive it.
 */
export class DesktopNodeModule {
  private constructor() {}

  /**
   * The named Node builtin typed as `T`, or null when it is unavailable: on
   * mobile (no Node builtins) or if the require throws. Never throws — callers
   * fall back. `T` names only the members the caller uses; the require is
   * untyped, so this cast is the sole typing seam for the boundary.
   */
  static require<T>(moduleName: string): T | null {
    // Node builtins exist only in the desktop Electron app, never on mobile.
    // `isDesktop` rules out the mobile app (Node APIs are absent there — and the
    // obsidianmd guideline wants exactly this check); `isDesktopApp` is the
    // precise Electron guard Node availability actually depends on. Both hold on
    // desktop — keeping both documents intent. The try/catch is the final
    // backstop if the require still fails.
    if (!Platform.isDesktop) {
      return null;
    }
    if (!Platform.isDesktopApp) {
      return null;
    }
    try {
      // System boundary: a desktop-only Node/Electron builtin. Cast to the
      // caller's TYPED view so member calls are type-checked (no no-unsafe-*).
      // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- desktop-only Electron builtin; guarded above + try/catch for mobile
      return require(moduleName) as T;
    } catch {
      return null;
    }
  }
}
