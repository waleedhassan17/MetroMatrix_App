// The App ↔ API contract. Every auth, users, media, business and admin
// network function runs against a capturing axios adapter (mock off, a real
// base URL), and each request it sends must exist in the API's OpenAPI
// document (docs/openapi.json, exported from MetroMatrix_Backend's
// /api/docs-json): the method and path template, every body field, and
// every required field. Regenerate docs/openapi.json when the API changes.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

jest.mock('../../config/env', () => ({
  ...jest.requireActual('../../config/env'),
  API_BASE_URL: 'https://api.test/api/v1',
  CONFIG_ERROR: false,
}));

import spec from '../../docs/openapi.json';
import { api, refreshClient, refreshTokens } from '../network/apiHelpers';
import { setTokens } from '../../utils/storageUtils';
import * as auth from '../auth/authNetwork';
import * as users from '../users/usersNetwork';
import * as media from '../media/mediaNetwork';
import * as businesses from '../businesses/businessNetwork';
import * as admin from '../admin/adminBusinessNetwork';

type Schema = { type?: string; properties?: Record<string, unknown>; required?: string[]; $ref?: string };
type Operation = { requestBody?: { content?: Record<string, { schema?: Schema }> } };
const openapi = spec as unknown as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
};

interface Captured {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown> | undefined;
  authorization: string | undefined;
}

let sent: Captured[] = [];

const capture = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const url = new URL(config.url ?? '', `${config.baseURL ?? 'https://api.test/api/v1'}/`.replace(/\/+$/, '/'));
  const raw = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  sent.push({
    method: (config.method ?? 'get').toUpperCase(),
    path: new URL(`${config.baseURL}${config.url}`).pathname || url.pathname,
    query: { ...(config.params ?? {}) },
    body: raw ?? undefined,
    authorization: config.headers?.Authorization as string | undefined,
  });
  // An empty success: callers that need more fail on reading it, after the request is captured.
  return Promise.resolve({ data: { success: true, data: {} }, status: 200, statusText: 'OK', headers: {}, config });
};

beforeAll(() => {
  api.defaults.adapter = capture as never;
  refreshClient.defaults.adapter = capture as never;
});

beforeEach(async () => {
  sent = [];
  await setTokens('access-1', 'refresh-1');
});

/** Runs a network call and returns what it sent; a failure on reading the empty reply is expected. */
const run = async (call: () => Promise<unknown>): Promise<Captured[]> => {
  await call().catch(() => undefined);
  return sent;
};

// ─── Matching against the OpenAPI document ──────────
const templates = Object.keys(openapi.paths).map(template => ({
  template,
  pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
}));

const operationFor = (method: string, path: string) => {
  const match = templates.find(t => t.pattern.test(path) && openapi.paths[t.template][method.toLowerCase()]);
  return match ? { template: match.template, op: openapi.paths[match.template][method.toLowerCase()] } : null;
};

const bodySchema = (op: Operation): Schema | null => {
  const s = op.requestBody?.content?.['application/json']?.schema;
  if (!s) return null;
  return s.$ref ? openapi.components.schemas[s.$ref.split('/').pop()!] : s;
};

/** Problems with one captured request, as readable strings (empty = matches the contract). */
const problems = (req: Captured): string[] => {
  const found = operationFor(req.method, req.path);
  if (!found) return [`${req.method} ${req.path} is not in openapi.json`];
  const schema = bodySchema(found.op);
  const out: string[] = [];
  const body = req.body ?? {};
  if (!schema) {
    if (Object.keys(body).length) out.push(`${req.method} ${found.template} takes no body, got ${Object.keys(body).join(', ')}`);
    return out;
  }
  const allowed = new Set(Object.keys(schema.properties ?? {}));
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) out.push(`${req.method} ${found.template}: "${field}" is not in ${found.op.requestBody ? 'the body schema' : 'openapi'}`);
  }
  for (const field of schema.required ?? []) {
    if (!(field in body)) out.push(`${req.method} ${found.template}: required "${field}" is missing`);
  }
  return out;
};

const expectContract = (reqs: Captured[], expected: string[]) => {
  expect(reqs.map(r => `${r.method} ${operationFor(r.method, r.path)?.template ?? r.path}`)).toEqual(
    expected.map(e => e.replace(' /', ' /api/v1/')),
  );
  expect(reqs.flatMap(problems)).toEqual([]);
};

