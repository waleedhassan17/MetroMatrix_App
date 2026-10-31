// MetroMatrix — Account stack (every role's Profile tab).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import Profile from '../screens/profile-screen/Profile';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import Saved from '../screens/saved-screen/Saved';
import AddressBook from '../screens/address-book-screen/AddressBook';
import { SHOP_BROWSE_ROUTES } from './ShoppingCustomer';
import { HEALTH_BROWSE_ROUTES } from './HealthPatient';

export const ACCOUNT_ROUTES: IRoute[] = [
  { title: ROUTES.PROFILE, component: Profile },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.SAVED, component: Saved },
  { title: ROUTES.ADDRESS_BOOK, component: AddressBook },
  ...SHOP_BROWSE_ROUTES,
  ...HEALTH_BROWSE_ROUTES,
];
