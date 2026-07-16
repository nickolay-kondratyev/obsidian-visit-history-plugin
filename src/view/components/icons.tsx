import type { ReactNode } from 'react';

/**
 * Header/chrome icon set — lucide-style stroked SVGs, all drawn on the same
 * 24×24 grid with identical stroke weight so every icon reads as ONE family.
 * Colorless by design: they inherit `currentColor` from the button, so
 * hover/active/theme states come for free. Sized via CSS (`.vt-icon`).
 */
function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="vt-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Funnel — filtering (header filter trigger). */
export function FilterIcon() {
  return (
    <IconSvg>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </IconSvg>
  );
}

/** Circled i — informational popover trigger. */
export function InfoIcon() {
  return (
    <IconSvg>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </IconSvg>
  );
}

/** Horizontal sliders — configuration panel trigger (the panel IS sliders). */
export function SettingsIcon() {
  return (
    <IconSvg>
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </IconSvg>
  );
}

/** Corner brackets ("scan") — fit/reset the zoomed view (header zoom reset). */
export function ZoomResetIcon() {
  return (
    <IconSvg>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </IconSvg>
  );
}

/** X — dismiss/remove (filter chips). */
export function XIcon() {
  return (
    <IconSvg>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconSvg>
  );
}
