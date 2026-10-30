// ═══════════════════════════════════════════════════════
// MetroMatrix — platform config serializer (GET /config)
// ═══════════════════════════════════════════════════════
// Defensive: anything missing reads as "on", so a partial answer never shuts
// the app — the server still enforces the real switches.

import { OPEN_PLATFORM, PLATFORM_SERVICES, type PlatformConfig } from '../types/platformConfig';
import { bool, isObject, strOrNull, str, fromResponse } from './serializerUtils';

export const platformConfigSerializer = fromResponse((raw: unknown): PlatformConfig | null => {
  if (!isObject(raw)) return null;
  const signups = isObject(raw.signupsEnabled) ? raw.signupsEnabled : {};
  const services = isObject(raw.services) ? raw.services : {};
  const maintenance = isObject(raw.maintenance) ? raw.maintenance : {};
  return {
    signupsEnabled: {
      customer: bool(signups.customer, true),
      partner: bool(signups.partner, true),
    },
    services: Object.fromEntries(
      PLATFORM_SERVICES.map(s => [s, bool(isObject(services[s]) ? services[s].enabled : undefined, true)]),
    ) as PlatformConfig['services'],
    aiEnabled: bool(isObject(raw.ai) ? raw.ai.enabled : undefined, OPEN_PLATFORM.aiEnabled),
    maintenance: {
      enabled: bool(maintenance.enabled, false),
      message: str(maintenance.message),
    },
    supportEmail: isObject(raw.support) ? strOrNull(raw.support.email) : null,
  };
});
