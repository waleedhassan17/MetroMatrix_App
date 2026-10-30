// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy API server (an axios adapter), tests only
// ═══════════════════════════════════════════════════════
// The app always talks to the real API (src/config/env.ts). This adapter is
// test fixtures: the Shopping, Health, Food and Kitchen routes, answering as
// their documents say the real backend does:
//   success  { success: true, data: <payload> }       2xx
//   failure  { success: false, error: { code, message, details } }  4xx
// so the parity and flow tests run the app's networks and serializers
// against it (mock/testing.ts installs it). It has no auth, users, media,
// business, approval or platform routes: those are the real API's, and a
// test signs in with mockSessionFor instead. Rules a test relies on (codes,
// delays, seeded accounts) are in ./mockConfig.ts and ./mockDb.ts.

import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { evaluateDocuments } from '../../../models/businessModel';
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
  const { requirements, missing } = evaluateDocuments(b.subType, b.documents);
  return { ...omit(b, ['autoApprove']), requiredDocuments: requirements, missingDocuments: missing };
};

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

const revokeSessions = (db: MockDb, userId: string) => {
  for (const [t, s] of Object.entries(db.access)) if (s.userId === userId) delete db.access[t];
  for (const [t, id] of Object.entries(db.refresh)) if (id === userId) delete db.refresh[t];
};

// ─── Routes ──────────────────────────────────────────
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: string, handler: Handler) => {
  const re = new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, '([^/]+)')}$`);
  routes.push([method, re, handler]);
};

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
    payload = { success: true, data: result };
  } catch (e) {
    const err = e instanceof ShopError ? e : new MockError(500, 'MOCK_ERROR', (e as Error).message);
    status = err.status;
    payload = { success: false, error: { code: err.code, message: err.message, details: err.details ?? null } };
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

// ─── Tests only: a session without a sign-in route ───
/**
 * A session for a seeded account (its email, or a rider's username), written
 * straight into the dummy DB, with the pair a sign-in would return. The app
 * signs in on the real API; tests use mock/testing.ts's signInAs.
 */
export const mockSessionFor = async (who: string) => {
  const db = await getDb();
  const key = who.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === key || u.username?.toLowerCase() === key);
  if (!user) throw new Error(`The dummy DB has no account ${who}.`);
  const tokens = issueSession(db, user);
  // Tests move the clock by days, and there is no refresh route here (expiry
  // and refresh are the real API's): a test session doesn't expire.
  db.access[tokens.accessToken].expiresAt = Number.MAX_SAFE_INTEGER;
  await saveDb();
  return { ...sessionPayload(db, user, Date.now()), tokens };
};

/** What GET /auth/me would answer for a dummy token: { user, business }. */
export const mockSessionOf = async (token: string | null) => {
  const db = await getDb();
  const session = token ? db.access[token] : undefined;
  const user = session ? db.users.find(u => u.id === session.userId) : undefined;
  if (!user) throw new Error('No dummy session for this token.');
  return sessionPayload(db, user, Date.now());
};
