# Heatmap header: Esc dismissal for popovers + config panel

**Status**: OPEN — narrowed to Esc only (2026-07-16).
Click-outside dismissal SHIPPED for all four panels (heatmap skinning pass):
document-level pointerdown listener in App (active while openPanel !== null),
scoped to the header-chrome wrapper's `ownerDocument` for popout windows.

## Remaining problem
Esc does not close the open popover/panel — standard popover UX expects it.

## Fix ideas
- Esc keydown listener alongside the existing pointerdown listener in App
  (same effect, same ownerDocument scoping).
