// ═══════════════════════════════════════════════════════
// MetroMatrix — Auth / onboarding navigation map
// ═══════════════════════════════════════════════════════
// Route lists for BaseNavigator's session-gate branches. Which BRANCH renders
// is decided by auth/business state in BaseNavigator; which NAVIGATOR mounts
// at the top level is decided by AppContainer.renderNavigator(). Route names
// come from ./Base.ts and must never change.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import WelcomeScreen from '../screens/Auth/Welcome/WelcomeScreen';

/** ── Unauthenticated flow ── */
export const UNAUTHENTICATED_ROUTES: IRoute[] = [
  { title: ROUTES.WELCOME, component: WelcomeScreen, options: { animation: 'none' } },
];
