// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping (customer) routes
// ═══════════════════════════════════════════════════════
// The customer's Smart Shopping app, the FYP's way: SHOP_TABS (Home · Bag ·
// Saved · Orders) under SHOP_APP_ROUTES, which push over the tabs. The Bag
// is a tab and also opens over a product ("Go to bag"), as the FYP's Cart.

import type { IRoute, ITabRoute } from './types';
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
import PaymentProofScreen from '../screens/Shopping/Customer/PaymentProof/PaymentProofScreen';
import SavedScreen from '../screens/Shopping/Customer/Saved/SavedScreen';
import ShopOrdersScreen from '../screens/Shopping/Customer/ShopOrders/ShopOrdersScreen';
import OrderDetailScreen from '../screens/Shopping/Customer/OrderDetail/OrderDetailScreen';
import ReturnRequestScreen from '../screens/Shopping/Customer/ReturnRequest/ReturnRequestScreen';
import WriteReviewScreen from '../screens/Shopping/Customer/WriteReview/WriteReviewScreen';
import { useBagCount } from '../hooks/useShop';

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
  // Checkout leaves the Bag and itself out of the history, so back from here is safe.
  { title: ROUTES.ORDER_PLACED, component: OrderPlacedScreen },
  { title: ROUTES.ADDRESS_FORM, component: AddressFormScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
  // "I've paid" for a shop order or an appointment, from whichever tab you're in.
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProofScreen },
];

const AS_TAB = { asTab: true };

/** The FYP's Shopping tabs: Home · Bag · Saved · Orders (its Cart and Wishlist, in our words). */
export const SHOP_TABS: ITabRoute[] = [
  { title: ROUTES.SHOP_HOME_TAB, component: ShoppingHomeScreen, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.BAG_TAB, component: BagScreen, label: 'Bag', icon: 'bag-handle-outline', iconActive: 'bag-handle', initialParams: AS_TAB, useBadge: useBagCount },
  { title: ROUTES.SAVED_TAB, component: SavedScreen, label: 'Saved', icon: 'heart-outline', iconActive: 'heart', initialParams: AS_TAB },
  { title: ROUTES.SHOP_ORDERS_TAB, component: ShopOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
];

/** Everything that opens over the Shopping tabs. */
export const SHOP_APP_ROUTES: IRoute[] = [
  ...SHOP_HOME_ROUTES.filter(r => r.title !== ROUTES.SHOPPING_HOME),
  ...SHOP_BROWSE_ROUTES,
  { title: ROUTES.ORDER_DETAIL, component: OrderDetailScreen },
  { title: ROUTES.RETURN_REQUEST, component: ReturnRequestScreen },
  { title: ROUTES.WRITE_REVIEW, component: WriteReviewScreen },
];
