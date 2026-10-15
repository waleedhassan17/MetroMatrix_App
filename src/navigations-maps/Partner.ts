// MetroMatrix — Partner app tabs. One array per service so each partner
// navigator can grow its own tools without touching the others. The store
// partner's app has its own map (StorePartner.ts).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import PartnerHomeScreen from '../screens/Partner/PartnerHome/PartnerHomeScreen';
import AccountStack from '../navigators/stacks/AccountStack';

const profileTab: ITabRoute = {
  title: ROUTES.PROFILE_TAB,
  component: AccountStack,
  label: 'Profile',
  icon: 'person-circle-outline',
  iconActive: 'person-circle',
};

export const DOCTOR_PARTNER_TAB_ROUTES: ITabRoute[] = [
  {
    title: ROUTES.HOME_TAB,
    component: PartnerHomeScreen,
    label: 'Practice',
    icon: 'medkit-outline',
    iconActive: 'medkit',
  },
  profileTab,
];

export const KITCHEN_PARTNER_TAB_ROUTES: ITabRoute[] = [
  {
    title: ROUTES.HOME_TAB,
    component: PartnerHomeScreen,
    label: 'Kitchen',
    icon: 'restaurant-outline',
    iconActive: 'restaurant',
  },
  profileTab,
];
