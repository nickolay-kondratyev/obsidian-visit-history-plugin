# Heatmap header: click-outside / Esc dismissal for popovers + config panel

**Status**: OPEN (deferred from `heatmap-filter-ui`, 2026-07-15)

## Problem
The header popovers (filter/field/info) and the config panel are toggle-only:
they close via their trigger button (or by opening another panel — App keeps
at most one open). Click-outside and Esc do nothing, which is unusual for
popover UX.

## Why deferred
The pre-existing ConfigPanel is toggle-only; adding dismissal to just the new
popovers would be inconsistent. Per "change a pattern wholesale", do all four
at once.

## Fix ideas
- One document-level pointerdown listener in App (registered while
  openPanel !== null) + Esc keydown; ignore events inside the open panel or
  its trigger. Mind popout windows (use the view's ownerDocument).
