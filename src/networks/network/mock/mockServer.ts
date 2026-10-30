// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy API server (an axios adapter)
// ═══════════════════════════════════════════════════════
// While src/config/env.ts has no backend URL, `api` sends every request
// here instead of over the network. Each route answers exactly as
// docs/API_CONTRACT_ASSUMED.md says the real backend will:
//   success  { data: <payload> }                      2xx
//   failure  { error: { code, message, details } }    4xx
// so networks, serializers, slices and screens run unchanged against either.
// Rules a tester relies on (codes, delays, seeded accounts) are in
// ./mockConfig.ts and ./mockDb.ts.

import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { DOCUMENT_REQUIREMENTS, evaluateDocuments } from '../../../models/businessModel';
import type { DocumentKind, ServiceType, SubType } from '../../../types/auth';
import { MOCK } from './mockConfig';
import { getDb, newId, saveDb, type MockBusiness, type MockDb, type MockUser } from './mockDb';
import { MOCK_CUISINES, MOCK_KITCHENS, MOCK_PROMOS } from './mockFood';
import { ShopError } from './shop/shopLogic';
import { registerShopRoutes } from './shop/shopRoutes';
import { registerHealthRoutes } from './health/healthRoutes';

// ─── Plumbing ────────────────────────────────────────
// One error type for every route; the shop routes throw the same class.
class MockError extends ShopError {}

interface Ctx {
  db: MockDb;
  body: Record<string, any>;
  query: Record<string, any>;
  params: string[];
  token: string | null;
  now: number;
  /** Request headers, lower-cased (Idempotency-Key). */
  headers: Record<string, string>;
  /** Override the 200 a successful handler answers with (201 on creates). */
  setStatus: (status: number) => void;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

const SUB_TYPES: SubType[] = ['store', 'doctor', 'restaurant', 'home_kitchen', 'cloud_kitchen'];
const SERVICE_OF: Record<SubType, ServiceType> = {
  store: 'shopping',
  doctor: 'healthcare',
  restaurant: 'food',
  home_kitchen: 'food',
  cloud_kitchen: 'food',
};

const isoNow = () => new Date().toISOString();
const sleep = (ms: number) => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());
const latency = () => MOCK.LATENCY_MS[0] + Math.random() * (MOCK.LATENCY_MS[1] - MOCK.LATENCY_MS[0]);

// Fields the real API never sends (secrets, mock-only bookkeeping) are dropped.
const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
};

const publicUser = (u: MockUser) => omit(u, ['password', 'verificationSentAt', 'totpEnrolled', 'recoveryCodes']);

/** The API's BusinessDetail. */
const publicBusiness = (b: MockBusiness) => {
  const rest = omit(b, ['autoApprove', 'details']);
  const { requirements, missing } = evaluateDocuments(b.subType, b.documents);
  return { ...rest, requiredDocuments: requirements, missingDocuments: missing };
};

const findUserByEmail = (db: MockDb, email: unknown) =>
  db.users.find(u => u.email.toLowerCase() === String(email ?? '').trim().toLowerCase());

const businessOf = (db: MockDb, userId: string) => db.businesses.find(b => b.ownerId === userId) ?? null;

/** Lazily applies the auto-approve rule — no timers survive a reload. */
const settleApproval = (b: MockBusiness | null, now: number) => {
  if (
    b &&
    b.status === 'pending_approval' &&
    b.autoApprove &&
    b.submittedAt &&
    now - Date.parse(b.submittedAt) >= MOCK.AUTO_APPROVE_SECONDS * 1000
  ) {
    b.status = 'approved';
    b.reviewedAt = isoNow();
    b.documents.forEach(d => {
      d.status = 'accepted';
    });
  }
  return b;
};

const issueSession = (db: MockDb, user: MockUser) => {
  const accessToken = `mock-access-${newId('t')}`;
  const refreshToken = `mock-refresh-${newId('t')}`;
  db.access[accessToken] = { userId: user.id, expiresAt: Date.now() + MOCK.ACCESS_TTL_MS, refreshToken };
  db.refresh[refreshToken] = user.id;
  return { accessToken, refreshToken };
};

/**
 * As the API (API_AUTH.md §2 BusinessSummary): the session carries only the
 * business's identity and status, no address or documents; a doctor's adds
 * `isListed` and `pmdcVerified`. The App reads the rest from /businesses/me.
 */
const businessSummary = (b: MockBusiness) => ({
  id: b.id,
  name: b.name,
  slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  serviceType: b.serviceType,
  subType: b.subType,
  status: b.status,
  rejectionReason: b.rejectionReason,
  suspensionReason: b.suspensionReason,
  submittedAt: b.submittedAt,
  ...(b.subType === 'doctor' ? { isListed: !!b.isListed, pmdcVerified: !!b.pmdcVerified } : null),
});

