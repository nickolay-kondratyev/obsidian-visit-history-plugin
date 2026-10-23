import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { TYPE_C } from '../constants';
import { fmtBytes, fmtDate, fmtDuration, fmtTileSize, nodePath } from '../utils';
import type { VaultNode } from '../../core/data/VaultNode';
import type { TileSizing } from '../../viewModel/tileSize';

interface FileDetailsProps {
  node: HierarchyRectangularNode<VaultNode>;
  sizing: TileSizing;
}

// ── Inner helper: one timestamp row ─────────────────────────────────────────

function TsRow({ label, ts }: { label: string; ts: number | null | undefined }) {
  const fmt = fmtDate(ts);
  return (
    <div className="tt-row">
      <span>{label}</span>
      <span className={'tt-val' + (fmt ? '' : ' tt-null')}>
        {fmt || '—'}
      </span>
    </div>
  );
}

// ── FileDetails component ───────────────────────────────────────────────────

/**
 * A file tile's name + stats — the ONE source of what the hover tooltip and
 * the touch details card show (both wrap it in their own chrome).
 */
export function FileDetails({ node: d, sizing }: FileDetailsProps) {
  const visitedFor = fmtDuration(d.data.totalFocusMs ?? 0);
  // Badge tints live in styles.css (theme-aware vars) — keyed by known type.
  const badgeType = TYPE_C[d.data.type ?? ''] ? d.data.type : 'unknown';

  return (
    <>
      <div className="tt-name">{d.data.name}</div>
      <div className="tt-row">
        <span>type</span>
        <span className="tt-val">
          <span className={`tt-badge tt-badge--${badgeType}`}>
            .{d.data.type}
          </span>
        </span>
      </div>
      <div className="tt-row">
        <span>path</span>
        <span className="tt-val">{nodePath(d)}</span>
      </div>
      <div className="tt-row">
        <span>raw</span>
        <span className="tt-val">{fmtBytes(d.data.size!)}</span>
      </div>
      <div className="tt-row">
        <span>visited for</span>
        <span className={'tt-val' + (visitedFor ? '' : ' tt-null')}>
          {visitedFor ?? '—'}
        </span>
      </div>
      <div className="tt-row">
        <span>tile size</span>
        <span className="tt-val">{fmtTileSize(d.data, sizing)}</span>
      </div>
      <hr className="tt-sep" />
      <TsRow label="created" ts={d.data.createdAt} />
      <TsRow label="modified" ts={d.data.lastModifiedAt} />
      <TsRow label="visited" ts={d.data.lastVisitedAt} />
    </>
  );
}
