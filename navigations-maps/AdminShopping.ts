// MetroMatrix — Admin console: the Shopping tab's stack.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ShopOverviewScreen from '../screens/Admin/Shopping/ShopOverview/ShopOverviewScreen';
import ShopCategoriesScreen from '../screens/Admin/Shopping/ShopCategories/ShopCategoriesScreen';
import ShopBannersScreen from '../screens/Admin/Shopping/ShopBanners/ShopBannersScreen';
import BannerFormScreen from '../screens/Admin/Shopping/BannerForm/BannerFormScreen';
import ShopReportsScreen from '../screens/Admin/Shopping/ShopReports/ShopReportsScreen';
import OrderLookupScreen from '../screens/Admin/Shopping/OrderLookup/OrderLookupScreen';
import ShopStoresScreen from '../screens/Admin/Shopping/ShopStores/ShopStoresScreen';

export const ADMIN_SHOP_ROUTES: IRoute[] = [
  { title: ROUTES.SHOP_OVERVIEW, component: ShopOverviewScreen },
  { title: ROUTES.SHOP_REPORTS, component: ShopReportsScreen },
  { title: ROUTES.SHOP_CATEGORIES, component: ShopCategoriesScreen },
  { title: ROUTES.SHOP_BANNERS, component: ShopBannersScreen },
  { title: ROUTES.BANNER_FORM, component: BannerFormScreen },
  { title: ROUTES.SHOP_STORES, component: ShopStoresScreen },
  { title: ROUTES.ORDER_LOOKUP, component: OrderLookupScreen },
];
