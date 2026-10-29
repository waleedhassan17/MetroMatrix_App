// ═══════════════════════════════════════════════════════
// MetroMatrix — dummy API: the platform's switches
// ═══════════════════════════════════════════════════════
// The real API's platform settings (MetroMatrix API docs/ADMIN_API.md §5):
// the same keys and defaults, GET /config's shape, and the same refusals —
// 503 MAINTENANCE, 503 SERVICE_PAUSED, 403 SIGNUPS_PAUSED — so the app's
// maintenance, paused and sign-ups-paused screens can be walked with no
// backend. Flip a switch with PATCH /admin/settings (any staff account).

import { ShopError } from './shop/shopLogic';

export type PlatformSettings = Record<string, boolean | string>;

export const DEFAULT_PLATFORM: PlatformSettings = {
  'signupsEnabled.customer': true,
  'signupsEnabled.partner': true,
  'services.shopping.enabled': true,
  'services.healthcare.enabled': true,
  'services.food.enabled': true,
  'services.kitchen.enabled': true,
  'ai.enabled': true,
  'maintenance.enabled': false,
  'maintenance.message': 'MetroMatrix is down for scheduled maintenance. Please try again shortly.',
  'support.email': '',
};

export const publicConfig = (s: PlatformSettings) => ({
  signupsEnabled: { customer: s['signupsEnabled.customer'] !== false, partner: s['signupsEnabled.partner'] !== false },
  services: {
    shopping: { enabled: s['services.shopping.enabled'] !== false },
    healthcare: { enabled: s['services.healthcare.enabled'] !== false },
    food: { enabled: s['services.food.enabled'] !== false },
    kitchen: { enabled: s['services.kitchen.enabled'] !== false },
  },
  ai: { enabled: s['ai.enabled'] !== false },
  maintenance: { enabled: s['maintenance.enabled'] === true, message: String(s['maintenance.message'] ?? '') },
  support: { email: (s['support.email'] as string) || null },
});

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const KITCHEN = ['/food/vendor/kitchen', '/food/surplus', '/food/me/nutrition', '/my-kitchen'];

const servicesOf = (path: string): string[] => {
  if (under(path, '/shop')) return ['shopping'];
  if (path.startsWith('/health/')) return ['healthcare'];
  if (KITCHEN.some(p => under(path, p))) return path.startsWith('/food') ? ['food', 'kitchen'] : ['kitchen'];
  if (under(path, '/food') || under(path, '/public/food')) return ['food'];
  return [];
};

const LABEL: Record<string, string> = { shopping: 'Shopping', healthcare: 'Healthcare', food: 'Food', kitchen: 'Kitchen' };

/**
 * What PlatformGuard and the sign-up gates refuse, before any route runs.
 * `role` is the signed-in caller's, when there is one.
 */
export function platformGate(
  s: PlatformSettings,
  method: string,
  path: string,
  body: Record<string, unknown>,
  role: string | null,
): void {
  const admin = role === 'admin' || role === 'super_admin';
  if (s['maintenance.enabled'] === true && !admin) {
    const exempt =
      ['/auth/me', '/config', '/health', '/auth/logout', '/auth/signout', '/auth/admin/totp'].includes(path) ||
      under(path, '/admin') ||
      (path === '/auth/signin' && body.portal === 'admin');
    if (!exempt) {
      const message = String(s['maintenance.message'] ?? '');
      throw new ShopError(503, 'MAINTENANCE', message, { message });
    }
  }
  const paused = servicesOf(path).find(svc => s[`services.${svc}.enabled`] === false);
  if (paused) {
    throw new ShopError(503, 'SERVICE_PAUSED', `${LABEL[paused]} is paused for now. Please try again later.`, {
      service: paused,
    });
  }
  if (method === 'POST' && path === '/auth/signup') {
    const r = body.role === 'partner' ? 'partner' : 'customer';
    if (s[`signupsEnabled.${r}`] === false) {
      throw new ShopError(
        403,
        'SIGNUPS_PAUSED',
        r === 'partner'
          ? 'New partner accounts are paused for now. Please try again later.'
          : 'New accounts are paused for now. Please try again later.',
        { role: r },
      );
    }
  }
}

/** PATCH /admin/settings: known keys only, each of the right type. */
export function applySettings(s: PlatformSettings, values: unknown): PlatformSettings {
  if (!values || typeof values !== 'object') {
    throw new ShopError(400, 'VALIDATION_FAILED', 'Send at least one setting to change.');
  }
  const fields: Record<string, string[]> = {};
  const next = { ...s };
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (!(key in DEFAULT_PLATFORM)) fields[key] = ['is not a setting'];
    else if (typeof value !== typeof DEFAULT_PLATFORM[key]) fields[key] = [`must be ${typeof DEFAULT_PLATFORM[key]}`];
    else next[key] = typeof value === 'string' ? value.trim() : (value as boolean);
  }
  if (Object.keys(fields).length) {
    throw new ShopError(400, 'VALIDATION_FAILED', 'Some settings are not valid.', { fields });
  }
  return next;
}
