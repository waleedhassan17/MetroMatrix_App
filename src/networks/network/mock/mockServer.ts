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
import { REQUIRED_DOCUMENTS, missingDocuments } from '../../../models/businessModel';
import type { DocumentKind, ServiceType, SubType } from '../../../types/auth';
import { MOCK } from './mockConfig';
import { getDb, newId, saveDb, type MockBusiness, type MockDb, type MockUser } from './mockDb';
import { ShopError } from './shop/shopLogic';
import { registerShopRoutes } from './shop/shopRoutes';
import { registerHealthRoutes } from './health/healthRoutes';
import { registerFoodRoutes } from './food/foodRoutes';
import { foodSessionOf } from './food/foodLogic';
import { registerKitchen } from './kitchen/kitchenIndex';

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

const publicBusiness = (b: MockBusiness) => {
  const rest = omit(b, ['autoApprove']);
  return {
    ...rest,
    requiredDocuments: REQUIRED_DOCUMENTS[b.subType],
    missingDocuments: missingDocuments(b.subType, b.documents),
  };
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
  db.access[accessToken] = { userId: user.id, expiresAt: Date.now() + MOCK.ACCESS_TTL_MS };
  db.refresh[refreshToken] = user.id;
  return { accessToken, refreshToken };
};

// A food vendor's session also says which brand it is and whether it is live (`business.food`).
const sessionPayload = (db: MockDb, user: MockUser, now: number) => ({
  user: publicUser(user),
  business: user.role === 'partner' ? (() => {
    const b = settleApproval(businessOf(db, user.id), now);
    if (!b) return null;
    const food = foodSessionOf(db, b, now);
    return food ? { ...publicBusiness(b), food } : publicBusiness(b);
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

const passwordOk = (p: unknown) =>
  typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

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
route('POST', '/auth/signup', ({ db, body, now }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !body.name || !passwordOk(body.password)) {
    throw new MockError(400, 'VALIDATION', 'Check your details and try again.');
  }
  if (findUserByEmail(db, email)) {
    throw new MockError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.');
  }
  const partner = body.portal === 'partner';
  const subType: SubType | null = partner && SUB_TYPES.includes(body.subType) ? body.subType : null;
  const user: MockUser = {
    id: newId('u'),
    email,
    name: String(body.name).trim(),
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
    providerServiceType: subType ? SERVICE_OF[subType] : null,
    providerSubType: subType,
    password: body.password,
    verificationSentAt: now,
    totpEnrolled: false,
    recoveryCodes: [],
  };
  db.users.push(user);
  return authResult(db, user, now);
});

route('POST', '/auth/signin', ({ db, body, now }) => {
  // `identifier`: an email, or a rider's username (no "@"); `email` as before.
  const identifier = String(body.identifier ?? body.email ?? '').trim().toLowerCase();
  const byUsername = !!identifier && !identifier.includes('@');
  const user = byUsername ? db.users.find(u => u.username === identifier) : findUserByEmail(db, identifier);
  if (!user || !user.password || user.password !== body.password) {
    throw new MockError(401, 'INVALID_CREDENTIALS', byUsername ? 'Incorrect username or password.' : 'Incorrect email or password.');
  }
  // As the API does: the password first, then the portal. A wrong door is
  // 403 WRONG_PORTAL naming the account type and the portal that was tried
  // (the app sends staff on to the admin portal itself).
  const staff = user.role === 'admin' || user.role === 'super_admin';
  // Riders use the partner side, with their username.
  const door = staff ? 'admin' : user.role === 'partner' || user.role === 'rider' ? 'partner' : 'customer';
  if (body.portal !== door) {
    const message =
      door === 'admin'
        ? 'This is an admin account. Sign in on the MetroMatrix admin console.'
        : user.role === 'rider'
          ? 'This is a rider account. Riders sign in on the partner side of the MetroMatrix app with their username.'
          : door === 'partner'
            ? 'This is a service provider account. Sign in as a Service Provider.'
            : 'This is a customer account. Sign in as a User.';
    throw new MockError(403, 'WRONG_PORTAL', message, { accountType: user.role, portal: body.portal ?? null });
  }
  if (staff) {
    const challengeToken = `mock-challenge-${newId('c')}`;
    db.challenges[challengeToken] = { userId: user.id, expiresAt: now + 5 * 60 * 1000 };
    return { totpRequired: true, enrolmentRequired: !user.totpEnrolled, challengeToken };
  }
  return authResult(db, user, now);
});

const challengeUser = (db: MockDb, token: unknown, now: number) => {
  const challenge = db.challenges[String(token)];
  if (!challenge || challenge.expiresAt < now) {
    throw new MockError(401, 'CHALLENGE_EXPIRED', 'Your sign-in timed out. Sign in again.');
  }
  const user = db.users.find(u => u.id === challenge.userId);
  if (!user) throw new MockError(401, 'CHALLENGE_EXPIRED', 'Your sign-in timed out. Sign in again.');
  return user;
};

route('POST', '/auth/admin/totp', ({ db, body, now }) => {
  const user = challengeUser(db, body.challengeToken, now);
  if (body.recoveryCode) {
    const code = String(body.recoveryCode).trim().toUpperCase();
    const i = user.recoveryCodes.indexOf(code);
    if (i === -1) throw new MockError(401, 'RECOVERY_CODE_USED', 'That recovery code is not valid or was already used.');
    user.recoveryCodes.splice(i, 1);
  } else if (body.code !== MOCK.TOTP_CODE) {
    throw new MockError(401, 'TOTP_INVALID', "That code didn't work. Check your authenticator and try again.");
  }
  delete db.challenges[String(body.challengeToken)];
  return authResult(db, user, now);
});

route('POST', '/auth/admin/totp/enrol', ({ db, body, now }) => {
  const user = challengeUser(db, body.challengeToken, now);
  return {
    secret: MOCK.TOTP_SECRET,
    otpauthUrl: `otpauth://totp/MetroMatrix:${encodeURIComponent(user.email)}?secret=${MOCK.TOTP_SECRET}&issuer=MetroMatrix`,
  };
});

route('POST', '/auth/admin/totp/confirm', ({ db, body, now }) => {
  const user = challengeUser(db, body.challengeToken, now);
  if (body.code !== MOCK.TOTP_CODE) {
    throw new MockError(401, 'TOTP_INVALID', "That code didn't match. Check your phone's time and try again.");
  }
  user.totpEnrolled = true;
  user.recoveryCodes = Array.from({ length: 8 }, () =>
    `MM${Math.random().toString(36).slice(2, 4)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
  );
  delete db.challenges[String(body.challengeToken)];
  return { ...authResult(db, user, now), recoveryCodes: user.recoveryCodes };
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

route('GET', '/auth/verification-status', ctx => {
  const user = requireUser(ctx);
  // The dummy inbox: the link counts as opened a few seconds after it is sent.
  if (!user.isEmailVerified && ctx.now - user.verificationSentAt >= MOCK.EMAIL_LINK_SECONDS * 1000) {
    user.isEmailVerified = true;
  }
  return { isEmailVerified: user.isEmailVerified };
});

route('POST', '/auth/verify-email', ({ db, body }) => {
  // The deep-link token: metromatrix://verify-success?token=mock-verify-<userId>
  const userId = String(body.token ?? '').replace(/^mock-verify-/, '');
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new MockError(400, 'VERIFY_TOKEN_INVALID', 'This verification link is invalid or has expired.');
  user.isEmailVerified = true;
  return { user: publicUser(user) };
});

route('POST', '/auth/resend-verification', ctx => {
  const user = requireUser(ctx);
  const wait = Math.ceil((user.verificationSentAt + MOCK.RESEND_SECONDS * 1000 - ctx.now) / 1000);
  if (wait > 0) throw new MockError(429, 'RESEND_TOO_SOON', `Wait ${wait}s before resending.`, { retryAfter: wait });
  user.verificationSentAt = ctx.now;
  return { retryAfter: MOCK.RESEND_SECONDS };
});

route('POST', '/auth/refresh', ({ db, body }) => {
  const userId = db.refresh[String(body.refreshToken ?? '')];
  const user = userId ? db.users.find(u => u.id === userId) : undefined;
  if (!user) throw new MockError(401, 'REFRESH_INVALID', 'Please sign in again.');
  delete db.refresh[String(body.refreshToken)];
  return issueSession(db, user);
});

route('POST', '/auth/logout', ctx => {
  if (ctx.token) delete ctx.db.access[ctx.token];
  if (ctx.body.refreshToken) delete ctx.db.refresh[String(ctx.body.refreshToken)];
  return { ok: true };
});

route('GET', '/auth/me', ctx => sessionPayload(ctx.db, requireUser(ctx), ctx.now));

route('POST', '/auth/forgot-password', ({ db, body, now }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  const existing = db.resets[email];
  if (existing) {
    const wait = Math.ceil((existing.sentAt + MOCK.RESEND_SECONDS * 1000 - now) / 1000);
    if (wait > 0) throw new MockError(429, 'RESEND_TOO_SOON', `Wait ${wait}s before requesting another code.`, { retryAfter: wait });
  }
  // Always 200, so the endpoint never reveals whether an account exists.
  if (findUserByEmail(db, email)) {
    db.resets[email] = { code: MOCK.RESET_OTP, attemptsLeft: MOCK.OTP_ATTEMPTS, sentAt: now, resetToken: null };
  }
  return { retryAfter: MOCK.RESEND_SECONDS };
});

route('POST', '/auth/verify-reset-otp', ({ db, body }) => {
  const email = String(body.email ?? '').trim().toLowerCase();
  const reset = db.resets[email];
  if (!reset) throw new MockError(400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
  if (body.code !== reset.code) {
    reset.attemptsLeft -= 1;
    if (reset.attemptsLeft <= 0) {
      delete db.resets[email];
      throw new MockError(429, 'OTP_LOCKED', 'Too many wrong codes. Request a new one.', { attemptsLeft: 0 });
    }
    throw new MockError(400, 'INVALID_OTP', "That code isn't right.", { attemptsLeft: reset.attemptsLeft });
  }
  reset.resetToken = `mock-reset-${newId('r')}`;
  return { resetToken: reset.resetToken };
});

route('POST', '/auth/reset-password', ({ db, body }) => {
  const entry = Object.entries(db.resets).find(([, r]) => r.resetToken && r.resetToken === body.resetToken);
  if (!entry) throw new MockError(400, 'RESET_TOKEN_INVALID', 'This reset has expired. Start again.');
  if (!passwordOk(body.password)) throw new MockError(400, 'VALIDATION', 'Use 8+ characters with a letter and a number.');
  const user = findUserByEmail(db, entry[0]);
  if (user) {
    user.password = body.password;
    user.hasPassword = true;
    revokeSessions(db, user.id);
  }
  delete db.resets[entry[0]];
  return { ok: true };
});

route('POST', '/auth/change-password', ctx => {
  const user = requireUser(ctx);
  if (user.hasPassword && user.password !== ctx.body.currentPassword) {
    throw new MockError(401, 'INVALID_CREDENTIALS', 'Your current password is not correct.');
  }
  if (!passwordOk(ctx.body.newPassword)) throw new MockError(400, 'VALIDATION', 'Use 8+ characters with a letter and a number.');
  user.password = ctx.body.newPassword;
  user.hasPassword = true;
  if (!user.providers.includes('password')) user.providers.push('password');
  return { user: publicUser(user) };
});

route('DELETE', '/auth/account', ctx => {
  const user = requireUser(ctx);
  const ok = user.hasPassword ? ctx.body.password === user.password : ctx.body.confirm === 'DELETE';
  if (!ok) throw new MockError(401, 'INVALID_CREDENTIALS', 'That password is not correct.');
  revokeSessions(ctx.db, user.id);
  ctx.db.users = ctx.db.users.filter(u => u.id !== user.id);
  ctx.db.businesses = ctx.db.businesses.filter(b => b.ownerId !== user.id);
  return { ok: true };
});

// ── Users ──
route('PATCH', '/users/me', ctx => {
  const user = requireUser(ctx);
  if (typeof ctx.body.name === 'string') user.name = ctx.body.name.trim();
  if (ctx.body.phone !== undefined) user.phone = ctx.body.phone;
  if (ctx.body.avatarUrl !== undefined) user.avatarUrl = ctx.body.avatarUrl;
  return { user: publicUser(user) };
});

route('PATCH', '/users/me/profile', ctx => {
  const user = requireUser(ctx);
  const b = ctx.body;
  if (!b.dateOfBirth || !b.gender || !b.streetAddress || !b.city) {
    throw new MockError(400, 'VALIDATION', 'Complete every required field.');
  }
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

route('POST', '/users/me/devices', ctx => {
  const user = requireUser(ctx);
  ctx.db.devices = ctx.db.devices.filter(d => d.token !== ctx.body.token);
  ctx.db.devices.push({ userId: user.id, token: String(ctx.body.token) });
  return { ok: true };
});

route('DELETE', '/users/me/devices/:token', ctx => {
  ctx.db.devices = ctx.db.devices.filter(d => d.token !== decodeURIComponent(ctx.params[0]));
  return { ok: true };
});

// ── Media ──
// The API's upload purposes (MetroMatrix-API UPLOAD_PURPOSES); PHI ones are private.
const UPLOAD_PURPOSES = [
  'avatar',
  'business_document',
  'product_image',
  'store_branding',
  'review_photo',
  'return_photo',
  'payment_proof',
  'banner',
  'doctor_photo',
  'health_record',
  'medical_note',
  'food_branding',
  'menu_item',
  // Kitchen Intelligence (docs/API_KITCHEN_ASSUMED.md §1.4, docs/VOICE_ASSUMED.md §2).
  'voice_clip',
  'kitchen_receipt',
  'food_packing',
  'food_surplus',
  'food_story',
  'hygiene_evidence',
];
const PRIVATE_PURPOSES = ['health_record', 'medical_note'];
/** What each purpose may upload (images and PDFs unless named). */
const PURPOSE_FORMATS: Record<string, string> = {
  voice_clip: 'm4a,aac,mp4,webm,ogg,wav,mp3',
  food_story: 'jpg,jpeg,png,webp,heic,mp4,mov',
};

route('POST', '/media/sign-upload', ctx => {
  const user = requireUser(ctx);
  const purpose = String(ctx.body.purpose ?? '');
  if (!UPLOAD_PURPOSES.includes(purpose)) throw new MockError(400, 'VALIDATION_FAILED', 'Unknown upload purpose.', { fields: { purpose: ['unknown purpose'] } });
  const folder = `metromatrix/development/${user.id}/${purpose}`;
  return {
    cloudName: 'mock',
    apiKey: 'mock',
    timestamp: Math.floor(ctx.now / 1000),
    signature: 'mock-signature',
    folder,
    publicIdPrefix: `${folder}/`,
    uploadUrl: 'mock://upload',
    allowedFormats: PURPOSE_FORMATS[purpose] ?? 'jpg,jpeg,png,webp,heic,pdf',
    maxBytes: 15_000_000,
    ...(PRIVATE_PURPOSES.includes(purpose) ? { type: 'authenticated' } : {}),
  };
});

// ── Businesses (the provider's own) ──
const applyBusinessFields = (b: MockBusiness, body: Record<string, any>) => {
  for (const key of ['name', 'phone', 'city', 'address'] as const) {
    if (typeof body[key] === 'string') b[key] = body[key];
  }
  if (body.location !== undefined) b.location = body.location;
  if (body.details && typeof body.details === 'object') b.details = { ...body.details };
  if (SUB_TYPES.includes(body.subType)) {
    b.subType = body.subType;
    b.serviceType = SERVICE_OF[b.subType];
  }
  b.updatedAt = isoNow();
};

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
    address: '',
    location: null,
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
  ctx.db.businesses.push(b);
  return publicBusiness(b);
});

route('GET', '/businesses/me', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  return publicBusiness(business);
});

route('PATCH', '/businesses/me', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  applyBusinessFields(business, ctx.body);
  return publicBusiness(business);
});

route('POST', '/businesses/me/documents', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'Save your details first.');
  const kind = ctx.body.kind as DocumentKind;
  business.documents = business.documents.filter(d => d.kind !== kind);
  business.documents.push({
    id: newId('doc'),
    kind,
    url: String(ctx.body.url),
    publicId: String(ctx.body.publicId ?? ''),
    mimeType: String(ctx.body.mimeType ?? 'image/jpeg'),
    status: 'pending',
    reviewerNote: null,
    uploadedAt: isoNow(),
  });
  business.updatedAt = isoNow();
  return publicBusiness(business);
});

route('DELETE', '/businesses/me/documents/:id', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'No business yet.');
  business.documents = business.documents.filter(d => d.id !== decodeURIComponent(ctx.params[0]));
  return publicBusiness(business);
});

route('POST', '/businesses/me/submit', ctx => {
  const { business } = requirePartnerBusiness(ctx);
  if (!business) throw new MockError(404, 'NOT_FOUND', 'Save your details first.');
  const missing = missingDocuments(business.subType, business.documents);
  if (missing.length) {
    throw new MockError(422, 'DOCUMENTS_MISSING', 'Some required documents are missing.', { missing });
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
    documents: business.documents.map(d => ({ id: d.id, kind: d.kind, status: d.status, reviewerNote: d.reviewerNote })),
  };
});

// ── Admin ──
const PAGE = 20;
route('GET', '/admin/businesses', ctx => {
  requireAdmin(ctx);
  const status = ctx.query.status ?? 'pending_approval';
  const rows = ctx.db.businesses
    .map(b => settleApproval(b, ctx.now)!)
    .filter(b => b.status === status && (!ctx.query.serviceType || b.serviceType === ctx.query.serviceType))
    .sort((a, b) => Date.parse(a.submittedAt ?? a.createdAt) - Date.parse(b.submittedAt ?? b.createdAt));
  const start = Number(ctx.query.cursor ?? 0) || 0;
  const items = rows.slice(start, start + PAGE).map(b => {
    const owner = ctx.db.users.find(u => u.id === b.ownerId);
    return {
      id: b.id,
      name: b.name,
      serviceType: b.serviceType,
      subType: b.subType,
      city: b.city,
      status: b.status,
      submittedAt: b.submittedAt,
      owner: { name: owner?.name ?? '', email: owner?.email ?? '' },
    };
  });
  return { items, nextCursor: start + PAGE < rows.length ? String(start + PAGE) : null };
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
    owner: { id: owner?.id ?? '', name: owner?.name ?? '', email: owner?.email ?? '', phone: owner?.phone ?? null },
  };
});

route('POST', '/admin/businesses/:id/approve', ctx => {
  const b = adminBusiness(ctx);
  // A doctor is approved only after staff check the PMDC number (API_HEALTH.md: 422 PMDC_NOT_VERIFIED).
  if (b.subType === 'doctor' && !b.pmdcVerified) {
    throw new MockError(422, 'PMDC_NOT_VERIFIED', "Check the doctor's PMDC registration first (Health → Doctor verification).");
  }
  b.status = 'approved';
  b.reviewedAt = isoNow();
  b.rejectionReason = null;
  b.documents.forEach(d => {
    d.status = 'accepted';
    d.reviewerNote = null;
  });
  return publicBusiness(b);
});

route('POST', '/admin/businesses/:id/reject', ctx => {
  const b = adminBusiness(ctx);
  const notes = (ctx.body.documentNotes ?? {}) as Record<string, string>;
  b.status = 'rejected';
  b.reviewedAt = isoNow();
  b.rejectionReason = String(ctx.body.reason ?? '');
  b.autoApprove = false;
  b.documents.forEach(d => {
    if (notes[d.id]) {
      d.status = 'rejected';
      d.reviewerNote = notes[d.id];
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

// ── Food Court (vendors, riders, admin) — see ./food/ ──
const foodKit = registerFoodRoutes({
  route,
  requireUser,
  optionalUser: ctx => {
    const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
    if (!session || session.expiresAt < ctx.now) return null;
    return ctx.db.users.find(u => u.id === session.userId) ?? null;
  },
  requirePartnerBusiness: ctx => requirePartnerBusiness(ctx),
  requireAdmin,
  revokeSessions,
});

// ── Kitchen Intelligence (assumed contract, Chunk 5) — see ./kitchen/ ──
registerKitchen(foodKit, {
  requireUser,
  optionalUser: ctx => {
    const session = ctx.token ? ctx.db.access[ctx.token] : undefined;
    if (!session || session.expiresAt < ctx.now) return null;
    return ctx.db.users.find(u => u.id === session.userId) ?? null;
  },
  requireAdmin,
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
      // As on the wire: a query string in the URL, then axios params on top.
      query: { ...Object.fromEntries(new URLSearchParams((config.url ?? '').split('?')[1] ?? '')), ...(config.params ?? {}) },
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

/**
 * Walk tooling, development builds only. The dummy database lives in each
 * browser, so a web walk stands in for "another phone" here: a second
 * customer reserving the last Bachat Box, or an order arriving on the
 * board that is open in this page — sent as an ordinary request with that
 * person's own token. Never in a release.
 */
if (__DEV__) {
  (globalThis as { __MM_MOCK_DB__?: unknown }).__MM_MOCK_DB__ = {
    get: getDb,
    save: saveDb,
    request: async (method: string, url: string, body?: unknown, token?: string | null, headers: Record<string, string> = {}) => {
      const config = {
        method,
        url,
        data: body === undefined ? undefined : JSON.stringify(body),
        headers: new AxiosHeaders({ ...headers, ...(token ? { Authorization: `Bearer ${token}` } : null) }),
      } as unknown as InternalAxiosRequestConfig;
      try {
        return { status: 200, body: (await mockAdapter(config)).data };
      } catch (e) {
        const r = (e as AxiosError).response;
        return { status: r?.status ?? 0, body: r?.data ?? null };
      }
    },
  };
}
