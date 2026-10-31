// MetroMatrix — The customer's Food Court app: its own tabs (Home · Orders ·
// Profile), in the FYP Home services bar's look, with browsing — vendor
// lists, search, a vendor's page — and ordering — the bag, checkout, order
// placed, an order live, the transfer's receipt, rating it, a kitchen's
// reviews — Bachat Box (tonight's surplus, reserved for pickup), tiffin
// plans and dawat (catering) requests pushed over them.

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
import FoodRateOrderScreen from '../screens/Food/Customer/FoodRateOrder/FoodRateOrderScreen';
import FoodReviewsScreen from '../screens/Food/Customer/FoodReviews/FoodReviewsScreen';
import FoodSurplusListScreen from '../screens/Food/Customer/FoodSurplusList/FoodSurplusListScreen';
import FoodSurplusScreen from '../screens/Food/Customer/FoodSurplus/FoodSurplusScreen';
import FoodSurplusReservedScreen from '../screens/Food/Customer/FoodSurplusReserved/FoodSurplusReservedScreen';
import FoodSurplusReservationsScreen from '../screens/Food/Customer/FoodSurplusReservations/FoodSurplusReservationsScreen';
import FoodTiffinPlanScreen from '../screens/Food/Customer/FoodTiffinPlan/FoodTiffinPlanScreen';
import FoodTiffinsScreen from '../screens/Food/Customer/FoodTiffins/FoodTiffinsScreen';
import FoodTiffinScreen from '../screens/Food/Customer/FoodTiffin/FoodTiffinScreen';
import FoodCateringFormScreen from '../screens/Food/Customer/FoodCateringForm/FoodCateringFormScreen';
import FoodCateringRequestsScreen from '../screens/Food/Customer/FoodCateringRequests/FoodCateringRequestsScreen';
import FoodCateringRequestScreen from '../screens/Food/Customer/FoodCateringRequest/FoodCateringRequestScreen';
import PantryScreen from '../screens/MyKitchen/Pantry/PantryScreen';
import RecipeIdeasScreen from '../screens/MyKitchen/RecipeIdeas/RecipeIdeasScreen';
import HomeRecipeScreen from '../screens/MyKitchen/HomeRecipe/HomeRecipeScreen';
import MissingItemsScreen from '../screens/MyKitchen/MissingItems/MissingItemsScreen';
import NutritionSettingsScreen from '../screens/MyKitchen/NutritionSettings/NutritionSettingsScreen';
import NutritionSummaryScreen from '../screens/MyKitchen/NutritionSummary/NutritionSummaryScreen';

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
  { title: ROUTES.FOOD_RATE_ORDER, component: FoodRateOrderScreen },
  { title: ROUTES.FOOD_REVIEWS, component: FoodReviewsScreen },
  // Bachat Box (Kitchen Intelligence)
  { title: ROUTES.FOOD_SURPLUS_LIST, component: FoodSurplusListScreen },
  { title: ROUTES.FOOD_SURPLUS, component: FoodSurplusScreen },
  { title: ROUTES.FOOD_SURPLUS_RESERVED, component: FoodSurplusReservedScreen },
  { title: ROUTES.FOOD_SURPLUS_RESERVATIONS, component: FoodSurplusReservationsScreen },
  // Tiffin and catering (5B)
  { title: ROUTES.FOOD_TIFFIN_PLAN, component: FoodTiffinPlanScreen },
  { title: ROUTES.FOOD_TIFFINS, component: FoodTiffinsScreen },
  { title: ROUTES.FOOD_TIFFIN, component: FoodTiffinScreen },
  { title: ROUTES.FOOD_CATERING_FORM, component: FoodCateringFormScreen },
  { title: ROUTES.FOOD_CATERING_REQUESTS, component: FoodCateringRequestsScreen },
  { title: ROUTES.FOOD_CATERING_REQUEST, component: FoodCateringRequestScreen },
  // My Kitchen and the customer's nutrition (5C)
  { title: ROUTES.MY_KITCHEN, component: PantryScreen },
  { title: ROUTES.MY_KITCHEN_RECIPES, component: RecipeIdeasScreen },
  { title: ROUTES.MY_KITCHEN_RECIPE, component: HomeRecipeScreen },
  { title: ROUTES.MY_KITCHEN_MISSING, component: MissingItemsScreen },
  { title: ROUTES.NUTRITION_SETTINGS, component: NutritionSettingsScreen },
  { title: ROUTES.NUTRITION_SUMMARY, component: NutritionSummaryScreen },
];
