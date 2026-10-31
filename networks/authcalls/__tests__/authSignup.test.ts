// B2: sign-up sends exactly the API's SignupDto, and a provider's pick is kept
// by providerSelection (persisted), not sent with sign-up.

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MainAxiosInstance } from '../../network/network';
import { authSignup } from '../signup';
import { clearTokens } from '../../../utils/storage_utils/storageUtils';
import { store } from '../../../store/store';
import { signUpAsync } from '../../../screens/provider-sign-up-screen/providerSignUpSlice';
import { resetAllState } from '../../../store/resetAllState';

const sent: { url?: string; body: Record<string, unknown> }[] = [];

const authResult = (role: string) => ({
  success: true,
  data: {
    user: { id: 'u1', email: 'sara@example.com', displayName: 'Sara Khan', role, isEmailVerified: false },
    business: null,
    tokens: { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 },
  },
});

const capture = (role: string) =>
  (async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    sent.push({ url: config.url, body: JSON.parse(String(config.data ?? '{}')) });
    return { data: authResult(role), status: 201, statusText: '201', headers: {}, config };
  }) as never;

const originalAdapter = MainAxiosInstance.defaults.adapter;

beforeEach(async () => {
  sent.length = 0;
  await clearTokens();
});
afterAll(() => {
  MainAxiosInstance.defaults.adapter = originalAdapter;
});

describe('authSignup body', () => {
  it('sends { email, password, displayName, phone, role } and nothing else', async () => {
    MainAxiosInstance.defaults.adapter = capture('customer');
    await authSignup({ name: ' Hina Raza ', email: 'Hina@Example.com ', phone: '+923124890176', password: 'Metro2026', portal: 'customer' });
    expect(sent[0].url).toBe('/auth/signup');
    expect(sent[0].body).toEqual({
      email: 'hina@example.com',
      password: 'Metro2026',
      displayName: 'Hina Raza',
      phone: '+923124890176',
      role: 'customer',
    });
  });

  it('leaves a blank phone out', async () => {
    MainAxiosInstance.defaults.adapter = capture('partner');
    await authSignup({ name: 'Sara Khan', email: 'sara@example.com', phone: '', password: 'Metro2026', portal: 'partner' });
    expect(Object.keys(sent[0].body).sort()).toEqual(['displayName', 'email', 'password', 'role']);
  });
});

describe('provider sign-up keeps the pick', () => {
  it('records the picked type as pending after the session opens, without sending it', async () => {
    MainAxiosInstance.defaults.adapter = capture('partner');
    store.dispatch(resetAllState());
    await store.dispatch(
      signUpAsync({ values: { name: 'Sara Khan', phone: '', email: 'sara@example.com', password: 'Metro2026' }, subType: 'home_kitchen' }),
    );
    expect(sent[0].body).not.toHaveProperty('subType');
    expect(store.getState().providerSelection.pending).toEqual({ serviceType: 'food', subType: 'home_kitchen' });
    expect(store.getState().auth.user?.providerSubType).toBeNull();
  });
});
