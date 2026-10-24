import { FIELD_LABELS, type ColorMode, type HeatField } from '../constants';
import type { FilterTerm } from '../../viewModel/heatmapConfig';
import type { ClusteredTimestamps } from '../../viewModel/ClusteredTimestampsRule';
import { FilterGroup } from './header/FilterGroup';
import { InfoIcon, SettingsIcon, ZoomResetIcon } from './icons';

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
  /** Resets the treemap zoom/pan to the fitted view (wired to TreemapViz). */
  onResetZoom: () => void;
  /**
   * Files in the current view hidden for lacking visit time (visit-time
   * sizing). 0 = no banner.
   */
  hiddenNoVisitCount: number;
  /** The current view's color-field timestamps are clustered (e.g. after a sync); undefined = no banner. */
  clusteredTimestamps: ClusteredTimestamps | undefined;
  /** Shows a "Restore from git" button beside the clustered-timestamps banner; undefined = no button. */
  onRestoreFromGit: (() => void) | undefined;
}

function hiddenNotesLabel(count: number): string {
  return count === 1 ? '1 note' : `${count} notes`;
}

function hiddenNotesTitle(count: number): string {
  const verb = count === 1 ? 'is hidden because it has' : 'are hidden because they have';
  return `${hiddenNotesLabel(count)} in this view ${verb} no visit history (sizing by visit time)`;
}

/**
 * Plural "notes" is safe: a cluster needs at least
 * `TimestampClusterDetector.MIN_ITEMS_TO_JUDGE` (20) files, half of them shared.
 */
function clusteredTimestampsText({ field, sharedCount, totalCount }: ClusteredTimestamps): string {
  return `${sharedCount} of ${totalCount} notes have the same ${FIELD_LABELS[field]} time, probably from a sync. ` +
    "Recency colors don't mean anything here.";
}

/**
 * Top bar — actions only (info lives in the info popover):
 * breadcrumb · filter group (icon + term chips) · field selector ·
 * clustered-timestamps banner · hidden-notes banner (visit-time sizing) · zoom reset · info · config.
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
  onResetZoom,
  hiddenNoVisitCount,
  clusteredTimestamps,
  onRestoreFromGit,
}: HeaderProps) {
  return (
    <div id="header">
      {breadcrumb.length > 0 && onBack && (
        <div className="breadcrumb">
          <button type="button" className="breadcrumb-back" onClick={onBack} title="Go back up one level">
            ← back
          </button>
          <span className="breadcrumb-path" title={`Viewing /${breadcrumb.join('/')}`}>
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
          type="button"
          className={'header-btn' + (openPanel === 'field' ? ' active' : '')}
          onClick={() => onPanelToggle('field')}
          title="Change timestamp field"
          aria-expanded={openPanel === 'field'}
        >
          field: <strong>{FIELD_LABELS[field]}</strong> ▾
        </button>
      )}
      <div className="spacer" />
      {clusteredTimestamps && (
        <span className="hdr-cluster-banner" role="status" title={clusteredTimestampsText(clusteredTimestamps)}>
          {clusteredTimestampsText(clusteredTimestamps)}
        </span>
      )}
      {clusteredTimestamps && onRestoreFromGit && (
        <button
          type="button"
          className="header-btn hdr-git-restore-btn"
          onClick={onRestoreFromGit}
          title="Set each file's modified time to its last git commit time"
        >
          Restore from git
        </button>
      )}
      {hiddenNoVisitCount > 0 && (
        <span
          className="hdr-hidden-banner"
          role="status"
          title={hiddenNotesTitle(hiddenNoVisitCount)}
        >
          {hiddenNotesLabel(hiddenNoVisitCount)} hidden · no visit history
        </span>
      )}
      <button
        type="button"
        className="hdr-icon-btn"
        onClick={onResetZoom}
        title="Reset zoom and pan"
        aria-label="Reset zoom and pan"
      >
        <ZoomResetIcon />
      </button>
      <button
        type="button"
        className={'hdr-icon-btn' + (openPanel === 'info' ? ' active' : '')}
        onClick={() => onPanelToggle('info')}
        title="View info"
        aria-label="View info"
        aria-expanded={openPanel === 'info'}
      >
        <InfoIcon />
      </button>
      <button
        type="button"
        className={'hdr-icon-btn' + (openPanel === 'config' ? ' active' : '')}
        onClick={() => onPanelToggle('config')}
        title="Configure heatmap"
        aria-label="Configure heatmap"
        aria-expanded={openPanel === 'config'}
      >
        <SettingsIcon />
      </button>
    </div>
  );
}
