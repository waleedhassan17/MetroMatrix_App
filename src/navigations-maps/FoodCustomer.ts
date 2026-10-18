// MetroMatrix — The customer's Food Court app: its own tabs (Home · Orders ·
// Profile), in the FYP Home services bar's look, with browsing — vendor
// lists, search, a vendor's page — and ordering — the bag, checkout, order
// placed, an order live, the transfer's receipt — pushed over them.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import FoodHomeScreen from '../screens/Food/Customer/FoodHome/FoodHomeScreen';
import FoodOrdersScreen from '../screens/Customer/FoodOrders/FoodOrdersScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import FoodVendorsScreen from '../screens/Food/Customer/FoodVendors/FoodVendorsScreen';
import FoodSearchScreen from '../screens/Food/Customer/FoodSearch/FoodSearchScreen';
import FoodVendorScreen from '../screens/Food/Customer/FoodVendor/FoodVendorScreen';
import FoodBagScreen from '../screens/Food/Customer/FoodBag/FoodBagScreen';
import FoodCheckoutScreen from '../screens/Food/Customer/FoodCheckout/FoodCheckoutScreen';
import FoodOrderPlacedScreen from '../screens/Food/Customer/FoodOrderPlaced/FoodOrderPlacedScreen';
import FoodOrderScreen from '../screens/Food/Customer/FoodOrder/FoodOrderScreen';
import FoodFavouritesScreen from '../screens/Food/Customer/FoodFavourites/FoodFavouritesScreen';
import PaymentProofScreen from '../screens/Shopping/Customer/PaymentProof/PaymentProofScreen';

const AS_TAB = { asTab: true };

export const FOOD_TABS: ITabRoute[] = [
  { title: ROUTES.FOOD_HOME_TAB, component: FoodHomeScreen, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.FOOD_ORDERS_TAB, component: FoodOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
  { title: ROUTES.FOOD_PROFILE_TAB, component: ProfileScreen, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];

/** Pushed over the tabs. */
export const FOOD_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.FOOD_VENDORS, component: FoodVendorsScreen },
  { title: ROUTES.FOOD_SEARCH, component: FoodSearchScreen, options: { animation: 'fade' } },
  { title: ROUTES.FOOD_VENDOR, component: FoodVendorScreen },
  { title: ROUTES.FOOD_BAG, component: FoodBagScreen },
  { title: ROUTES.FOOD_CHECKOUT, component: FoodCheckoutScreen },
  { title: ROUTES.FOOD_ORDER_PLACED, component: FoodOrderPlacedScreen, options: { gestureEnabled: false } },
  { title: ROUTES.FOOD_ORDER, component: FoodOrderScreen },
  { title: ROUTES.FOOD_FAVOURITES, component: FoodFavouritesScreen },
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProofScreen },
];
