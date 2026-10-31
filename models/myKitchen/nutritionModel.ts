// ═══════════════════════════════════════════════════════
// MetroMatrix — The customer's nutrition in plain, neutral words
// ═══════════════════════════════════════════════════════
// Opt-in, off by default; goals and activity in everyday words; the body
// numbers form; a week of ordered food said without praise or blame ("1,840
// kcal on Tue", never "great job" or "too much").

import type { Activity, BodyMetrics, DishFacts, NutritionGoal, NutritionSummary } from '../../types/myKitchen';
import type { ValidationErrors } from '../authModel';
import { formatDayShort } from '../../utils/healthTime';

export const GOAL: Record<NutritionGoal, { label: string; hint: string }> = {
  eat_better: { label: 'Eat a little better', hint: 'See the numbers, no target to hit' },
  maintain: { label: 'Stay where I am', hint: 'A daily target to keep your weight' },
  lose: { label: 'Lose weight slowly', hint: 'About 400 kcal under what you use' },
  gain: { label: 'Gain weight slowly', hint: 'About 300 kcal over what you use' },
};
export const GOALS = Object.keys(GOAL) as NutritionGoal[];

export const ACTIVITY: Record<Activity, string> = { low: 'Mostly sitting', moderate: 'On my feet some of the day', high: 'Active most days' };
export const ACTIVITIES = Object.keys(ACTIVITY) as Activity[];

export interface MetricsForm {
  sex: 'female' | 'male';
  age: string;
  heightCm: string;
  weightKg: string;
  activity: Activity;
}

export const metricsFormOf = (m: BodyMetrics | null): MetricsForm => ({
  sex: m?.sex ?? 'female',
  age: m ? String(m.age) : '',
  heightCm: m ? String(m.heightCm) : '',
  weightKg: m ? String(m.weightKg) : '',
  activity: m?.activity ?? 'moderate',
});

export const validateMetrics = (f: MetricsForm): ValidationErrors => {
  const errors: ValidationErrors = {};
  const age = Number(f.age);
  if (!Number.isInteger(age) || age < 14 || age > 100) errors.age = 'Age 14 to 100';
  const h = Number(f.heightCm);
  if (!(h >= 120 && h <= 230)) errors.heightCm = 'Height in cm (120 to 230)';
  const w = Number(f.weightKg);
  if (!(w >= 30 && w <= 250)) errors.weightKg = 'Weight in kg (30 to 250)';
  return errors;
};

export const metricsOf = (f: MetricsForm): BodyMetrics => ({ sex: f.sex, age: Number(f.age), heightCm: Number(f.heightCm), weightKg: Number(f.weightKg), activity: f.activity });

export const validateManualTarget = (raw: string): string | null => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1000 && n <= 5000 ? null : 'A daily target of 1,000 to 5,000 kcal';
};

const n = (x: number) => x.toLocaleString('en-US');

export const targetLine = (kcal: number | null) => (kcal ? `Your daily target: about ${n(kcal)} kcal` : 'No daily target: add your numbers or set one');

/** "About 520 kcal · 30 g protein"; a person's share for a dish that serves more ("About 960 kcal a person · …"). */
export const dishFactsLine = (f: Pick<DishFacts, 'kcal' | 'protein' | 'serves'>) =>
  f.serves > 1
    ? `About ${n(Math.round(f.kcal / f.serves))} kcal a person · ${Math.round(f.protein / f.serves)} g protein`
    : `About ${n(f.kcal)} kcal · ${f.protein} g protein`;

/** A day of ordered food, said plainly: "Tue 20 Oct: 1,840 kcal from 2 orders". */
export const dayLine = (d: NutritionSummary['days'][number]) =>
  d.orders ? `${formatDayShort(d.date)}: ${n(d.kcal)} kcal from ${d.orders} ${d.orders === 1 ? 'order' : 'orders'}` : `${formatDayShort(d.date)}: no Food Court orders`;

/** Against the target, without judging: "About 300 kcal under your daily target" / "over". */
export const vsTarget = (kcal: number, target: number | null) => {
  if (!target || !kcal) return null;
  const diff = kcal - target;
  if (Math.abs(diff) < 50) return 'About your daily target';
  return `About ${n(Math.round(Math.abs(diff) / 10) * 10)} kcal ${diff > 0 ? 'over' : 'under'} your daily target`;
};

export const SUMMARY_SCOPE = 'Only what you ordered on Food Court, from each kitchen’s recipe or an estimate. Food from elsewhere isn’t counted.';
