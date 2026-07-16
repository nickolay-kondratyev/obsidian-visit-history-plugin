import { useEffect, useState } from 'react';

interface BoundInputProps {
  value: number;
  /** Commits the typed number; returns the value actually applied (clamped). */
  onCommit: (raw: number) => number;
  ariaLabel: string;
}

/**
 * Numeric input for a slider bound (ref: RangeSlider). Commits on blur/Enter —
 * NOT per keystroke: typing "10" must not get clamped at the intermediate "1".
 */
export function BoundInput({ value, onCommit, ariaLabel }: BoundInputProps) {
  const [draft, setDraft] = useState(String(value));

  // External change (e.g. the OTHER bound clamped this one) → resync draft.
  useEffect(() => setDraft(String(value)), [value]);

  function commit(): void {
    const parsed = parseFloat(draft);
    // Show what was actually applied — clamping may differ from what was typed.
    setDraft(String(Number.isFinite(parsed) ? onCommit(parsed) : value));
  }

  return (
    <input
      className="bound-input"
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      title={ariaLabel}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
