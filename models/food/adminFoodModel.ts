// MetroMatrix — Admin Food console: reasons, cuisines, banners and plan
// overrides. The API's own limits, so a form is refused before it is sent.

import type { AdminCuisineInput, AdminFoodBannerInput, PlanOverrides } from '../../types/food';
import type { ValidationErrors } from '../authModel';

/** Suspend or reinstate a vendor: the owner is told. */
export const validateSuspendReason = (reason: string): ValidationErrors => {
  const t = reason.trim();
  if (t.length < 3) return { reason: 'Give a reason' };
  if (t.length > 500) return { reason: 'Keep it under 500 characters' };
  return {};
};

/** Hide a review: kept with it for other staff. */
export const validateHideFoodReview = (reason: string): ValidationErrors => {
  const t = reason.trim();
  if (t.length < 3) return { reason: 'Give a reason' };
  if (t.length > 300) return { reason: 'Keep it under 300 characters' };
  return {};
};

export const SUSPEND_REASONS = ['Food safety complaint under review', 'Repeated late or missed orders', 'Documents need updating'];
export const REINSTATE_REASONS = ['Reviewed and cleared', 'Documents updated'];
export const HIDE_REVIEW_REASONS = ['Abusive language', 'Shares personal details', 'Not about the order', 'Advertising or spam'];

/** Food safety check note (home kitchens). */
export const validateSafetyNote = (note: string): ValidationErrors => {
  const t = note.trim();
  if (t.length < 3) return { note: 'Say what was checked, for example "Kitchen visited, storage and hygiene fine"' };
  if (t.length > 1000) return { note: 'Keep it under 1,000 characters' };
  return {};
};

export const cuisineSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export const validateCuisine = (c: AdminCuisineInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  const name = c.name.trim();
  if (name.length < 2) errors.name = 'Give the cuisine a name';
  else if (name.length > 60) errors.name = 'Keep it under 60 characters';
  if (!/^[a-z0-9-]{2,40}$/.test(c.slug)) errors.slug = 'Use 2–40 lowercase letters, digits or dashes';
  if (!Number.isInteger(c.sort) || c.sort < 0 || c.sort > 999) errors.sort = 'A number from 0 to 999';
  return errors;
};

export const validateFoodBanner = (b: AdminFoodBannerInput): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!b.imageUrl) errors.imageUrl = 'Add a picture';
  const title = b.title.trim();
  if (title.length < 2) errors.title = 'Give the banner a title';
  else if (title.length > 80) errors.title = 'Keep it under 80 characters';
  if ((b.subtitle ?? '').length > 160) errors.subtitle = 'Keep it under 160 characters';
  if (b.targetType === 'search' && !(b.targetQuery ?? '').trim()) errors.targetQuery = 'What should it search for?';
  if (b.targetType !== 'search' && !b.targetId) errors.targetId = b.targetType === 'vendor' ? 'Choose a vendor' : 'Choose a cuisine';
  if (b.endsAt && b.startsAt && Date.parse(b.endsAt) <= Date.parse(b.startsAt)) errors.endsAt = 'It must end after it starts';
  return errors;
};

/** What staff can change on a vendor's plan (brands and branches stay at 1). */
export const PLAN_LIMIT_FIELDS: { key: 'riders' | 'menu_items' | 'promotions_active'; label: string; max: number }[] = [
  { key: 'riders', label: 'Active riders', max: 500 },
  { key: 'menu_items', label: 'Menu items', max: 10000 },
  { key: 'promotions_active', label: 'Running deals', max: 100 },
];

export const PLAN_ENTITLEMENT_FIELDS: { key: 'riders' | 'promotions' | 'insights' | 'preorders'; label: string; helper: string }[] = [
  { key: 'riders', label: 'Riders', helper: 'Rider accounts and live tracking' },
  { key: 'promotions', label: 'Deals', helper: 'Automatic deals and codes' },
  { key: 'insights', label: 'Insights', helper: 'Recorded sales and order numbers' },
  { key: 'preorders', label: 'Scheduled orders', helper: 'Orders for later and pre-order slots' },
];

/** The Community plan includes everything; an override can only turn something off. */
const PLAN_INCLUDES: Record<string, boolean> = { riders: true, promotions: true, insights: true, preorders: true };

/** The form's text fields → overrides; '' leaves a limit at the plan's own. */
export const planOverridesFrom = (limits: Record<string, string>, entitlements: Record<string, boolean>): PlanOverrides => {
  const out: PlanOverrides = {};
  const l = Object.fromEntries(Object.entries(limits).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
  if (Object.keys(l).length) out.limits = l;
  const e = Object.fromEntries(Object.entries(entitlements).filter(([k, v]) => PLAN_INCLUDES[k] !== v));
  if (Object.keys(e).length) out.entitlements = e;
  return out;
};

export const validatePlanLimits = (limits: Record<string, string>): ValidationErrors => {
  const errors: ValidationErrors = {};
  for (const f of PLAN_LIMIT_FIELDS) {
    const v = (limits[f.key] ?? '').trim();
    if (v === '') continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > f.max) errors[f.key] = `A whole number from 0 to ${f.max.toLocaleString('en-PK')}`;
  }
  return errors;
};

/** Where a vendor stands, as staff read it. */
export const vendorStanding = (v: { businessStatus: string; branchStatus: string; isPaused: boolean }): { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } =>
  v.businessStatus === 'suspended'
    ? { label: 'Suspended', tone: 'danger' }
    : v.businessStatus !== 'approved'
      ? { label: 'Not approved', tone: 'neutral' }
      : v.isPaused
        ? { label: 'Paused', tone: 'warning' }
        : v.branchStatus === 'active'
          ? { label: 'Live', tone: 'success' }
          : { label: 'Setting up', tone: 'neutral' };

export const VENDOR_STATUS_FILTERS: { key: 'all' | 'live' | 'draft' | 'paused' | 'suspended'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'draft', label: 'Setting up' },
  { key: 'paused', label: 'Paused' },
  { key: 'suspended', label: 'Suspended' },
];

const ACTOR: Record<string, string> = { customer: 'Customer', vendor: 'Vendor', rider: 'Rider', system: 'Food Court', admin: 'Staff', super_admin: 'Staff' };

/** "Vendor" / "Customer" / "Food Court" (the minute jobs) for an order event. */
export const actorLabel = (role: string | null) => (role ? (ACTOR[role] ?? role) : 'Food Court');
