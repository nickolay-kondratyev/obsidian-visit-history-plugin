import { RadioGroup } from '../ConfigPanel/RadioGroup';
import { FIELD_OPTIONS, type HeatField } from '../../constants';

interface FieldPopoverProps {
  open: boolean;
  field: HeatField;
  onFieldChange: (field: HeatField) => void;
}

/**
 * Popover behind the header's field indicator: pick the heatmap timestamp
 * field. Deliberately the SAME RadioGroup + options as the config panel's
 * "Timestamp field" section (DRY) — one field-selection UI everywhere.
 */
export function FieldPopover({ open, field, onFieldChange }: FieldPopoverProps) {
  return (
    <div className={'hdr-pop hdr-pop--left' + (open ? ' open' : '')}>
      <div className="cfg-h">Timestamp field</div>
      <RadioGroup
        ariaLabel="Timestamp field"
        options={FIELD_OPTIONS}
        value={field}
        onChange={onFieldChange}
      />
    </div>
  );
}
