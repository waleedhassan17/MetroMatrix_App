// MetroMatrix — The customer app, the FYP's way: a root stack with the
// three-card home (no bottom bar; its side menu opens the account pages) and
// one app per service, each with its own tabs.
//   CustomerHome · ServicePreview · Orders (every service) · Profile and its
//   pages · HealthApp · ShopApp · FoodApp

import type { IRoute } from './types';
import { ROUTES } from './Base';

import CustomerHome from '../screens/customer-home-screen/CustomerHome';
import ServicePreview from '../screens/service-preview-screen/ServicePreview';
import Orders from '../screens/orders-screen/Orders';
import Profile from '../screens/profile-screen/Profile';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import AddressBook from '../screens/address-book-screen/AddressBook';
import AddressFormScreen from '../screens/address-form-screen/AddressForm';
import Notifications from '../screens/notifications-screen/Notifications';
import HealthAppNavigator from '../navigators/HealthAppNavigator';
import ShopAppNavigator from '../navigators/ShopAppNavigator';
import FoodAppNavigator from '../navigators/FoodAppNavigator';
import RealtimeCheck from '../screens/realtime-check-screen/RealtimeCheck';

/** Dev builds only: the Food foundation check — live connection, rider location, order alert (/dev/realtime). */
const DEV_ROUTES: IRoute[] = __DEV__ ? [{ title: ROUTES.REALTIME_CHECK, component: RealtimeCheck }] : [];

export const CUSTOMER_ROUTES: IRoute[] = [
  { title: ROUTES.CUSTOMER_HOME, component: CustomerHome },
  { title: ROUTES.SERVICE_PREVIEW, component: ServicePreview },
  { title: ROUTES.HEALTH_APP, component: HealthAppNavigator },
  { title: ROUTES.SHOP_APP, component: ShopAppNavigator },
  { title: ROUTES.FOOD_APP, component: FoodAppNavigator },
  { title: ROUTES.ORDERS, component: Orders },
  { title: ROUTES.PROFILE, component: Profile },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.ADDRESS_BOOK, component: AddressBook },
  { title: ROUTES.ADDRESS_FORM, component: AddressFormScreen },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
  ...DEV_ROUTES,
];
