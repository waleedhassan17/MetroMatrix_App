// ═══════════════════════════════════════════════════════
// MetroMatrix — platform config (GET /config)
// ═══════════════════════════════════════════════════════
// The server's switches as the apps see them: sign-ups, services, AI and
// maintenance. The server enforces every one of them (403 SIGNUPS_PAUSED,
// 503 SERVICE_PAUSED, 503 MAINTENANCE); the app reads them to show a clear
// screen instead of a failed request.

export type PlatformService = 'shopping' | 'healthcare' | 'food' | 'kitchen';

export const PLATFORM_SERVICES: readonly PlatformService[] = ['shopping', 'healthcare', 'food', 'kitchen'];

export interface PlatformConfig {
  signupsEnabled: { customer: boolean; partner: boolean };
  services: Record<PlatformService, boolean>;
  aiEnabled: boolean;
  maintenance: { enabled: boolean; message: string };
  supportEmail: string | null;
}

/** What the app assumes before /config answers (or if it never does): open. */
export const OPEN_PLATFORM: PlatformConfig = {
  signupsEnabled: { customer: true, partner: true },
  services: { shopping: true, healthcare: true, food: true, kitchen: true },
  aiEnabled: true,
  maintenance: { enabled: false, message: '' },
  supportEmail: null,
};
