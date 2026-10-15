// MetroMatrix — Account stack (every role's Profile tab).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import SavedScreen from '../screens/Shopping/Customer/Saved/SavedScreen';
import { SHOP_BROWSE_ROUTES } from './ShoppingCustomer';

export const ACCOUNT_ROUTES: IRoute[] = [
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.SAVED, component: SavedScreen },
  ...SHOP_BROWSE_ROUTES,
];
