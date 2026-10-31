// MetroMatrix — Account stack (every role's Profile tab).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import SavedScreen from '../screens/Shopping/Customer/Saved/SavedScreen';
import AddressBookScreen from '../screens/Account/AddressBook/AddressBookScreen';
import { SHOP_BROWSE_ROUTES } from './ShoppingCustomer';
import { HEALTH_BROWSE_ROUTES } from './HealthPatient';

export const ACCOUNT_ROUTES: IRoute[] = [
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.SAVED, component: SavedScreen },
  { title: ROUTES.ADDRESS_BOOK, component: AddressBookScreen },
  ...SHOP_BROWSE_ROUTES,
  ...HEALTH_BROWSE_ROUTES,
];
