// MetroMatrix — The customer's Food Court app: its own tabs (Home · Orders ·
// Profile), in the FYP Home services bar's look, with browsing — vendor
// lists, search, a vendor's page — and ordering — the bag, checkout, order
// placed, an order live, the transfer's receipt, rating it, a kitchen's
// reviews — Bachat Box (tonight's surplus, reserved for pickup), tiffin
// plans and dawat (catering) requests pushed over them.

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import FoodHome from '../screens/food-home-screen/FoodHome';
import FoodOrders from '../screens/food-orders-screen/FoodOrders';
import Profile from '../screens/profile-screen/Profile';
import FoodVendors from '../screens/food-vendors-screen/FoodVendors';
import FoodSearch from '../screens/food-search-screen/FoodSearch';
import FoodVendor from '../screens/food-vendor-screen/FoodVendor';
import FoodBag from '../screens/food-bag-screen/FoodBag';
import FoodCheckout from '../screens/food-checkout-screen/FoodCheckout';
import FoodOrderPlaced from '../screens/food-order-placed-screen/FoodOrderPlaced';
import FoodOrderScreen from '../screens/food-order-screen/FoodOrder';
import FoodFavourites from '../screens/food-favourites-screen/FoodFavourites';
import PaymentProof from '../screens/payment-proof-screen/PaymentProof';
import FoodRateOrder from '../screens/food-rate-order-screen/FoodRateOrder';
import FoodReviews from '../screens/food-reviews-screen/FoodReviews';
import FoodSurplusList from '../screens/food-surplus-list-screen/FoodSurplusList';
import FoodSurplus from '../screens/food-surplus-screen/FoodSurplus';
import FoodSurplusReserved from '../screens/food-surplus-reserved-screen/FoodSurplusReserved';
import FoodSurplusReservations from '../screens/food-surplus-reservations-screen/FoodSurplusReservations';
import FoodTiffinPlan from '../screens/food-tiffin-plan-screen/FoodTiffinPlan';
import FoodTiffins from '../screens/food-tiffins-screen/FoodTiffins';
import FoodTiffin from '../screens/food-tiffin-screen/FoodTiffin';
import FoodCateringForm from '../screens/food-catering-form-screen/FoodCateringForm';
import FoodCateringRequests from '../screens/food-catering-requests-screen/FoodCateringRequests';
import FoodCateringRequest from '../screens/food-catering-request-screen/FoodCateringRequest';
import Pantry from '../screens/pantry-screen/Pantry';
import RecipeIdeas from '../screens/recipe-ideas-screen/RecipeIdeas';
import HomeRecipe from '../screens/home-recipe-screen/HomeRecipe';
import MissingItems from '../screens/missing-items-screen/MissingItems';
import NutritionSettingsScreen from '../screens/nutrition-settings-screen/NutritionSettings';
import NutritionSummary from '../screens/nutrition-summary-screen/NutritionSummary';

const AS_TAB = { asTab: true };

export const FOOD_TABS: ITabRoute[] = [
  { title: ROUTES.FOOD_HOME_TAB, component: FoodHome, label: 'Home', icon: 'home-outline', iconActive: 'home', initialParams: AS_TAB },
  { title: ROUTES.FOOD_ORDERS_TAB, component: FoodOrders, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt', initialParams: AS_TAB },
  { title: ROUTES.FOOD_PROFILE_TAB, component: Profile, label: 'Profile', icon: 'person-outline', iconActive: 'person', initialParams: AS_TAB },
];

/** Pushed over the tabs. */
export const FOOD_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.FOOD_VENDORS, component: FoodVendors },
  { title: ROUTES.FOOD_SEARCH, component: FoodSearch, options: { animation: 'fade' } },
  { title: ROUTES.FOOD_VENDOR, component: FoodVendor },
  { title: ROUTES.FOOD_BAG, component: FoodBag },
  { title: ROUTES.FOOD_CHECKOUT, component: FoodCheckout },
  { title: ROUTES.FOOD_ORDER_PLACED, component: FoodOrderPlaced, options: { gestureEnabled: false } },
  { title: ROUTES.FOOD_ORDER, component: FoodOrderScreen },
  { title: ROUTES.FOOD_FAVOURITES, component: FoodFavourites },
  { title: ROUTES.PAYMENT_PROOF, component: PaymentProof },
  { title: ROUTES.FOOD_RATE_ORDER, component: FoodRateOrder },
  { title: ROUTES.FOOD_REVIEWS, component: FoodReviews },
  // Bachat Box (Kitchen Intelligence)
  { title: ROUTES.FOOD_SURPLUS_LIST, component: FoodSurplusList },
  { title: ROUTES.FOOD_SURPLUS, component: FoodSurplus },
  { title: ROUTES.FOOD_SURPLUS_RESERVED, component: FoodSurplusReserved },
  { title: ROUTES.FOOD_SURPLUS_RESERVATIONS, component: FoodSurplusReservations },
  // Tiffin and catering (5B)
  { title: ROUTES.FOOD_TIFFIN_PLAN, component: FoodTiffinPlan },
  { title: ROUTES.FOOD_TIFFINS, component: FoodTiffins },
  { title: ROUTES.FOOD_TIFFIN, component: FoodTiffin },
  { title: ROUTES.FOOD_CATERING_FORM, component: FoodCateringForm },
  { title: ROUTES.FOOD_CATERING_REQUESTS, component: FoodCateringRequests },
  { title: ROUTES.FOOD_CATERING_REQUEST, component: FoodCateringRequest },
  // My Kitchen and the customer's nutrition (5C)
  { title: ROUTES.MY_KITCHEN, component: Pantry },
  { title: ROUTES.MY_KITCHEN_RECIPES, component: RecipeIdeas },
  { title: ROUTES.MY_KITCHEN_RECIPE, component: HomeRecipe },
  { title: ROUTES.MY_KITCHEN_MISSING, component: MissingItems },
  { title: ROUTES.NUTRITION_SETTINGS, component: NutritionSettingsScreen },
  { title: ROUTES.NUTRITION_SUMMARY, component: NutritionSummary },
];