const sessionPayload = (db: MockDb, user: MockUser, now: number) => ({
  user: publicUser(user),
  business: user.role === 'partner' ? (() => {
    const b = settleApproval(businessOf(db, user.id), now);
    return b ? businessSummary(b) : null;
  })() : null,
});

const authResult = (db: MockDb, user: MockUser, now: number) => ({
  ...sessionPayload(db, user, now),
  tokens: issueSession(db, user),
});

const requireUser = (ctx: Ctx): MockUser => {
  const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
  if (!session) throw new MockError(401, 'UNAUTHORIZED', 'Please sign in again.');
  if (session.expiresAt < ctx.now) throw new MockError(401, 'TOKEN_EXPIRED', 'Your session expired.');
  const user = ctx.db.users.find(u => u.id === session.userId);
  if (!user) throw new MockError(401, 'UNAUTHORIZED', 'Please sign in again.');
  return user;
};

const requirePartnerBusiness = (ctx: Ctx, allowSuspended = false) => {
  const user = requireUser(ctx);
  if (user.role !== 'partner') throw new MockError(403, 'FORBIDDEN', 'Only providers can do this.');
  const business = settleApproval(businessOf(ctx.db, user.id), ctx.now);
  if (business?.status === 'suspended' && !allowSuspended) {
    throw new MockError(403, 'BUSINESS_SUSPENDED', 'Your business is paused. Contact support.');
  }
  return { user, business };
};

const requireAdmin = (ctx: Ctx) => {
  const user = requireUser(ctx);
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new MockError(403, 'FORBIDDEN', 'Staff only.');
  }
  return user;
};

/** The API's policy (common/validation/password.ts): 8–72, lower, upper, digit. */
const passwordOk = (p: unknown) =>
  typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

const PASSWORD_MESSAGE = 'Use 8–72 characters with an upper-case letter, a lower-case letter and a number.';

/** As on the API: 400 VALIDATION_FAILED with `details.fields` ({ field: [messages] }). */
const invalid = (fields: Record<string, string>) =>
  new MockError(
    400,
    'VALIDATION_FAILED',
    Object.values(fields)[0] ?? 'Check your details and try again.',
    { fields: Object.fromEntries(Object.entries(fields).map(([k, m]) => [k, [m]])) },
  );

const revokeSessions = (db: MockDb, userId: string) => {
  for (const [t, s] of Object.entries(db.access)) if (s.userId === userId) delete db.access[t];
  for (const [t, id] of Object.entries(db.refresh)) if (id === userId) delete db.refresh[t];
};

/** Payload of a JWT (a real Google ID token on web), or null. */
const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = typeof atob === 'function'
      ? atob(part.replace(/-/g, '+').replace(/_/g, '/'))
      : Buffer.from(part, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
};

