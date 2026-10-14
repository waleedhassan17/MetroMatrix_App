import { store } from '../store';
import { resetAllState } from '../resetAllState';
import { setThemeMode } from '../preferencesSlice';
import { setOnboardingSeen, setSession } from '../../screens/Auth/authSlice';
import { setPreviewService } from '../../screens/Dev/DesignGallery/designGallerySlice';
import type { User } from '../../types/auth';

const user = { id: 'u1', role: 'customer', isEmailVerified: true } as User;

describe('RESET_ALL_STATE at the root reducer', () => {
  it('wipes account-scoped slices and keeps the shell, preferences and onboarding flag', () => {
    store.dispatch(setThemeMode('dark'));
    store.dispatch(setOnboardingSeen());
    store.dispatch(setSession({ user, business: null }));
    store.dispatch(setPreviewService('food'));
    const readyBefore = store.getState().appContainer;

    store.dispatch(resetAllState());
    const state = store.getState();

    // account-scoped: back to initial
    expect(state.designGallery.previewService).toBe('neutral');
    expect(state.auth.user).toBeNull();
    expect(state.auth.isAuthenticated).toBe(false);
    // device-scoped: survives
    expect(state.preferences.themeMode).toBe('dark');
    expect(state.auth.hasSeenOnboarding).toBe(true);
    expect(state.appContainer).toBe(readyBefore);
  });
});
