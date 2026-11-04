// TimeField — a clock time ("18:30") chosen from a list, never typed. The
// closed field shows "6:30 PM"; the sheet lists the day in `step`-minute
// steps (and "Midnight" at the end when `allowMidnight`, for a closing
// time). Built on PickerField + BottomSheetPicker, so it opens everywhere.

import React, { useMemo, useState } from 'react';
import { BottomSheetPicker, PickerField } from './BottomSheetPicker';

/** "18:30" → "6:30 PM"; "24:00" → "Midnight". */
export const clockLabel = (hhmm: string): string => {
  if (hhmm === '24:00') return 'Midnight';
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Every `step` minutes from 00:00, with "24:00" last when the end of the day is allowed. */
export const clockOptions = (step = 15, allowMidnight = false): string[] => {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  if (allowMidnight) out.push('24:00');
  return out;
};

export interface TimeFieldProps {
  label: string;
  /** "HH:MM", or empty for none. */
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  error?: string;
  step?: number;
  allowMidnight?: boolean;
}

export const TimeField: React.FC<TimeFieldProps> = ({ label, value, onChange, placeholder = 'Choose a time', error, step = 15, allowMidnight }) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const list = clockOptions(step, allowMidnight);
    // A saved time off the grid ("12:10") still shows as the current choice.
    if (value && !list.includes(value)) list.push(value);
    return list.sort().map(v => ({ value: v, label: clockLabel(v) }));
  }, [step, allowMidnight, value]);
  return (
    <>
      <PickerField label={label} valueLabel={value ? clockLabel(value) : null} placeholder={placeholder} onPress={() => setOpen(true)} error={error} />
      <BottomSheetPicker visible={open} onClose={() => setOpen(false)} title={label} options={options} value={value || null} onSelect={onChange} />
    </>
  );
};

export default TimeField;
