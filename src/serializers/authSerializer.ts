// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth Serializer
// ═══════════════════════════════════════════════════════
// Defensive backend → app mapping for the session (FinMatrix convention):
// every auth response — signup, signin, Google, TOTP, /auth/me — funnels
// through here, so a renamed or missing field degrades in one place.
// TODO(API_AUTH): field names per docs/API_CONTRACT_ASSUMED.md.

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
  return {
    id: str(r.id ?? r._id),
    email: str(r.email),
    name: str(r.name ?? r.displayName ?? r.fullName),
    phone: strOrNull(r.phone),
    role: USER_ROLES.includes(r.role) ? (r.role as UserRole) : 'customer',
    avatarUrl: strOrNull(r.avatarUrl ?? r.photoURL),
    // Default true, as FinMatrix does: the server sends `false` explicitly
    // for an unverified account, and a missing flag must not trap a verified
    // user on the verify screen.
    isEmailVerified: bool(r.isEmailVerified ?? r.emailVerified, true),
    hasPassword: bool(r.hasPassword, !providers.length || providers.includes('password')),
    providers: providers.length ? providers : ['password'],
    createdAt: str(r.createdAt),
    // Missing ⇒ complete: a server that predates CompleteProfile must not
    // trap every existing customer on it.
    profileComplete: bool(r.profileComplete, true),
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

export const totpChallengeSerializer = (raw: unknown): TotpChallenge | null => {
  if (!isObject(raw)) return null;
  const challengeToken = str(raw.challengeToken);
  if (!challengeToken) return null;
  return { challengeToken, totpEnrolled: bool(raw.totpEnrolled, true) };
};

export const totpEnrolmentSerializer = (raw: unknown): TotpEnrolment | null => {
  if (!isObject(raw)) return null;
  const secret = str(raw.secret);
  const otpauthUrl = str(raw.otpauthUrl ?? raw.otpauthUri ?? raw.uri);
  return secret && otpauthUrl ? { secret, otpauthUrl } : null;
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
