import { useState } from 'react';
import { SegmentedToggle } from '../ConfigPanel/SegmentedToggle';
import type { FilterTermKind } from '../../../viewModel/heatmapConfig';

interface FilterPopoverProps {
  open: boolean;
  /** Adds a term. App normalizes (trim + per-kind ci-dedupe via FilterTermOps). */
  onAddTerm: (kind: FilterTermKind, text: string) => void;
}

const KIND_OPTIONS: readonly { value: FilterTermKind; label: string }[] = [
  { value: 'path', label: 'Path' },
  { value: 'content', label: 'Content' },
];

const KIND_HINTS: Record<FilterTermKind, string> = {
  path: 'matches the file path — folder names included',
  content: 'matches text inside files',
};

/**
 * Popover behind the header's filter icon: pick a term kind, type a term,
 * Enter adds it as a chip. Stays open after adding (multi-add flow).
 * The draft kind/text is ephemeral UI state — it lives here, not in App.
 */
export function FilterPopover({ open, onAddTerm }: FilterPopoverProps) {
  const [kind, setKind] = useState<FilterTermKind>('path');
  const [text, setText] = useState('');

  function submit(): void {
    onAddTerm(kind, text);
    setText('');
  }

  return (
    <div className={'hdr-pop hdr-pop--left' + (open ? ' open' : '')}>
      <div className="cfg-h">Add filter</div>
      <SegmentedToggle
        ariaLabel="Filter kind"
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />
      <input
        className="filter-pop-input"
        type="text"
        placeholder="Type a term, press Enter"
        aria-label="Filter term"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          // isComposing: during IME (e.g. CJK) input, Enter confirms the
          // composition — adding then would commit a half-typed term.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        }}
      />
      <div className="filter-pop-hint">{KIND_HINTS[kind]}</div>
    </div>
  );
}