// ─── Routes ──────────────────────────────────────────
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: string, handler: Handler) => {
  const re = new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, '([^/]+)')}$`);
  routes.push([method, re, handler]);
};

// ── Auth ──
// The API's SignupDto: { email, password, displayName, phone?, role }. The
// provider's type is not on the account; it arrives with POST /businesses.
route('POST', '/auth/signup', ({ db, body, now }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role;
  const fields: Record<string, string> = {};
  if (!email) fields.email = 'Enter a valid email address';
  if (!body.displayName || String(body.displayName).trim().length < 2) fields.displayName = 'Name must be at least 2 characters';
  if (!passwordOk(body.password)) fields.password = PASSWORD_MESSAGE;
  if (role !== 'customer' && role !== 'partner') fields.role = 'role must be customer or partner';
  if (Object.keys(fields).length) throw invalid(fields);
  if (findUserByEmail(db, email)) {
    throw new MockError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  }
  const partner = role === 'partner';
  const user: MockUser = {
    id: newId('u'),
    email,
    name: String(body.displayName).trim(),
    phone: body.phone ?? null,
    role: partner ? 'partner' : 'customer',
    avatarUrl: null,
    isEmailVerified: false,
    hasPassword: true,
    providers: ['password'],
    createdAt: isoNow(),
    profileComplete: partner,
    dateOfBirth: null,
    gender: null,
    streetAddress: null,
    city: null,
    postalCode: null,
    providerServiceType: null,
    providerSubType: null,
    password: body.password,
    verificationSentAt: now,
    totpEnrolled: false,
    recoveryCodes: [],
  };
  db.users.push(user);
  return authResult(db, user, now);
});

route('POST', '/auth/signin', ({ db, body, now }) => {
  const user = findUserByEmail(db, body.email);
  if (!user || !user.password || user.password !== body.password) {
    throw new MockError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  // As on the API: each door admits its own accounts, and WRONG_PORTAL names
  // the ACCOUNT (accountType) and the door used (portal). Staff use the admin
  // door, which the app tries for them after the User door says WRONG_PORTAL.
  const door = body.portal;
  const staff = user.role === 'admin' || user.role === 'super_admin';
  const allowed = staff ? door === 'admin' : user.role === door;
  if (!allowed) {
    const message = staff
      ? 'Staff accounts sign in on the admin portal.'
      : user.role === 'partner'
        ? 'This is a service provider account. Sign in on the partner portal.'
        : 'This is a customer account. Sign in on the customer portal.';
    throw new MockError(403, 'WRONG_PORTAL', message, { accountType: user.role, portal: door });
  }
  if (staff) {
    const challengeToken = `mock-challenge-${newId('c')}`;
    db.challenges[challengeToken] = { userId: user.id, expiresAt: now + 5 * 60 * 1000 };
    return { totpRequired: true, enrolmentRequired: !user.totpEnrolled, challengeToken };
  }
  return authResult(db, user, now);
});

/** A live challenge's user, or 401 UNAUTHORIZED (expired or spent), as on the API. */
const challengeUser = (db: MockDb, token: unknown, now: number) => {
  const challenge = db.challenges[String(token)];
  const user = challenge && challenge.expiresAt >= now ? db.users.find(u => u.id === challenge.userId) : undefined;
  if (!user) throw new MockError(401, 'UNAUTHORIZED', 'This sign-in has expired. Enter your email and password again.');
  return user;
};

route('POST', '/auth/admin/totp', ({ db, body, now }) => {
  const user = challengeUser(db, body.challengeToken, now);
  if (!user.totpEnrolled) {
    throw new MockError(403, 'TOTP_REQUIRED', 'Set up your authenticator app before signing in.', { enrolmentRequired: true });
  }
  if (body.recoveryCode) {
    const code = String(body.recoveryCode).trim().toUpperCase();
    const i = user.recoveryCodes.indexOf(code);
    if (i === -1) throw new MockError(401, 'TOTP_INVALID', 'That code is not right.');
    user.recoveryCodes.splice(i, 1);
  } else if (body.code !== MOCK.TOTP_CODE) {
    throw new MockError(401, 'TOTP_INVALID', 'That code is not right.');
  }
  delete db.challenges[String(body.challengeToken)];
  return authResult(db, user, now);
});

// The challenge travels as the bearer (AdminTotpEnrolGuard), never in the body.
route('POST', '/admin/me/totp/enrol', ({ db, token, now }) => {
  const user = challengeUser(db, token, now);
  if (user.totpEnrolled) {
    throw new MockError(403, 'TOTP_REQUIRED', 'Your authenticator is already set up. Sign in with a code from it.');
  }
  const otpauthUri = `otpauth://totp/MetroMatrix:${encodeURIComponent(user.email)}?secret=${MOCK.TOTP_SECRET}&issuer=MetroMatrix`;
  return { otpauthUri, qrDataUrl: 'data:image/png;base64,', secret: MOCK.TOTP_SECRET };
});