// ─── Every function, every body variant ─────────────
const CASES: [string, () => Promise<unknown>, string[]][] = [
  ['authSignup (customer)', () => auth.authSignup({ name: 'Ayesha Khan', email: 'a@x.com', phone: '+923124890176', password: 'Metro2026', portal: 'customer' }), ['POST /auth/signup']],
  ['authSignup (partner, no phone)', () => auth.authSignup({ name: 'Ayesha Khan', email: 'a@x.com', phone: '', password: 'Metro2026', portal: 'partner' }), ['POST /auth/signup']],
  ['authSignin', () => auth.authSignin({ email: 'a@x.com', password: 'Metro2026', portal: 'partner' }), ['POST /auth/signin']],
  ['authAdminTotp (code)', () => auth.authAdminTotp('challenge', { code: '123456' }), ['POST /auth/admin/totp']],
  ['authAdminTotp (recovery code)', () => auth.authAdminTotp('challenge', { recoveryCode: 'MM7K-Q2PX' }), ['POST /auth/admin/totp']],
  ['authGoogle', () => auth.authGoogle('google-id-token'), ['POST /auth/google']],
  ['refreshTokens', () => refreshTokens(), ['POST /auth/refresh-token']],
  ['authLogout', () => auth.authLogout('access-1'), ['POST /auth/logout']],
  ['authVerifyEmail', () => auth.authVerifyEmail('link-token'), ['POST /auth/verify-email']],
  ['authResendVerification', () => auth.authResendVerification(), ['POST /auth/resend-verification']],
  ['authForgotPassword', () => auth.authForgotPassword('a@x.com'), ['POST /auth/forgot-password']],
  ['authVerifyResetOtp', () => auth.authVerifyResetOtp('a@x.com', '123456'), ['POST /auth/verify-otp']],
  ['authResetPassword', () => auth.authResetPassword('reset-token', 'Newpass2026'), ['POST /auth/reset-password']],
  ['authChangePassword (password)', () => auth.authChangePassword({ currentPassword: 'Metro2026', newPassword: 'Newpass2026' }), ['POST /auth/change-password']],
  ['authChangePassword (Google-only)', () => auth.authChangePassword({ idToken: 'google-id-token', newPassword: 'Newpass2026' }), ['POST /auth/change-password']],
  ['authDeleteAccount (password)', () => auth.authDeleteAccount({ password: 'Metro2026' }), ['DELETE /auth/account']],
  ['authDeleteAccount (Google)', () => auth.authDeleteAccount({ idToken: 'google-id-token' }), ['DELETE /auth/account']],
  ['authMe', () => auth.authMe(), ['GET /auth/me']],
  ['updateMeAPI', () => users.updateMeAPI({ displayName: 'Ayesha Khan', phone: '+923124890176' }), ['PATCH /users/me']],
  ['completeProfileAPI', () => users.completeProfileAPI({ dateOfBirth: '1998-02-14', gender: 'female', streetAddress: '7 Canal View', city: 'Lahore', postalCode: '54000' }), ['PATCH /users/me/profile']],
  ['registerDeviceAPI', () => users.registerDeviceAPI('ExponentPushToken[x]', 'android'), ['PUT /users/me/devices']],
  ['unregisterDeviceAPI', () => users.unregisterDeviceAPI('ExponentPushToken[x]', 'access-1'), ['DELETE /users/me/devices/{token}']],
  ['signUploadAPI', () => media.signUploadAPI('business_document'), ['POST /media/sign-upload']],
  ['createBusinessAPI (doctor, with pin)', () => businesses.createBusinessAPI({ serviceType: 'healthcare', subType: 'doctor', name: 'Clinic', phone: '+923124890176', city: 'Lahore', addressLine: '12 Main Boulevard', lat: 31.52, lng: 74.35, pmdcNumber: '12345-P' }), ['POST /businesses']],
  ['getMyBusinessAPI', () => businesses.getMyBusinessAPI(), ['GET /businesses/me']],
  ['updateMyBusinessAPI', () => businesses.updateMyBusinessAPI({ name: 'Clinic 2', addressLine: '14 Main Boulevard' }), ['PATCH /businesses/me']],
  ['addDocumentAPI', () => businesses.addDocumentAPI({ kind: 'cnic_front', url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'x/a' }), ['POST /businesses/me/documents']],
  ['removeDocumentAPI', () => businesses.removeDocumentAPI('doc-1'), ['DELETE /businesses/me/documents/{id}']],
  ['submitBusinessAPI', () => businesses.submitBusinessAPI(), ['POST /businesses/me/submit']],
  ['getMyBusinessStatusAPI', () => businesses.getMyBusinessStatusAPI(), ['GET /businesses/me/status']],
  ['getBusinessesAPI', () => admin.getBusinessesAPI({ status: 'pending_approval', serviceType: 'food', q: 'karahi', page: 2, pageSize: 20 }), ['GET /admin/businesses']],
  ['getBusinessAPI', () => admin.getBusinessAPI('b1'), ['GET /admin/businesses/{id}']],
  ['approveBusinessAPI', () => admin.approveBusinessAPI('b1'), ['POST /admin/businesses/{id}/approve']],
  ['rejectBusinessAPI', () => admin.rejectBusinessAPI('b1', { reason: 'The CNIC photo is too blurry.', documentNotes: [{ documentId: 'd1', note: 'Retake it' }] }), ['POST /admin/businesses/{id}/reject']],
  ['suspendBusinessAPI', () => admin.suspendBusinessAPI('b1', 'Repeated complaints.'), ['POST /admin/businesses/{id}/suspend']],
  ['reinstateBusinessAPI', () => admin.reinstateBusinessAPI('b1', 'The licence was renewed.'), ['POST /admin/businesses/{id}/reinstate']],
  ['adminTotpEnrol', () => auth.adminTotpEnrol('challenge'), ['POST /admin/me/totp/enrol']],
  ['adminTotpConfirm', () => auth.adminTotpConfirm('challenge', '123456'), ['POST /admin/me/totp/confirm']],
];

