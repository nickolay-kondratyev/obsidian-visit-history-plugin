import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { FileDetails } from './FileDetails';
import { XIcon } from './icons';
import type { VaultNode } from '../../core/data/VaultNode';
import type { TileSizing } from '../../viewModel/tileSize';

interface FileDetailsCardProps {
  node: HierarchyRectangularNode<VaultNode>;
  sizing: TileSizing;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Touch replacement for the hover tooltip: the selected file's details,
 * docked at a FIXED spot at the bottom of the heatmap (not at the finger,
 * which would cover it) with an explicit Open. The close button exists
 * because tiles cover almost the whole canvas — "tap empty space" alone is a
 * thin 8 px target on touch.
 */
export function FileDetailsCard({ node, sizing, onOpen, onClose }: FileDetailsCardProps) {
  return (
    <div className="vt-file-card" role="dialog" aria-label="File details">
      <div className="vt-file-card__details">
        <FileDetails node={node} sizing={sizing} />
      </div>
      <div className="vt-file-card__actions">
        <button type="button" className="vt-file-card__open" onClick={onOpen}>
          Open
        </button>
        <button type="button" className="vt-file-card__close" onClick={onClose} title="Close details" aria-label="Close details">
          <XIcon />
        </button>
      </div>
    </div>
  );
}
