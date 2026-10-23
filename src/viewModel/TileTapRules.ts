/**
 * How a heatmap tap is interpreted, decided PER EVENT from the pointer that
 * produced it (never per device — a touchscreen laptop mixes both).
 *
 * - `touch` — no hover exists, so a file tap SELECTS (details card) and a
 *   second tap / the card's Open opens it (the maps "pin" pattern).
 * - `mouseLike` — mouse AND pen: hover shows the tooltip, a click opens at once
 *   (unchanged desktop behavior). WHY pen here: pens commonly hover, and
 *   treating them like the mouse keeps their behavior exactly as before.
 */
export type PointerKind = 'touch' | 'mouseLike';

/** What the view must DO after a tap (besides adopting the new selection). */
export type TileTapEffect =
  | { readonly kind: 'none' }
  | { readonly kind: 'openFile'; readonly path: string }
  | { readonly kind: 'drillIn' };

/** Result of one tap: the new selected file path (`undefined` = none, card closed) + the effect. */
export interface TileTapOutcome {
  readonly selectedPath: string | undefined;
  readonly effect: TileTapEffect;
}

/** `PointerEvent.pointerType` value for touch input (spec string). */
const TOUCH_POINTER_TYPE = 'touch';

const NO_EFFECT: TileTapEffect = { kind: 'none' };

/**
 * Pure tap rules of the heatmap treemap: selection state transitions for
 * file tiles, folders and empty space. DOM/obsidian-free — the view feeds it
 * the current selection + pointer kind and applies the returned outcome.
 */
export class TileTapRules {
  /** Unknown/empty pointer types (e.g. a click with no preceding pointerdown) count as mouse. */
  static pointerKind(pointerType: string): PointerKind {
    return pointerType === TOUCH_POINTER_TYPE ? 'touch' : 'mouseLike';
  }

  /**
   * Hover tooltip only follows mouse-like pointers: a touch "move" is a pan,
   * and showing it would flash a tooltip under the finger.
   */
  static showsHoverTooltip(kind: PointerKind): boolean {
    return kind === 'mouseLike';
  }

  /** Tap/click on a file tile. */
  static fileTile(selectedPath: string | undefined, path: string, kind: PointerKind): TileTapOutcome {
    if (kind === 'mouseLike' || selectedPath === path) {
      return { selectedPath, effect: { kind: 'openFile', path } };
    }
    return { selectedPath: path, effect: NO_EFFECT };
  }

  /**
   * Tap/click on a folder (expanded folder area/header or a collapsed
   * dense-folder tile): drill in at once for every pointer; the selection is
   * dropped because the view root changes under it.
   */
  static folder(): TileTapOutcome {
    return { selectedPath: undefined, effect: { kind: 'drillIn' } };
  }

  /** Tap/click on empty canvas: a touch tap dismisses the card; a mouse click does nothing (as before). */
  static emptySpace(selectedPath: string | undefined, kind: PointerKind): TileTapOutcome {
    return { selectedPath: kind === 'touch' ? undefined : selectedPath, effect: NO_EFFECT };
  }

  /** The details card's Open button: opens the selected file (selection kept). */
  static openButton(selectedPath: string): TileTapOutcome {
    return { selectedPath, effect: { kind: 'openFile', path: selectedPath } };
  }
}
