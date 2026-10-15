// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping (customer) routes
// ═══════════════════════════════════════════════════════
// SHOP_HOME_ROUTES live in the Home stack only (the Smart Shopping card opens
// them). SHOP_BROWSE_ROUTES are spread into the Home, Orders and Profile
// stacks alike, so a product, a store or the Bag opens in the tab you are in.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ShoppingHomeScreen from '../screens/Shopping/Customer/ShoppingHome/ShoppingHomeScreen';
import CategoryBrowseScreen from '../screens/Shopping/Customer/CategoryBrowse/CategoryBrowseScreen';
import StoreListScreen from '../screens/Shopping/Customer/StoreList/StoreListScreen';
import ShopSearchScreen from '../screens/Shopping/Customer/ShopSearch/ShopSearchScreen';
import StorePageScreen from '../screens/Shopping/Customer/StorePage/StorePageScreen';
import ProductListScreen from '../screens/Shopping/Customer/ProductList/ProductListScreen';
import ProductDetailScreen from '../screens/Shopping/Customer/ProductDetail/ProductDetailScreen';
import ProductReviewsScreen from '../screens/Shopping/Customer/ProductReviews/ProductReviewsScreen';
import BagScreen from '../screens/Shopping/Customer/Bag/BagScreen';
import CheckoutScreen from '../screens/Shopping/Customer/Checkout/CheckoutScreen';
import OrderPlacedScreen from '../screens/Shopping/Customer/OrderPlaced/OrderPlacedScreen';
import AddressFormScreen from '../screens/Account/AddressForm/AddressFormScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

export const SHOP_HOME_ROUTES: IRoute[] = [
  { title: ROUTES.SHOPPING_HOME, component: ShoppingHomeScreen },
  { title: ROUTES.CATEGORY_BROWSE, component: CategoryBrowseScreen },
  { title: ROUTES.STORE_LIST, component: StoreListScreen },
  { title: ROUTES.SHOP_SEARCH, component: ShopSearchScreen, options: { animation: 'fade' } },
];

export const SHOP_BROWSE_ROUTES: IRoute[] = [
  { title: ROUTES.STORE_PAGE, component: StorePageScreen },
  { title: ROUTES.PRODUCT_LIST, component: ProductListScreen },
  { title: ROUTES.PRODUCT_DETAIL, component: ProductDetailScreen },
  { title: ROUTES.PRODUCT_REVIEWS, component: ProductReviewsScreen },
  { title: ROUTES.BAG, component: BagScreen },
  { title: ROUTES.CHECKOUT, component: CheckoutScreen },
  // No swipe back from "Order placed": the order is done; its buttons lead on.
  { title: ROUTES.ORDER_PLACED, component: OrderPlacedScreen, options: { gestureEnabled: false } },
  { title: ROUTES.ADDRESS_FORM, component: AddressFormScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
