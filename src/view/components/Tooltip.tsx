import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { TYPE_C } from '../constants';
import { fmtBytes, fmtDate, nodePath } from '../utils';
import type { VaultNode } from '../../core/data/VaultNode';

// ── Props ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  x: number;
  y: number;
  node: HierarchyRectangularNode<VaultNode>;
  scales: Record<string, number>;
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

// ── Tooltip component ───────────────────────────────────────────────────────

export function Tooltip({ x, y, node: d, scales }: TooltipProps) {
  const eff = Math.round((d.data.size ?? 0) * (scales[d.data.type ?? ''] || 1));
  // Badge tints live in styles.css (theme-aware vars) — keyed by known type.
  const badgeType = TYPE_C[d.data.type ?? ''] ? d.data.type : 'unknown';

  return (
    <div id="tooltip" style={{ left: x + 'px', top: y + 'px' }}>
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
        <span>effective</span>
        <span className="tt-val">
          {fmtBytes(eff)} (×{scales[d.data.type ?? ''] || 1})
        </span>
      </div>
      <hr className="tt-sep" />
      <TsRow label="created" ts={d.data.createdAt} />
      <TsRow label="modified" ts={d.data.lastModifiedAt} />
      <TsRow label="visited" ts={d.data.lastVisitedAt} />
    </div>
  );
}
