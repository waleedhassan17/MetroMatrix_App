// MetroMatrix — Partner app tabs. One array per service so each partner
// navigator can grow its own tools without touching the others. The store
// partner's and the doctor's apps have their own maps (StorePartner.ts,
// DoctorPartner.ts).

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
