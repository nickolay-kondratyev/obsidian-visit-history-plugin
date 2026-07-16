interface SegmentedToggleProps<T extends string> {
  /** `title` = descriptive hover text for the segment (falls back to label). */
  options: readonly { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * Radio group rendered as a segmented switch — a thumb slides to the
 * selected segment. Semantically radios (role=radiogroup / role=radio);
 * used for the binary coloring mode.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
  return (
    <div className="seg-toggle" role="radiogroup" aria-label={ariaLabel}>
      <span
        className="seg-thumb"
        aria-hidden
        style={{
          // Thumb spans one segment; slides to the selected one.
          // --seg-pad is owned by styles.css (.seg-toggle) — single source.
          width: `calc((100% - 2 * var(--seg-pad)) / ${options.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={'seg-opt' + (o.value === value ? ' active' : '')}
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
