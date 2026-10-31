// MetroMatrix — Health records (lab reports, scans, old prescriptions).

import type { RecordInput, RecordType } from '../health';
import type { ValidationErrors } from '../authModel';

export const RECORD_TYPES: { key: RecordType; label: string; icon: string }[] = [
  { key: 'lab_report', label: 'Lab report', icon: 'flask-outline' },
  { key: 'prescription', label: 'Prescription', icon: 'document-text-outline' },
  { key: 'imaging', label: 'Scan or X-ray', icon: 'scan-outline' },
  { key: 'discharge', label: 'Discharge summary', icon: 'clipboard-outline' },
  { key: 'other', label: 'Other', icon: 'folder-outline' },
];

export const recordTypeLabel = (t: RecordType) => RECORD_TYPES.find(x => x.key === t)?.label ?? 'Record';
export const recordTypeIcon = (t: RecordType) => RECORD_TYPES.find(x => x.key === t)?.icon ?? 'folder-outline';

/** A multi-page record: up to this many photos or files. */
export const MAX_RECORD_FILES = 10;

export const isPdf = (mime: string) => mime === 'application/pdf';

export const validateRecord = (r: RecordInput, today: string): ValidationErrors => {
  const errors: ValidationErrors = {};
  const title = r.title.trim();
  if (title.length < 2) errors.title = 'Give the record a title';
  else if (title.length > 80) errors.title = 'Keep it under 80 characters';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.recordedOn)) errors.recordedOn = 'Choose the date on the record';
  else if (r.recordedOn > today) errors.recordedOn = 'The date is in the future';
  if (!r.files.length) errors.files = 'Add at least one page';
  else if (r.files.length > MAX_RECORD_FILES) errors.files = `Up to ${MAX_RECORD_FILES} pages`;
  return errors;
};
