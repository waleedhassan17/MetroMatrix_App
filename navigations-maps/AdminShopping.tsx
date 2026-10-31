// MetroMatrix — Admin console: the Shopping tab's stack.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ShopOverview from '../screens/shop-overview-screen/ShopOverview';
import ShopCategories from '../screens/shop-categories-screen/ShopCategories';
import ShopBanners from '../screens/shop-banners-screen/ShopBanners';
import BannerFormScreen from '../screens/banner-form-screen/BannerForm';
import ShopReports from '../screens/shop-reports-screen/ShopReports';
import OrderLookup from '../screens/order-lookup-screen/OrderLookup';
import ShopStores from '../screens/shop-stores-screen/ShopStores';

export const ADMIN_SHOP_ROUTES: IRoute[] = [
  { title: ROUTES.SHOP_OVERVIEW, component: ShopOverview },
  { title: ROUTES.SHOP_REPORTS, component: ShopReports },
  { title: ROUTES.SHOP_CATEGORIES, component: ShopCategories },
  { title: ROUTES.SHOP_BANNERS, component: ShopBanners },
  { title: ROUTES.BANNER_FORM, component: BannerFormScreen },
  { title: ROUTES.SHOP_STORES, component: ShopStores },
  { title: ROUTES.ORDER_LOOKUP, component: OrderLookup },
];
