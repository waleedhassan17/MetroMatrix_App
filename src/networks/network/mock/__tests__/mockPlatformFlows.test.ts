// The dummy API's platform switches, through the real network functions and
// the real axios client: GET /config, PATCH /admin/settings, and the same
// refusals as the real API (503 MAINTENANCE, 503 SERVICE_PAUSED, 403
// SIGNUPS_PAUSED) — which the client also reports as platform notices.

import { api, AuthError } from '../../apiHelpers';
import { authAdminTotp, authMe, authSignin, authSignup } from '../../../auth/authNetwork';
import { fetchPlatformConfig } from '../../../config/configNetwork';
import { clearTokens, setTokens } from '../../../../utils/storageUtils';
import { setPlatformNoticeHandler, type PlatformNotice } from '../../../../utils/authEvents';
import { MOCK, SEED_PASSWORD, STAFF_PASSWORD } from '../mockConfig';
import { resetMockDb } from '../mockDb';

const failure = async (p: Promise<unknown>): Promise<AuthError & { status?: number }> => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected the call to fail');
};

/** Signs staff in; leaves their tokens stored, as the app would. */
async function asStaff() {
  const outcome = await authSignin({ email: 'admin@metromatrix.app', password: STAFF_PASSWORD, portal: 'admin' });
  if (outcome.kind !== 'totp') throw new Error('expected a challenge');
  const session = await authAdminTotp(outcome.challenge.challengeToken, { code: MOCK.TOTP_CODE });
  await setTokens(session.tokens.accessToken, session.tokens.refreshToken);
}

const setSettings = (values: Record<string, unknown>) =>
  api.patch('/admin/settings', { values, totpCode: '123456' });

const notices: PlatformNotice[] = [];

beforeEach(async () => {
  await resetMockDb();
  await clearTokens();
  notices.length = 0;
  setPlatformNoticeHandler(n => notices.push(n));
});
afterAll(() => setPlatformNoticeHandler(null));

describe('dummy API: platform switches', () => {
  it('GET /config answers the real shape, all open by default', async () => {
    expect(await fetchPlatformConfig()).toEqual({
      signupsEnabled: { customer: true, partner: true },
      services: { shopping: true, healthcare: true, food: true, kitchen: true },
      aiEnabled: true,
      maintenance: { enabled: false, message: expect.any(String) },
      supportEmail: null,
    });
  });

  it('settings need staff and a step-up code; unknown keys are refused', async () => {
    expect((await failure(setSettings({ 'maintenance.enabled': true }))).status).toBe(401);
    await asStaff();
    const noCode = await failure(api.patch('/admin/settings', { values: { 'maintenance.enabled': true } }));
    expect((noCode as any).response?.data?.error?.code).toBe('STEP_UP_REQUIRED');
    const bad = await failure(setSettings({ 'nope.key': true }));
    expect((bad as any).response?.status ?? bad.status).toBe(400);
  });

  it('maintenance: 503 MAINTENANCE except /config, /auth/me and staff; reported as a notice', async () => {
    await asStaff();
    await setSettings({ 'maintenance.enabled': true, 'maintenance.message': 'Back at 3 pm.' });
    expect((await fetchPlatformConfig()).maintenance).toEqual({ enabled: true, message: 'Back at 3 pm.' });
    // Staff keep working.
    expect((await authMe()).user.role).toBe('super_admin');

    await clearTokens();
    const refused = await failure(
      authSignin({ email: 'ayesha@example.com', password: SEED_PASSWORD, portal: 'customer' }),
    );
    expect(refused.code).toBe('MAINTENANCE');
    expect(notices).toContainEqual({ kind: 'maintenance', message: 'Back at 3 pm.' });
  });

  it('a paused service: 503 SERVICE_PAUSED on its routes only; reported as a notice', async () => {
    await asStaff();
    await setSettings({ 'services.shopping.enabled': false });
    const shop = await failure(api.get('/shop/home'));
    expect((shop as any).response?.data?.error).toMatchObject({ code: 'SERVICE_PAUSED', details: { service: 'shopping' } });
    expect(notices).toContainEqual({ kind: 'service_paused', service: 'shopping' });
    expect((await fetchPlatformConfig()).services).toMatchObject({ shopping: false, food: true });
  });

  it('paused sign-ups: 403 SIGNUPS_PAUSED for that role only; reported as a notice', async () => {
    await asStaff();
    await setSettings({ 'signupsEnabled.customer': false });
    await clearTokens();
    const refused = await failure(
      authSignup({ name: 'New Person', email: 'new.person@example.com', password: 'Secret123', role: 'customer' } as never),
    );
    expect(refused.code).toBe('SIGNUPS_PAUSED');
    expect(notices).toContainEqual({ kind: 'signups_paused', role: 'customer' });
  });
});
