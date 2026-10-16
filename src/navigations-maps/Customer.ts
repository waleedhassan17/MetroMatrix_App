// MetroMatrix — The customer app, the FYP's way: a root stack with the
// three-card home (no bottom bar; its side menu opens the account pages) and
// one app per service, each with its own tabs.
//   CustomerHome · ServicePreview · Orders (every service) · Profile and its
//   pages · HealthApp · ShopApp · FoodApp

import type { IRoute } from './types';
import { ROUTES } from './Base';

import CustomerHomeScreen from '../screens/Customer/CustomerHome/CustomerHomeScreen';
import ServicePreviewScreen from '../screens/Customer/ServicePreview/ServicePreviewScreen';
import OrdersScreen from '../screens/Customer/Orders/OrdersScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import AddressBookScreen from '../screens/Account/AddressBook/AddressBookScreen';
import AddressFormScreen from '../screens/Account/AddressForm/AddressFormScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';
import HealthAppNavigator from '../navigators/HealthAppNavigator';
import ShopAppNavigator from '../navigators/ShopAppNavigator';
import FoodAppNavigator from '../navigators/FoodAppNavigator';

export const CUSTOMER_ROUTES: IRoute[] = [
  { title: ROUTES.CUSTOMER_HOME, component: CustomerHomeScreen },
  { title: ROUTES.SERVICE_PREVIEW, component: ServicePreviewScreen },
  { title: ROUTES.HEALTH_APP, component: HealthAppNavigator },
  { title: ROUTES.SHOP_APP, component: ShopAppNavigator },
  { title: ROUTES.FOOD_APP, component: FoodAppNavigator },
  { title: ROUTES.ORDERS, component: OrdersScreen },
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.ADDRESS_BOOK, component: AddressBookScreen },
  { title: ROUTES.ADDRESS_FORM, component: AddressFormScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
