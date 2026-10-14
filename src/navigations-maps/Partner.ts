// MetroMatrix — Partner app tabs. One array per service so each partner
// navigator can grow its own tools without touching the others.

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import PartnerHomeScreen from '../screens/Partner/PartnerHome/PartnerHomeScreen';
import AccountStack from '../navigators/stacks/AccountStack';

const profileTab: ITabRoute = { title: ROUTES.PROFILE_TAB, component: AccountStack, label: 'Profile', icon: 'user' };

export const STORE_PARTNER_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: PartnerHomeScreen, label: 'Store', icon: 'shopping-bag' },
  profileTab,
];

export const DOCTOR_PARTNER_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: PartnerHomeScreen, label: 'Practice', icon: 'heart' },
  profileTab,
];

export const KITCHEN_PARTNER_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.HOME_TAB, component: PartnerHomeScreen, label: 'Kitchen', icon: 'coffee' },
  profileTab,
];
