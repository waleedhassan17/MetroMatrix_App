// MetroMatrix — Admin console tabs (Approvals, Profile).

import type { ITabRoute } from './types';
import { ROUTES } from './Base';

import AdminStack from '../navigators/stacks/AdminStack';
import AccountStack from '../navigators/stacks/AccountStack';

export const ADMIN_TAB_ROUTES: ITabRoute[] = [
  { title: ROUTES.APPROVALS_TAB, component: AdminStack, label: 'Approvals', icon: 'check-square' },
  { title: ROUTES.PROFILE_TAB, component: AccountStack, label: 'Profile', icon: 'user' },
];
