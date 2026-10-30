// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Serializer
// ═══════════════════════════════════════════════════════
// Defensive backend → app mapping for the session (FinMatrix convention):
// every auth response — signup, signin, Google, TOTP, /auth/me — funnels
// through here, so a renamed or missing field degrades in one place.
// Field names per MetroMatrix_Backend auth-result.ts (AuthUser).

import type {
  AuthProvider,
  AuthResult,
  AuthTokens,
  Business,
  Gender,
  TotpChallenge,
  TotpEnrolment,
  User,
  UserRole,
} from '../types/auth';
import { businessSerializer, SERVICE_TYPES, SUB_TYPES } from './businessSerializer';
import { bool, enumList, isObject, oneOf, str, strOrNull } from './serializerUtils';

export const USER_ROLES: readonly UserRole[] = ['customer', 'partner', 'rider', 'admin', 'super_admin'];
const PROVIDERS: readonly AuthProvider[] = ['password', 'google'];
const GENDERS: readonly Gender[] = ['male', 'female', 'other'];

/**
 * An unknown role falls back to `customer` — the least-privileged app — so a
 * server typo can never hand someone the admin console.
 */
export const userSerializer = (raw: unknown): User => {
  const r = isObject(raw) ? raw : {};
  const providers = enumList(r.providers, PROVIDERS);
  const role: UserRole = USER_ROLES.includes(r.role) ? (r.role as UserRole) : 'customer';
  return {
    id: str(r.id ?? r._id),
    email: str(r.email),
    // The API's field is `displayName`; `name` is the app's (and the mock's).
    name: str(r.displayName ?? r.name ?? r.fullName),
    phone: strOrNull(r.phone),
    role,
    avatarUrl: strOrNull(r.avatarUrl ?? r.photoURL),
    // Verified only when the server says exactly `true`: a missing or odd
    // value must never let an unverified account past the verify gate.
    isEmailVerified: r.isEmailVerified === true,
    hasPassword: bool(r.hasPassword, !providers.length || providers.includes('password')),
    providers: providers.length ? providers : ['password'],
    createdAt: str(r.createdAt),
    // Customers: incomplete unless the server says so (the gate then asks);
    // nobody else has a customer profile to complete.
    profileComplete: role === 'customer' ? r.profileComplete === true : true,
    // Customers who existed before CompleteProfile: asked once, may skip.
    profileSkippable: r.profileSkippable === true,
    dateOfBirth: strOrNull(r.dateOfBirth),
    gender: oneOf(r.gender, GENDERS, null),
    streetAddress: strOrNull(r.streetAddress),
    city: strOrNull(r.city),
    postalCode: strOrNull(r.postalCode),
    providerServiceType: oneOf(r.providerServiceType ?? r.serviceType, SERVICE_TYPES, null),
    providerSubType: oneOf(r.providerSubType ?? r.subType, SUB_TYPES, null),
  };
};

/** Top-level pair or one nested under `tokens`; null when either is missing. */
export const tokensSerializer = (raw: unknown): AuthTokens | null => {
  if (!isObject(raw)) return null;
  const source = isObject(raw.tokens) ? raw.tokens : raw;
  // Strings only: a number here is a malformed response, not a token.
  const { accessToken, refreshToken } = source;
  return typeof accessToken === 'string' && accessToken && typeof refreshToken === 'string' && refreshToken
    ? { accessToken, refreshToken }
    : null;
};

export interface SessionPayload {
  user: User;
  business: Business | null;
}

/** /auth/me and any response carrying { user, business }. */
export const sessionSerializer = (raw: unknown): SessionPayload | null => {
  if (!isObject(raw) || !isObject(raw.user)) return null;
  return { user: userSerializer(raw.user), business: businessSerializer(raw.business) };
};

/** Null when the response has no user or no usable token pair. */
export const authResultSerializer = (raw: unknown): AuthResult | null => {
  const session = sessionSerializer(raw);
  const tokens = tokensSerializer(raw);
  if (!session || !tokens) return null;
  return { ...session, tokens };
};

/**
 * The API says `{ totpRequired, enrolmentRequired, challengeToken }`;
 * `totpEnrolled` (the dummy API) is read too.
 */
export const totpChallengeSerializer = (raw: unknown): TotpChallenge | null => {
  if (!isObject(raw)) return null;
  const challengeToken = str(raw.challengeToken);
  if (!challengeToken) return null;
  // The API says whether an authenticator must be set up first (`enrolmentRequired`).
  const enrolled = raw.enrolmentRequired !== undefined ? !bool(raw.enrolmentRequired) : bool(raw.totpEnrolled, true);
  return { challengeToken, totpEnrolled: enrolled };
};

export const totpEnrolmentSerializer = (raw: unknown): TotpEnrolment | null => {
  if (!isObject(raw)) return null;
  const secret = str(raw.secret);
  // The API sends otpauthUri; otpauthUrl is the older name.
  const otpauthUrl = str(raw.otpauthUri ?? raw.otpauthUrl ?? raw.uri);
  const qr = str(raw.qrDataUrl);
  return secret && otpauthUrl ? { secret, otpauthUrl, qrDataUrl: qr.startsWith('data:image/') ? qr : null } : null;
};

export const recoveryCodesSerializer = (raw: unknown): string[] =>
  isObject(raw) && Array.isArray(raw.recoveryCodes)
    ? raw.recoveryCodes.map(c => str(c)).filter(Boolean)
    : [];

/** Seconds until the next resend is allowed (0 when absent). */
export const retryAfterSerializer = (raw: unknown, fallback = 60): number => {
  const v = isObject(raw) ? (raw.retryAfter ?? raw.retryAfterSeconds) : raw;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : fallback;
};
