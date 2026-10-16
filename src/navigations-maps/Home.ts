// MetroMatrix — Customer Home stack: the FYP's three-service launcher, then
// the service it opens.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import CustomerHomeScreen from '../screens/Customer/CustomerHome/CustomerHomeScreen';
import FoodHomeScreen from '../screens/Customer/FoodHome/FoodHomeScreen';
import ServicePreviewScreen from '../screens/Customer/ServicePreview/ServicePreviewScreen';
import { SHOP_BROWSE_ROUTES, SHOP_HOME_ROUTES } from './ShoppingCustomer';
import { HEALTH_BROWSE_ROUTES, HEALTH_HOME_ROUTES } from './HealthPatient';

export const HOME_ROUTES: IRoute[] = [
  { title: ROUTES.CUSTOMER_HOME, component: CustomerHomeScreen },
  { title: ROUTES.FOOD_HOME, component: FoodHomeScreen },
  { title: ROUTES.SERVICE_PREVIEW, component: ServicePreviewScreen },
  ...SHOP_HOME_ROUTES,
  ...SHOP_BROWSE_ROUTES,
  ...HEALTH_HOME_ROUTES,
  ...HEALTH_BROWSE_ROUTES,
];
