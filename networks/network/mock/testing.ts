// ═══════════════════════════════════════════════════════
// MetroMatrix — the dummy API in tests
// ═══════════════════════════════════════════════════════
// The app always talks to the real API. A test that runs the app's networks
// against the dummy API installs it on the one client first, then signs in
// with signInAs: the dummy API has no sign-in route, so the session is
// written straight into the dummy DB and its pair stored as a sign-in would.

import { api, getAccessToken, refreshClient, setTokens } from '../apiHelpers';
import { authResultSerializer, sessionSerializer } from '../../../serializers/authSerializer';
import { clearIntentionalSignOut } from '../../../utils/authEvents';
import type { AuthResult } from '../../../types/auth';
import { mockAdapter, mockSessionFor, mockSessionOf } from './mockServer';

/** axios needs a base URL; nothing is ever sent there. */
const DUMMY_BASE_URL = 'https://dummy.metromatrix.test/api/v1';

/** Answer every request from the app's client with the dummy API. */
export const installDummyApi = (): void => {
  for (const client of [api, refreshClient]) {
    client.defaults.adapter = mockAdapter;
    client.defaults.baseURL = DUMMY_BASE_URL;
  }
};

/** Sign in as a seeded account (its email, or a rider's username). */
export const signInAs = async (who: string): Promise<AuthResult> => {
  const result = authResultSerializer(await mockSessionFor(who));
  if (!result) throw new Error(`No session for ${who}.`);
  await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
  clearIntentionalSignOut();
  return result;
};

/** The signed-in account, as GET /auth/me answers it. */
export const currentSession = async () => {
  const session = sessionSerializer(await mockSessionOf(await getAccessToken()));
  if (!session) throw new Error('No dummy session.');
  return session;
};