route('POST', '/admin/me/totp/confirm', ({ db, body, token, now }) => {
  const user = challengeUser(db, token, now);
  if (body.code !== MOCK.TOTP_CODE) {
    throw new MockError(400, 'TOTP_INVALID', 'That code is not right. Check the time on your phone and try again.');
  }
  user.totpEnrolled = true;
  user.recoveryCodes = Array.from({ length: 8 }, () =>
    `MM${Math.random().toString(36).slice(2, 4)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
  );
  delete db.challenges[String(token)];
  return { recoveryCodes: user.recoveryCodes, auth: authResult(db, user, now) };
});

route('POST', '/auth/google', ({ db, body, now }) => {
  const claims = decodeJwt(String(body.idToken ?? ''));
  const email = String(claims?.email ?? 'google.user@gmail.com').toLowerCase();
  let user = findUserByEmail(db, email);
  if (user && user.role !== 'customer') {
    throw new MockError(403, 'WRONG_PORTAL', 'This account signs in with email and password.', { portal: 'partner' });
  }
  if (!user) {
    user = {
      id: newId('u'),
      email,
      name: String(claims?.name ?? 'Google User'),
      phone: null,
      role: 'customer',
      avatarUrl: claims?.picture ?? null,
      isEmailVerified: true,
      hasPassword: false,
      providers: ['google'],
      createdAt: isoNow(),
      profileComplete: false,
      dateOfBirth: null,
      gender: null,
      streetAddress: null,
      city: null,
      postalCode: null,
      providerServiceType: null,
      providerSubType: null,
      password: null,
      verificationSentAt: 0,
      totpEnrolled: false,
      recoveryCodes: [],
    };
    db.users.push(user);
  }
  return authResult(db, user, now);
});

/** The dummy inbox: the emailed link counts as opened a few seconds after it is sent. */
const openLinkIfDue = (user: MockUser, now: number) => {
  if (!user.isEmailVerified && now - user.verificationSentAt >= MOCK.EMAIL_LINK_SECONDS * 1000) {
    user.isEmailVerified = true;
  }
};

// Public, as on the API: the link may open the app signed out.
route('POST', '/auth/verify-email', ({ db, body, now }) => {
  // The app link's token: metromatrix://verify-email?token=mock-verify-<userId>
  const userId = String(body.token ?? '').replace(/^mock-verify-/, '');
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    throw new MockError(400, 'VERIFY_LINK_INVALID', 'This link has expired or been replaced. Open the app and tap Resend.');
  }
  user.isEmailVerified = true;
  return sessionPayload(db, user, now);
});

route('POST', '/auth/resend-verification', ctx => {
  const user = requireUser(ctx);
  if (user.isEmailVerified) return { sent: false, alreadyVerified: true, retryAfter: 0 };
  const wait = Math.ceil((user.verificationSentAt + MOCK.RESEND_SECONDS * 1000 - ctx.now) / 1000);
  if (wait > 0) throw new MockError(429, 'RESEND_COOLDOWN', `Please wait ${wait} seconds before requesting another link.`, { retryAfter: wait });
  user.verificationSentAt = ctx.now;
  return { sent: true, alreadyVerified: false, retryAfter: MOCK.RESEND_SECONDS };
});

route('POST', '/auth/refresh-token', ({ db, body }) => {
  const userId = db.refresh[String(body.refreshToken ?? '')];
  const user = userId ? db.users.find(u => u.id === userId) : undefined;
  if (!user) throw new MockError(401, 'REFRESH_INVALID', 'Please sign in again.');
  delete db.refresh[String(body.refreshToken)];
  return { ...issueSession(db, user), expiresIn: MOCK.ACCESS_TTL_MS / 1000 };
});

// As the API: no body; the bearer (expired or not) ends its own session,
// refresh token included. Always 200.
route('POST', '/auth/logout', ctx => {
  const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
  if (session?.refreshToken) delete ctx.db.refresh[session.refreshToken];
  if (ctx.token) delete ctx.db.access[ctx.token];
  return { signedOut: true };
});

route('GET', '/auth/me', ctx => {
  const user = requireUser(ctx);
  openLinkIfDue(user, ctx.now);
  return sessionPayload(ctx.db, user, ctx.now);
});

// As on the API: always 200 { delivered: true }, no cooldown of its own (the
// app keeps a 60 s timer), so the endpoint never reveals whether an account exists.
route('POST', '/auth/forgot-password', ({ db, body, now }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  if (findUserByEmail(db, email)) {
    db.resets[email] = { code: MOCK.RESET_OTP, attemptsLeft: MOCK.OTP_ATTEMPTS, sentAt: now, resetToken: null };
  }
  return { delivered: true };
});

// { email, otp } → { resetToken }. All 400s, as on the API.
route('POST', '/auth/verify-otp', ({ db, body }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  const reset = db.resets[email];
  if (!reset) throw new MockError(400, 'OTP_INVALID', 'The code is invalid or has expired.');
  if (body.otp !== reset.code) {
    reset.attemptsLeft -= 1;
    if (reset.attemptsLeft <= 0) {
      delete db.resets[email];
      throw new MockError(400, 'OTP_LOCKED', 'Too many incorrect attempts. Request a new code.');
    }
    throw new MockError(400, 'OTP_INVALID', 'That code is not right. Check the email and try again.', {
      attemptsLeft: reset.attemptsLeft,
    });
  }
  reset.resetToken = `mock-reset-${newId('r')}`;
  return { resetToken: reset.resetToken };
});

route('POST', '/auth/reset-password', ({ db, body }) => {
  const entry = Object.entries(db.resets).find(([, r]) => r.resetToken && r.resetToken === body.resetToken);
  if (!entry) throw new MockError(400, 'OTP_INVALID', 'This reset session is invalid or has expired. Please start again.');
  if (!passwordOk(body.password)) throw invalid({ password: PASSWORD_MESSAGE });
  const user = findUserByEmail(db, entry[0]);
  if (user) {
    user.password = body.password;
    user.hasPassword = true;
    revokeSessions(db, user.id);
  }
  delete db.resets[entry[0]];
  return { reset: true };
});

/** As on the API: the password, or for a Google-only account a Google ID token for its email. 403, not 401. */
const reauthenticate = (user: MockUser, body: Record<string, unknown>) => {
  const ok = user.hasPassword
    ? body.password === user.password || body.currentPassword === user.password
    : String(decodeJwt(String(body.idToken ?? ''))?.email ?? (body.idToken ? 'google.user@gmail.com' : '')).toLowerCase() ===
      user.email;
  if (!ok) throw new MockError(403, 'INVALID_CREDENTIALS', 'Your password is incorrect.');
};

// Ends every session (this one too) and answers a new pair, as the API does.
route('POST', '/auth/change-password', ctx => {
  const user = requireUser(ctx);
  reauthenticate(user, ctx.body);
  if (!passwordOk(ctx.body.newPassword)) throw invalid({ newPassword: PASSWORD_MESSAGE });
  user.password = ctx.body.newPassword;
  user.hasPassword = true;
  if (!user.providers.includes('password')) user.providers.push('password');
  revokeSessions(ctx.db, user.id);
  return { changed: true, tokens: { ...issueSession(ctx.db, user), expiresIn: MOCK.ACCESS_TTL_MS / 1000 } };
});

route('DELETE', '/auth/account', ctx => {
  const user = requireUser(ctx);
  reauthenticate(user, ctx.body);
  revokeSessions(ctx.db, user.id);
  ctx.db.users = ctx.db.users.filter(u => u.id !== user.id);
  ctx.db.businesses = ctx.db.businesses.filter(b => b.ownerId !== user.id);
  return { deleted: true };
});

// ── Users ──
// As on the API: the name is `displayName`, and the answer is the user itself.
route('PATCH', '/users/me', ctx => {
  const user = requireUser(ctx);
  if (typeof ctx.body.displayName === 'string') user.name = ctx.body.displayName.trim();
  if (ctx.body.phone !== undefined) user.phone = ctx.body.phone;
  if (ctx.body.avatarUrl !== undefined) user.avatarUrl = ctx.body.avatarUrl;
  return publicUser(user);
});

route('PATCH', '/users/me/profile', ctx => {
  const user = requireUser(ctx);
  if (user.role !== 'customer') throw new MockError(403, 'FORBIDDEN', 'Only customers have this profile.');
  const b = ctx.body;
  const fields: Record<string, string> = {};
  if (!b.dateOfBirth) fields.dateOfBirth = 'Enter a real date of birth (YYYY-MM-DD)';
  if (!['male', 'female', 'other'].includes(b.gender)) fields.gender = 'gender must be male, female or other';
  if (!b.streetAddress) fields.streetAddress = 'streetAddress must be at least 5 characters';
  if (!b.city) fields.city = 'city must be at least 2 characters';
  if (Object.keys(fields).length) throw invalid(fields);
  Object.assign(user, {
    dateOfBirth: b.dateOfBirth,
    gender: b.gender,
    streetAddress: b.streetAddress,
    city: b.city,
    postalCode: b.postalCode ?? null,
    ...(b.avatarUrl !== undefined ? { avatarUrl: b.avatarUrl } : null),
    profileComplete: true,
  });
  return { user: publicUser(user) };
});

// As on the API: PUT { expoPushToken, platform } → { registered }; a token
// belongs to whichever account last registered it.
route('PUT', '/users/me/devices', ctx => {
  const user = requireUser(ctx);
  const token = String(ctx.body.expoPushToken ?? '');
  if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(token) || !['android', 'ios', 'web'].includes(ctx.body.platform)) {
    throw new MockError(400, 'VALIDATION_FAILED', 'expoPushToken must be an Expo push token');
  }
  ctx.db.devices = ctx.db.devices.filter(d => d.token !== token);
  ctx.db.devices.push({ userId: user.id, token });
  return { registered: true };
});

// DELETE → { removed } (false when it was already gone; idempotent).
route('DELETE', '/users/me/devices/:token', ctx => {
  const user = requireUser(ctx);
  const token = decodeURIComponent(ctx.params[0]);
  const before = ctx.db.devices.length;
  ctx.db.devices = ctx.db.devices.filter(d => !(d.token === token && d.userId === user.id));
  return { removed: ctx.db.devices.length < before };
});

// ── Media ──
// As the API's UPLOAD_PURPOSES (asset-url.ts): PDFs only where a paper is expected.
const IMAGE_FORMATS = 'jpg,jpeg,png,webp,heic';
const UPLOAD_SPECS: Record<string, { formats: string; maxBytes: number }> = {
  avatar: { formats: IMAGE_FORMATS, maxBytes: 5_000_000 },
  business_document: { formats: `${IMAGE_FORMATS},pdf`, maxBytes: 10_000_000 },
  payment_proof: { formats: `${IMAGE_FORMATS},pdf`, maxBytes: 10_000_000 },
  health_record: { formats: `${IMAGE_FORMATS},pdf`, maxBytes: 15_000_000 },
};

route('POST', '/media/sign-upload', ctx => {
  const user = requireUser(ctx);
  const purpose = String(ctx.body.purpose ?? '');
  const spec = UPLOAD_SPECS[purpose] ?? { formats: IMAGE_FORMATS, maxBytes: 8_000_000 };
  const folder = `metromatrix/dev/${user.id}/${purpose || 'misc'}`;
  return {
    cloudName: 'mock',
    apiKey: 'mock',
    timestamp: Math.floor(ctx.now / 1000),
    signature: 'mock-signature',
    folder,
    publicIdPrefix: `${folder}/`,
    uploadUrl: 'mock://upload',
    allowedFormats: spec.formats,
    maxBytes: spec.maxBytes,
    ...(purpose === 'health_record' ? { type: 'authenticated' } : {}),
  };
});

// ── Businesses (the provider's own) ──
// As the API's CreateBusinessDto: other fields are dropped (whitelist).
const applyBusinessFields = (b: MockBusiness, body: Record<string, any>) => {
  for (const key of ['name', 'phone', 'city', 'addressLine'] as const) {
    if (typeof body[key] === 'string') b[key] = body[key].trim();
  }
  if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    b.lat = body.lat;
    b.lng = body.lng;
  }
  if (SUB_TYPES.includes(body.subType)) {
    b.subType = body.subType;
    b.serviceType = SERVICE_OF[b.subType];
  }
  if (b.subType !== 'doctor') b.pmdcNumber = null;
  else if (typeof body.pmdcNumber === 'string') b.pmdcNumber = body.pmdcNumber.trim().toUpperCase() || null;
  b.updatedAt = isoNow();
};

const EDITABLE: MockBusiness['status'][] = ['draft', 'rejected'];
const requireEditable = (b: MockBusiness) => {
  if (!EDITABLE.includes(b.status)) {
    throw new MockError(409, 'BUSINESS_NOT_EDITABLE', 'This application is with our team and can’t be changed right now.');
  }
};
const MULTI_KINDS: DocumentKind[] = ['kitchen_photo', 'shop_photo'];
const MAX_PER_MULTI_KIND = 4;
const allowedKinds = (subType: SubType): DocumentKind[] => [
  ...new Set(DOCUMENT_REQUIREMENTS[subType].flatMap(r => ('anyOf' in r ? r.anyOf : [r.kind]))),
];

route('POST', '/businesses', ctx => {
  const { user, business } = requirePartnerBusiness(ctx);
  if (business) throw new MockError(409, 'BUSINESS_EXISTS', 'You already have a business. Edit it instead.');
  const subType: SubType = SUB_TYPES.includes(ctx.body.subType) ? ctx.body.subType : user.providerSubType ?? 'store';
  const b: MockBusiness = {
    id: newId('b'),
    ownerId: user.id,
    serviceType: SERVICE_OF[subType],
    subType,
    name: '',
    phone: user.phone ?? '',
    city: '',
    addressLine: '',
    lat: null,
    lng: null,
    pmdcNumber: null,
    details: {},
    status: 'draft',
    documents: [],
    rejectionReason: null,
    suspensionReason: null,
    submittedAt: null,
    reviewedAt: null,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    autoApprove: true,
  };
  applyBusinessFields(b, ctx.body);
  if (!b.addressLine) throw invalid({ addressLine: 'addressLine should not be empty' });
  ctx.db.businesses.push(b);
  return publicBusiness(b);
});

// As the API: the onboarding routes stay readable while suspended (the
// partner sees their own status); only service routes answer 403.
route('GET', '/businesses/me', ctx => {
  const { business } = requirePartnerBusiness(ctx, true);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  return publicBusiness(business);
});

route('PATCH', '/businesses/me', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  requireEditable(business);
  applyBusinessFields(business, ctx.body);
  return publicBusiness(business);
});

/** As the API: answers the one document (DocumentView), not the business. */
route('POST', '/businesses/me/documents', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'Save your details first.');
  requireEditable(business);
  const kind = ctx.body.kind as DocumentKind;
  if (!allowedKinds(business.subType).includes(kind)) {
    throw invalid({ kind: `A ${business.subType.replace('_', ' ')} does not need a ${String(kind)}.` });
  }
  if (!ctx.body.url || !ctx.body.publicId) throw invalid({ url: 'url and publicId are required' });
  if (MULTI_KINDS.includes(kind)) {
    if (business.documents.filter(d => d.kind === kind).length >= MAX_PER_MULTI_KIND) {
      throw new MockError(400, 'VALIDATION_FAILED', `At most ${MAX_PER_MULTI_KIND} ${kind.replace('_', ' ')}s. Remove one first.`);
    }
  } else {
    business.documents = business.documents.filter(d => d.kind !== kind);
  }
  const doc = {
    id: newId('doc'),
    kind,
    url: String(ctx.body.url).trim(),
    publicId: String(ctx.body.publicId).trim(),
    status: 'pending' as const,
    reviewNote: null,
    createdAt: isoNow(),
  };
  business.documents.push(doc);
  business.updatedAt = isoNow();
  return doc;
});

route('DELETE', '/businesses/me/documents/:id', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  requireEditable(business);
  const id = decodeURIComponent(ctx.params[0]);
  if (!business.documents.some(d => d.id === id)) throw new MockError(404, 'NOT_FOUND', 'Document not found.');
  business.documents = business.documents.filter(d => d.id !== id);
  return { removed: true };
});

route('POST', '/businesses/me/submit', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'Save your details first.');
  if (!EDITABLE.includes(business.status)) {
    throw new MockError(409, 'INVALID_TRANSITION', `A ${business.status.replace('_', ' ')} application can’t be submitted.`);
  }
  const { missing, requirements } = evaluateDocuments(business.subType, business.documents);
  if (missing.length) {
    throw new MockError(422, 'DOCUMENTS_MISSING', 'Upload the required documents before submitting.', { missing, requirements });
  }
  if (business.subType === 'doctor' && !business.pmdcNumber) {
    throw invalid({ pmdcNumber: 'Add your PMDC registration number before submitting.' });
  }
  business.status = 'pending_approval';
  business.submittedAt = isoNow();
  business.rejectionReason = null;
  business.autoApprove = true;
  return publicBusiness(business);
});

route('GET', '/businesses/me/status', ctx => {
  const { business } = requirePartnerBusiness(ctx, true);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  return {
    status: business.status,
    rejectionReason: business.rejectionReason,
    suspensionReason: business.suspensionReason,
  };
});

// ── Food (customer discovery) ──
route('GET', '/food/home', ctx => {
  const user = requireUser(ctx);
  const city = String(ctx.query.city ?? user.city ?? 'Lahore');
  return {
    area: user.streetAddress ? `${user.streetAddress}, ${city}` : city,
    promos: MOCK_PROMOS,
    cuisines: MOCK_CUISINES,
    // Nearest first, as a delivery app lists them.
    kitchens: [...MOCK_KITCHENS].sort((a, b) => a.distanceKm - b.distanceKm),
  };
});

// ── Admin ──
// As the API's AdminBusinessQueryDto: page / pageSize / q → { items, total, page, pageSize }.
route('GET', '/admin/businesses', ctx => {
  requireAdmin(ctx);
  const status = ctx.query.status;
  const q = String(ctx.query.q ?? '').trim().toLowerCase();
  const page = Math.max(1, Number(ctx.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(ctx.query.pageSize) || 20));
  const ownerOf = (b: MockBusiness) => ctx.db.users.find(u => u.id === b.ownerId);
  const rows = ctx.db.businesses
    .map(b => settleApproval(b, ctx.now)!)
    .filter(b => !status || b.status === status)
    .filter(b => !ctx.query.serviceType || b.serviceType === ctx.query.serviceType)
    .filter(b => !q || [b.name, b.city, ownerOf(b)?.email ?? ''].some(v => v.toLowerCase().includes(q)))
    .sort((a, b) =>
      status === 'pending_approval'
        ? Date.parse(a.submittedAt ?? a.createdAt) - Date.parse(b.submittedAt ?? b.createdAt)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map(b => {
    const owner = ownerOf(b);
    return {
      ...omit(publicBusiness(b), ['documents', 'requiredDocuments', 'missingDocuments']),
      owner: owner ? { id: owner.id, email: owner.email, displayName: owner.name, phone: owner.phone } : null,
    };
  });
  return { items, total: rows.length, page, pageSize };
});

const adminBusiness = (ctx: Ctx) => {
  requireAdmin(ctx);
  const b = ctx.db.businesses.find(x => x.id === decodeURIComponent(ctx.params[0]));
  if (!b) throw new MockError(404, 'NOT_FOUND', 'That application no longer exists.');
  return settleApproval(b, ctx.now)!;
};

route('GET', '/admin/businesses/:id', ctx => {
  const b = adminBusiness(ctx);
  const owner = ctx.db.users.find(u => u.id === b.ownerId);
  return {
    ...publicBusiness(b),
    owner: owner ? { id: owner.id, displayName: owner.name, email: owner.email, phone: owner.phone } : null,
  };
});

route('POST', '/admin/businesses/:id/approve', ctx => {
  const b = adminBusiness(ctx);
  // TODO(API_HEALTH): a doctor is approved only after staff check the PMDC number.
  if (b.subType === 'doctor' && !b.pmdcVerified) {
    throw new MockError(422, 'PMDC_NOT_VERIFIED', "Check the doctor's PMDC registration first (Health → Doctor verification).");
  }
  b.status = 'approved';
  b.reviewedAt = isoNow();
  b.rejectionReason = null;
  b.documents.forEach(d => {
    d.status = 'accepted';
    d.reviewNote = null;
  });
  return publicBusiness(b);
});

route('POST', '/admin/businesses/:id/reject', ctx => {
  const b = adminBusiness(ctx);
  // As the API's RejectBusinessDto: documentNotes is [{ documentId, note }].
  const notes = new Map<string, string>();
  for (const n of Array.isArray(ctx.body.documentNotes) ? (ctx.body.documentNotes as unknown[]) : []) {
    const { documentId, note } = (n ?? {}) as { documentId?: unknown; note?: unknown };
    if (typeof documentId === 'string' && typeof note === 'string') notes.set(documentId, note);
  }
  b.status = 'rejected';
  b.reviewedAt = isoNow();
  b.rejectionReason = String(ctx.body.reason ?? '');
  b.autoApprove = false;
  b.documents.forEach(d => {
    const note = notes.get(d.id);
    if (note) {
      d.status = 'rejected';
      d.reviewNote = note;
    }
  });
  return publicBusiness(b);
});

route('POST', '/admin/businesses/:id/suspend', ctx => {
  const b = adminBusiness(ctx);
  b.status = 'suspended';
  b.suspensionReason = String(ctx.body.reason ?? '');
  return publicBusiness(b);
});

route('POST', '/admin/businesses/:id/reinstate', ctx => {
  const b = adminBusiness(ctx);
  if (String(ctx.body.reason ?? '').trim().length < 3) throw invalid({ reason: 'reason must be longer than or equal to 3 characters' });
  b.status = 'approved';
  b.suspensionReason = null;
  return publicBusiness(b);
});

// ── Shopping (customer, store partner, admin) — see ./shop/ ──
registerShopRoutes({
  route,
  requireUser,
  optionalUser: ctx => {
    const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
    if (!session || session.expiresAt < ctx.now) return null;
    return ctx.db.users.find(u => u.id === session.userId) ?? null;
  },
  requirePartnerBusiness: ctx => requirePartnerBusiness(ctx),
  requireAdmin,
});

// ── Healthcare (patients, doctors, admin) — see ./health/ ──
registerHealthRoutes({
  route,
  requireUser,
  optionalUser: ctx => {
    const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
    if (!session || session.expiresAt < ctx.now) return null;
    return ctx.db.users.find(u => u.id === session.userId) ?? null;
  },
  requirePartnerBusiness: ctx => requirePartnerBusiness(ctx),
  requireAdmin,
  publicBusiness,
});

// ─── The adapter ─────────────────────────────────────
const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: new AxiosHeaders({ 'content-type': 'application/json' }),
  config,
  request: { mock: true },
});

const pathOf = (config: InternalAxiosRequestConfig) => {
  let url = config.url ?? '';
  if (config.baseURL && url.startsWith(config.baseURL)) url = url.slice(config.baseURL.length);
  url = url.replace(/^https?:\/\/[^/]+(\/api\/v1)?/, '');
  return url.split('?')[0];
};

const parseBody = (data: unknown): Record<string, any> => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return typeof data === 'object' ? (data as Record<string, any>) : {};
};

const bearer = (config: InternalAxiosRequestConfig): string | null => {
  const header = config.headers?.Authorization ?? config.headers?.get?.('Authorization');
  const value = typeof header === 'string' ? header : null;
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
};

const headersOf = (config: InternalAxiosRequestConfig): Record<string, string> => {
  const h = config.headers as unknown as { toJSON?: () => Record<string, unknown> } | undefined;
  const raw = (typeof h?.toJSON === 'function' ? h.toJSON() : (h as Record<string, unknown>)) ?? {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k.toLowerCase(), v as string]));
};

export const mockAdapter: AxiosAdapter = async config => {
  await sleep(latency());
  const method = (config.method ?? 'get').toUpperCase();
  const path = pathOf(config);
  const db = await getDb();

  let status = 200;
  let payload: unknown;
  try {
    const match = routes
      .filter(([m]) => m === method)
      .map(([, re, handler]) => ({ handler, params: re.exec(path) }))
      .find(r => r.params);
    if (!match) throw new MockError(404, 'NOT_FOUND', `The dummy API has no route for ${method} ${path}.`);
    const result = await match.handler({
      db,
      body: parseBody(config.data),
      query: config.params ?? {},
      params: match.params!.slice(1),
      token: bearer(config),
      now: Date.now(),
      headers: headersOf(config),
      setStatus: s => {
        status = s;
      },
    });
    payload = { data: result };
    if (method === 'POST' && /^\/(auth\/signup|businesses)$/.test(path)) status = 201;
  } catch (e) {
    const err = e instanceof ShopError ? e : new MockError(500, 'MOCK_ERROR', (e as Error).message);
    status = err.status;
    payload = { error: { code: err.code, message: err.message, details: err.details ?? null } };
  }
  await saveDb();

  const response = respond(config, status, payload);
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(
    (payload as { error: { message: string } }).error.message,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    response.request,
    response,
  );
};
