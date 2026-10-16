// MetroMatrix — Admin console tabs (Approvals, Shopping, Health, Profile).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import AdminStack from '../navigators/stacks/AdminStack';
import AdminShopStack from '../navigators/stacks/AdminShopStack';
import AdminHealthStack from '../navigators/stacks/AdminHealthStack';
import AccountStack from '../navigators/stacks/AccountStack';

export const ADMIN_TAB_ROUTES: ITabRoute[] = [
  {
    title: ROUTES.APPROVALS_TAB,
    component: AdminStack,
    label: 'Approvals',
    icon: 'shield-checkmark-outline',
    iconActive: 'shield-checkmark',
  },
  {
    title: ROUTES.SHOP_ADMIN_TAB,
    component: AdminShopStack,
    label: 'Shopping',
    icon: 'bag-handle-outline',
    iconActive: 'bag-handle',
  },
  {
    title: ROUTES.HEALTH_ADMIN_TAB,
    component: AdminHealthStack,
    label: 'Health',
    icon: 'medkit-outline',
    iconActive: 'medkit',
  },
  {
    title: ROUTES.PROFILE_TAB,
    component: AccountStack,
    label: 'Profile',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
  },
];
