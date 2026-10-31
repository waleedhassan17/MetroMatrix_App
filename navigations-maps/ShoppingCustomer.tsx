// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping (customer) routes
// ═══════════════════════════════════════════════════════
// The customer's Smart Shopping app, the FYP's way: SHOP_TABS (Home · Bag ·
// Saved · Orders) under SHOP_APP_ROUTES, which push over the tabs. The Bag
// is a tab and also opens over a product ("Go to bag"), as the FYP's Cart.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import ShoppingHome from '../screens/shopping-home-screen/ShoppingHome';
import CategoryBrowse from '../screens/category-browse-screen/CategoryBrowse';
import StoreList from '../screens/store-list-screen/StoreList';
import ShopSearch from '../screens/shop-search-screen/ShopSearch';
import StorePage from '../screens/store-page-screen/StorePage';
import ProductList from '../screens/product-list-screen/ProductList';
import ProductDetailScreen from '../screens/product-detail-screen/ProductDetail';
import ProductReviews from '../screens/product-reviews-screen/ProductReviews';
import Bag from '../screens/bag-screen/Bag';
import Checkout from '../screens/checkout-screen/Checkout';
import OrderPlaced from '../screens/order-placed-screen/OrderPlaced';
import AddressFormScreen from '../screens/address-form-screen/AddressForm';
import Notifications from '../screens/notifications-screen/Notifications';
import PaymentProof from '../screens/payment-proof-screen/PaymentProof';
import Saved from '../screens/saved-screen/Saved';
import ShopOrdersScreen from '../screens/shop-orders-screen/ShopOrders';
import OrderDetail from '../screens/order-detail-screen/OrderDetail';
import ReturnRequest from '../screens/return-request-screen/ReturnRequest';
import WriteReview from '../screens/write-review-screen/WriteReview';
import { useBagCount } from '../hooks/useShop';

export const SHOP_HOME_ROUTES: IRoute[] = [
  { title: ROUTES.SHOPPING_HOME, component: ShoppingHome },
  { title: ROUTES.CATEGORY_BROWSE, component: CategoryBrowse },
  { title: ROUTES.STORE_LIST, component: StoreList },
  { title: ROUTES.SHOP_SEARCH, component: ShopSearch, options: { animation: 'fade' } },
];

export const SHOP_BROWSE_ROUTES: IRoute[] = [
  { title: ROUTES.STORE_PAGE, component: StorePage },
  { title: ROUTES.PRODUCT_LIST, component: ProductList },
  { title: ROUTES.PRODUCT_DETAIL, component: ProductDetailScreen },
  { title: ROUTES.PRODUCT_REVIEWS, component: ProductReviews },
  { title: ROUTES.BAG, component: Bag },
  { title: ROUTES.CHECKOUT, component: Checkout },
  // Checkout leaves the Bag and itself out of the history, so back from here is safe.
  { title: ROUTES.ORDER_PLACED, component: OrderPlaced },
  { title: ROUTES.ADDRESS_FORM, component: AddressFormScreen },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
  // "I've paid" for a shop order or an appointment, from whichever tab you're in.
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProof },
];

const AS_TAB = { asTab: true };

/** The FYP's Shopping tabs: Home · Bag · Saved · Orders (its Cart and Wishlist, in our words). */
export const SHOP_TABS: ITabRoute[] = [
  { title: ROUTES.SHOP_HOME_TAB, component: ShoppingHome, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.BAG_TAB, component: Bag, label: 'Bag', icon: 'bag-handle-outline', iconActive: 'bag-handle', initialParams: AS_TAB, useBadge: useBagCount },
  { title: ROUTES.SAVED_TAB, component: Saved, label: 'Saved', icon: 'heart-outline', iconActive: 'heart', initialParams: AS_TAB },
  { title: ROUTES.SHOP_ORDERS_TAB, component: ShopOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
];

/** Everything that opens over the Shopping tabs. */
export const SHOP_APP_ROUTES: IRoute[] = [
  ...SHOP_HOME_ROUTES.filter(r => r.title !== ROUTES.SHOPPING_HOME),
  ...SHOP_BROWSE_ROUTES,
  { title: ROUTES.ORDER_DETAIL, component: OrderDetail },
  { title: ROUTES.RETURN_REQUEST, component: ReturnRequest },
  { title: ROUTES.WRITE_REVIEW, component: WriteReview },
];
