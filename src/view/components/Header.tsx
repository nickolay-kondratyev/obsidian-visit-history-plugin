import { FIELD_LABELS, type ColorMode, type HeatField } from '../constants';
import type { FilterTerm } from '../../viewModel/heatmapConfig';
import { FilterGroup } from './header/FilterGroup';

/**
 * Header popover/panel identifiers. App keeps at most ONE open at a time
 * (single `openPanel` state) — panels share screen anchors and must never
 * overlap.
 */
export type HeaderPanel = 'filter' | 'field' | 'info' | 'config';

interface HeaderProps {
  colorMode: ColorMode;
  field: HeatField;
  filterTerms: FilterTerm[];
  /** Which panel is currently open (null = none) — drives aria-expanded. */
  openPanel: HeaderPanel | null;
  /** Opens the panel, closing any other; closes it when already open. */
  onPanelToggle: (panel: HeaderPanel) => void;
  onRemoveTerm: (term: FilterTerm) => void;
  /** The folder path segments currently being viewed, or empty array at root. */
  breadcrumb: string[];
  /** Called when the user clicks "back" to navigate up one level. */
  onBack?: () => void;
}

/**
 * Top bar — actions only (info lives in the ⓘ popover):
 * breadcrumb · filter group (icon + term chips) · field selector · ⓘ · ⚙.
 * Pure presentational — no state; popovers render as App-level siblings.
 */
export function Header({
  colorMode,
  field,
  filterTerms,
  openPanel,
  onPanelToggle,
  onRemoveTerm,
  breadcrumb,
  onBack,
}: HeaderProps) {
  return (
    <div id="header">
      {breadcrumb.length > 0 && onBack && (
        <div className="breadcrumb">
          <button className="breadcrumb-back" onClick={onBack} title="Go back up one level">
            ← back
          </button>
          <span className="breadcrumb-path">
            /{breadcrumb.join('/')}
          </span>
        </div>
      )}
      <FilterGroup
        terms={filterTerms}
        filterOpen={openPanel === 'filter'}
        onToggleFilter={() => onPanelToggle('filter')}
        onRemoveTerm={onRemoveTerm}
      />
      {colorMode === 'heatmap' && (
        <button
          className={'header-btn' + (openPanel === 'field' ? ' active' : '')}
          onClick={() => onPanelToggle('field')}
          title="Change timestamp field"
          aria-expanded={openPanel === 'field'}
        >
          field: <strong>{FIELD_LABELS[field]}</strong> ▾
        </button>
      )}
      <div className="spacer" />
      <button
        className={'hdr-icon-btn' + (openPanel === 'info' ? ' active' : '')}
        onClick={() => onPanelToggle('info')}
        title="View info"
        aria-label="View info"
        aria-expanded={openPanel === 'info'}
      >
        ⓘ
      </button>
      <button
        className={'hdr-icon-btn' + (openPanel === 'config' ? ' active' : '')}
        onClick={() => onPanelToggle('config')}
        title="Configure heatmap"
        aria-label="Configure heatmap"
        aria-expanded={openPanel === 'config'}
      >
        ⚙
      </button>
    </div>
  );
}
