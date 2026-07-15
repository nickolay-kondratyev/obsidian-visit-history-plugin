import type { FilterTerm, FilterTermKind } from '../../../viewModel/heatmapConfig';

interface FilterGroupProps {
  terms: FilterTerm[];
  /** True while the filter popover is open (drives aria-expanded/highlight). */
  filterOpen: boolean;
  onToggleFilter: () => void;
  onRemoveTerm: (term: FilterTerm) => void;
}

// Kind distinguishability is glyph + tint + title — never color alone.
const KIND_GLYPHS: Record<FilterTermKind, string> = { path: '/', content: '≡' };
const KIND_TITLES: Record<FilterTermKind, string> = {
  path: 'path term — matches the file path',
  content: 'content term — matches text inside files',
};

/**
 * Header filter group: the filter icon (left-most, toggles FilterPopover)
 * followed by one removable chip per active term. Chips scroll horizontally
 * when they outgrow the header instead of blowing its 42px height.
 */
export function FilterGroup({ terms, filterOpen, onToggleFilter, onRemoveTerm }: FilterGroupProps) {
  return (
    <div className="filter-group">
      <button
        className={'hdr-icon-btn' + (filterOpen ? ' active' : '')}
        onClick={onToggleFilter}
        title="Filter files"
        aria-label="Filter files"
        aria-expanded={filterOpen}
      >
        🔍
      </button>
      {terms.length > 0 && (
        <div className="filter-chips">
          {terms.map(term => (
            <span
              key={`${term.kind}:${term.text}`}
              className={`filter-chip filter-chip--${term.kind}`}
              title={KIND_TITLES[term.kind]}
            >
              <span className="filter-chip-kind" aria-hidden>
                {KIND_GLYPHS[term.kind]}
              </span>
              <span className="filter-chip-text">{term.text}</span>
              <button
                className="filter-chip-x"
                onClick={() => onRemoveTerm(term)}
                aria-label={`Remove filter: ${term.text}`}
                title="Remove"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
