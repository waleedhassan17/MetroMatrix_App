import { configureStore } from '@reduxjs/toolkit';
import {
  maintenanceReported,
  platformConfigSlice,
  selectMaintenance,
  selectServicePaused,
  selectSignupsOpen,
  servicePausedReported,
  signupsPausedReported,
} from '../platformConfigSlice';
import { store as appStore } from '../store';
import { resetAllState } from '../resetAllState';
import { platformConfigSerializer } from '../../serializers/platformConfigSerializer';

const make = () => configureStore({ reducer: { platformConfig: platformConfigSlice.reducer } });

describe('platformConfigSlice', () => {
  it('starts open: nothing paused before /config answers', () => {
    const s = make().getState();
    expect(selectMaintenance(s)).toEqual({ enabled: false, message: '' });
    expect(selectServicePaused(s, 'shopping')).toBe(false);
    expect(selectSignupsOpen(s, 'customer')).toBe(true);
  });

  it('records what the server refused mid-session', () => {
    const st = make();
    st.dispatch(maintenanceReported({ message: 'Back soon.' }));
    st.dispatch(servicePausedReported({ service: 'healthcare' }));
    st.dispatch(signupsPausedReported({ role: 'partner' }));
    const s = st.getState();
    expect(selectMaintenance(s)).toEqual({ enabled: true, message: 'Back soon.' });
    expect(selectServicePaused(s, 'healthcare')).toBe(true);
    expect(selectServicePaused(s, 'food')).toBe(false);
    expect(selectSignupsOpen(s, 'partner')).toBe(false);
    expect(selectSignupsOpen(s, 'customer')).toBe(true);
  });

  it('kitchen lives inside Food: Food paused pauses Kitchen too', () => {
    const st = make();
    st.dispatch(servicePausedReported({ service: 'food' }));
    expect(selectServicePaused(st.getState(), 'kitchen')).toBe(true);
  });

  it('survives a sign-out (RESET_ALL_STATE): maintenance is about the platform', () => {
    appStore.dispatch(maintenanceReported({ message: 'Upgrading.' }));
    appStore.dispatch(resetAllState());
    expect(selectMaintenance(appStore.getState()).enabled).toBe(true);
  });
});

describe('platformConfigSerializer', () => {
  it('maps the API shape', () => {
    expect(
      platformConfigSerializer({
        signupsEnabled: { customer: false, partner: true },
        services: {
          shopping: { enabled: true },
          healthcare: { enabled: false },
          food: { enabled: true },
          kitchen: { enabled: true },
        },
        ai: { enabled: false },
        maintenance: { enabled: true, message: 'Back at 3 pm.' },
        support: { email: 'help@metromatrix.pk' },
      }),
    ).toEqual({
      signupsEnabled: { customer: false, partner: true },
      services: { shopping: true, healthcare: false, food: true, kitchen: true },
      aiEnabled: false,
      maintenance: { enabled: true, message: 'Back at 3 pm.' },
      supportEmail: 'help@metromatrix.pk',
    });
  });

  it('anything missing reads as open, never as shut', () => {
    expect(platformConfigSerializer({})).toEqual({
      signupsEnabled: { customer: true, partner: true },
      services: { shopping: true, healthcare: true, food: true, kitchen: true },
      aiEnabled: true,
      maintenance: { enabled: false, message: '' },
      supportEmail: null,
    });
    expect(platformConfigSerializer(null)).toBeNull();
  });
});