describe('App ↔ API contract (docs/openapi.json)', () => {
  it.each(CASES)('%s', async (_name, call, expected) => {
    expectContract(await run(call), expected);
  });

  it('the admin list sends the API’s query (page / pageSize / q), not a cursor', async () => {
    const [req] = await run(() => admin.getBusinessesAPI({ status: 'approved', q: 'karahi', page: 3, pageSize: 20 }));
    expect(req.query).toEqual({ status: 'approved', q: 'karahi', page: 3, pageSize: 20 });
  });

  it('logout and the admin TOTP enrolment send no body; the TOTP calls carry the challenge as the bearer', async () => {
    const [logout] = await run(() => auth.authLogout('access-1'));
    expect(logout.body).toBeUndefined();
    expect(logout.authorization).toBe('Bearer access-1');
    sent = [];
    const [enrol] = await run(() => auth.adminTotpEnrol('challenge-xyz'));
    expect(enrol.body).toBeUndefined();
    expect(enrol.authorization).toBe('Bearer challenge-xyz');
  });

  it('covers every in-scope operation in openapi.json that the App is meant to call', async () => {
    const called = new Set<string>();
    for (const [, call] of CASES) {
      sent = [];
      for (const r of await run(call)) called.add(`${r.method} ${operationFor(r.method, r.path)?.template}`);
    }
    const inScope = Object.entries(openapi.paths)
      .filter(([p]) => /^\/api\/v1\/(auth|users\/me|media\/sign-upload|businesses|admin\/me\/totp|admin\/businesses)/.test(p))
      .flatMap(([p, ops]) => Object.keys(ops).map(m => `${m.toUpperCase()} ${p}`));
    // /auth/signout is the API's alias of /auth/logout; the App uses logout.
    // /auth/web/* is the admin web console's cookie session, never the App's.
    const uncalled = inScope.filter(
      op => !called.has(op) && op !== 'POST /api/v1/auth/signout' && !op.includes(' /api/v1/auth/web/'),
    );
    expect(uncalled).toEqual([]);
  });

  it('the checker itself catches an unknown field, a missing required field and an unknown path', () => {
    expect(problems({ method: 'POST', path: '/api/v1/businesses', query: {}, body: { name: 'x', address: 'old field' }, authorization: undefined })).toEqual(
      expect.arrayContaining([
        'POST /api/v1/businesses: "address" is not in the body schema',
        'POST /api/v1/businesses: required "addressLine" is missing',
      ]),
    );
    expect(problems({ method: 'POST', path: '/api/v1/media/sign', query: {}, body: {}, authorization: undefined })).toEqual([
      'POST /api/v1/media/sign is not in openapi.json',
    ]);
  });
});
