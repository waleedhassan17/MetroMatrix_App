// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy API rules
// ═══════════════════════════════════════════════════════
// Everything a tester needs to know to drive the app with no backend.
// Mirrored in docs/API_CONTRACT_ASSUMED.md → "Mock mode".

const IN_TESTS = typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID;

export const MOCK = {
  /** The 6-digit code "emailed" for password reset. */
  RESET_OTP: '123456',
  /** The authenticator code every staff account accepts. */
  TOTP_CODE: '123456',
  /** The secret shown when a new staff account sets up its authenticator. */
  TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  /** The verification link counts as opened this long after it was sent. */
  EMAIL_LINK_SECONDS: 5,
  /** A submitted provider application approves itself after this long. */
  AUTO_APPROVE_SECONDS: 30,
  /** Seconds before another verification / reset email may be sent. */
  RESEND_SECONDS: 60,
  /** Wrong reset codes allowed before the code locks. */
  OTP_ATTEMPTS: 5,
  /** Access tokens expire (and are silently refreshed) after this long. */
  ACCESS_TTL_MS: 15 * 60 * 1000,
  /** Simulated network latency, so loading states are visible. */
  LATENCY_MS: IN_TESTS ? ([0, 0] as const) : ([300, 700] as const),
  /** Where the dummy database is persisted (survives app restarts). */
  // v2: Health speaks the real API_HEALTH.md (icon keys, reschedules, payments); a v1 database reseeds.
  STORAGE_KEY: 'metromatrix.mock-db.v3',
} as const;

/** Every seeded account uses this password (staff use STAFF_PASSWORD). */
export const SEED_PASSWORD = 'Metro2026';
export const STAFF_PASSWORD = 'Admin2026';
