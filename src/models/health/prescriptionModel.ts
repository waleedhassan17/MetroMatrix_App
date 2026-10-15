// ═══════════════════════════════════════════════════════
// MetroMatrix — Prescriptions: dose patterns, presets, validation
// ═══════════════════════════════════════════════════════
// A dose pattern is "morning+afternoon+night" in tablets (or spoons, drops):
// "1+0+1" is one in the morning and one at night. Halves are allowed
// ("½+0+½" is written "0.5+0+0.5").

import type { Medicine, MedicineForm, MedicineTiming, PrescriptionInput } from '../../types/health';
import type { ValidationErrors } from '../authModel';

export const MEDICINE_FORMS: { key: MedicineForm; label: string }[] = [
  { key: 'tablet', label: 'Tablet' },
  { key: 'capsule', label: 'Capsule' },
  { key: 'syrup', label: 'Syrup' },
  { key: 'injection', label: 'Injection' },
  { key: 'drops', label: 'Drops' },
  { key: 'cream', label: 'Cream' },
  { key: 'inhaler', label: 'Inhaler' },
  { key: 'other', label: 'Other' },
];

export const TIMINGS: { key: MedicineTiming; label: string }[] = [
  { key: 'after_meal', label: 'After meal' },
  { key: 'before_meal', label: 'Before meal' },
  { key: 'with_meal', label: 'With meal' },
  { key: 'bedtime', label: 'At bedtime' },
  { key: 'as_needed', label: 'When needed' },
];

export const DOSE_PRESETS = ['1+0+1', '1+1+1', '0+0+1', '1+0+0'];
export const DURATION_PRESETS = [3, 5, 7, 14, 30];
export const FOLLOW_UP_PRESETS = [3, 7, 14, 30];
export const MAX_MEDICINES = 15;
export const MAX_DAYS = 365;
/** The doctor can edit a prescription for this long after issuing it. */
export const EDIT_WINDOW_HOURS = 24;

export const formLabel = (f: MedicineForm) => MEDICINE_FORMS.find(x => x.key === f)?.label ?? 'Medicine';
export const timingLabel = (t: MedicineTiming | null) => (t ? (TIMINGS.find(x => x.key === t)?.label ?? '') : '');

const PART = /^(\d+(\.5)?|½)$/;

/** "1+0+1" → [1, 0, 1]; null when it isn't three parts of whole or half numbers. */
export const parseDose = (dose: string): [number, number, number] | null => {
  const parts = dose.replace(/\s/g, '').split('+');
  if (parts.length !== 3 || !parts.every(p => PART.test(p))) return null;
  const nums = parts.map(p => (p === '½' ? 0.5 : Number(p))) as [number, number, number];
  if (nums.some(n => n > 10) || nums.every(n => n === 0)) return null;
  return nums;
};

const part = (n: number) => (n === 0.5 ? '½' : Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`);

/** [1, 0, 1] → "1 + 0 + 1" for display (halves as ½). */
export const formatDose = (dose: string): string => {
  const p = parseDose(dose);
  return p ? p.map(part).join(' + ') : dose;
};

/** Which of morning / afternoon / night the dose is taken (for the dots). */
export const doseSlots = (dose: string): { label: 'Morning' | 'Afternoon' | 'Night'; amount: number }[] => {
  const p = parseDose(dose) ?? [0, 0, 0];
  return (['Morning', 'Afternoon', 'Night'] as const).map((label, i) => ({ label, amount: p[i] }));
};

/** "1 tablet in the morning and at night, after meal, for 5 days". */
export const doseSentence = (m: Medicine): string => {
  const slots = doseSlots(m.dose).filter(s => s.amount > 0);
  const when = slots.map(s => (s.label === 'Night' ? 'at night' : `in the ${s.label.toLowerCase()}`));
  const whenText = when.length > 1 ? `${when.slice(0, -1).join(', ')} and ${when[when.length - 1]}` : (when[0] ?? '');
  const amount = slots[0]?.amount ?? 1;
  const unit = formLabel(m.form).toLowerCase();
  const timing = timingLabel(m.timing).toLowerCase();
  return [`${part(amount)} ${unit} ${whenText}`.trim(), timing, `for ${m.days} ${m.days === 1 ? 'day' : 'days'}`].filter(Boolean).join(', ');
};

export const emptyMedicine = (): Medicine => ({
  name: '',
  strength: '',
  form: 'tablet',
  dose: '1+0+1',
  timing: 'after_meal',
  days: 5,
  instructions: null,
});

export const emptyPrescription = (): PrescriptionInput => ({
  diagnosis: '',
  medicines: [emptyMedicine()],
  tests: [],
  advice: null,
  followUpInDays: null,
});

/** Errors keyed `diagnosis`, `medicines`, or `medicine.<i>.<field>`. */
export const validatePrescription = (p: PrescriptionInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (p.diagnosis.trim().length < 2) errors.diagnosis = 'Enter the diagnosis';
  else if (p.diagnosis.length > 200) errors.diagnosis = 'Keep it under 200 characters';
  const filled = p.medicines.filter(m => m.name.trim());
  if (!filled.length && !p.tests.length && !(p.advice ?? '').trim()) {
    errors.medicines = 'Add a medicine, a test or advice';
  }
  if (p.medicines.length > MAX_MEDICINES) errors.medicines = `Up to ${MAX_MEDICINES} medicines`;
  p.medicines.forEach((m, i) => {
    if (!m.name.trim()) {
      if (p.medicines.length > 1) errors[`medicine.${i}.name`] = 'Enter the medicine or remove this row';
      return;
    }
    if (!parseDose(m.dose)) errors[`medicine.${i}.dose`] = 'Use a pattern like 1+0+1';
    if (!Number.isInteger(m.days) || m.days < 1 || m.days > MAX_DAYS) errors[`medicine.${i}.days`] = `1 to ${MAX_DAYS} days`;
  });
  if (p.followUpInDays !== null && (!Number.isInteger(p.followUpInDays) || p.followUpInDays < 1 || p.followUpInDays > 365)) {
    errors.followUpInDays = '1 to 365 days';
  }
  return errors;
};

/** Rows with no medicine name are dropped before saving. */
export const prescriptionToSave = (p: PrescriptionInput): PrescriptionInput => ({
  diagnosis: p.diagnosis.trim(),
  medicines: p.medicines.filter(m => m.name.trim()).map(m => ({ ...m, name: m.name.trim(), strength: m.strength.trim() })),
  tests: p.tests.map(t => t.trim()).filter(Boolean),
  advice: (p.advice ?? '').trim() || null,
  followUpInDays: p.followUpInDays,
});

/** Move row `from` to `to` (the reorder arrows). */
export const moveMedicine = (list: Medicine[], from: number, to: number): Medicine[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
};
