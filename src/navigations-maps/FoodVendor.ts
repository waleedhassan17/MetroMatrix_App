// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food vendor's app (restaurant, home or cloud kitchen)
// ═══════════════════════════════════════════════════════
// Orders · Menu · Kitchen · Riders · More at the root of a stack (a home
// kitchen: Today · Orders · Kitchen · More); every tool pushes over the tabs. Until the kitchen is live the
// stack opens on Kitchen setup instead (sessionGate.foodVendorRootRoute).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import VendorOrdersScreen from '../screens/Food/Vendor/VendorOrders/VendorOrdersScreen';
import VendorMenuScreen from '../screens/Food/Vendor/VendorMenu/VendorMenuScreen';
import VendorRidersScreen from '../screens/Food/Vendor/VendorRiders/VendorRidersScreen';
import VendorMoreScreen from '../screens/Food/Vendor/VendorMore/VendorMoreScreen';
import VendorSetupScreen from '../screens/Food/Vendor/VendorSetup/VendorSetupScreen';
import VendorBrandScreen from '../screens/Food/Vendor/VendorBrand/VendorBrandScreen';
import VendorSettingsScreen from '../screens/Food/Vendor/VendorSettings/VendorSettingsScreen';
import VendorHoursScreen from '../screens/Food/Vendor/VendorHours/VendorHoursScreen';
import VendorZonesScreen from '../screens/Food/Vendor/VendorZones/VendorZonesScreen';
import VendorClosuresScreen from '../screens/Food/Vendor/VendorClosures/VendorClosuresScreen';
import VendorPlanScreen from '../screens/Food/Vendor/VendorPlan/VendorPlanScreen';
import RiderDetailScreen from '../screens/Food/Vendor/RiderDetail/RiderDetailScreen';
import VendorTodayScreen from '../screens/Food/Vendor/VendorToday/VendorTodayScreen';
import VendorMenuItemScreen from '../screens/Food/Vendor/VendorMenuItem/VendorMenuItemScreen';
import VendorCategoriesScreen from '../screens/Food/Vendor/VendorCategories/VendorCategoriesScreen';
import VendorOptionGroupsScreen from '../screens/Food/Vendor/VendorOptionGroups/VendorOptionGroupsScreen';
import VendorOptionGroupScreen from '../screens/Food/Vendor/VendorOptionGroup/VendorOptionGroupScreen';
import VendorWeeklyMenuScreen from '../screens/Food/Vendor/VendorWeeklyMenu/VendorWeeklyMenuScreen';
import VendorPreorderSlotsScreen from '../screens/Food/Vendor/VendorPreorderSlots/VendorPreorderSlotsScreen';
import VendorPromotionsScreen from '../screens/Food/Vendor/VendorPromotions/VendorPromotionsScreen';
import VendorPromotionScreen from '../screens/Food/Vendor/VendorPromotion/VendorPromotionScreen';
import VendorReviewsScreen from '../screens/Food/Vendor/VendorReviews/VendorReviewsScreen';
import VendorInsightsScreen from '../screens/Food/Vendor/VendorInsights/VendorInsightsScreen';
import VendorOrderScreen from '../screens/Food/Vendor/VendorOrder/VendorOrderScreen';
import PaymentAccountsScreen from '../screens/Shopping/Store/PaymentAccounts/PaymentAccountsScreen';
import ProfileScreen from '../screens/Account/Profile/ProfileScreen';
import { VendorMenuPageScreen, VendorRidersPageScreen } from '../screens/Food/Vendor/VendorPages/VendorPagesScreen';
// Kitchen Intelligence (Chunk 5)
import KitchenHubScreen from '../screens/Food/Kitchen/KitchenHub/KitchenHubScreen';
import StockScreen from '../screens/Food/Kitchen/Stock/StockScreen';
import StockTakeScreen from '../screens/Food/Kitchen/StockTake/StockTakeScreen';
import IngredientScreen from '../screens/Food/Kitchen/Ingredient/IngredientScreen';
import IngredientFormScreen from '../screens/Food/Kitchen/IngredientForm/IngredientFormScreen';
import RecipesAndCostsScreen from '../screens/Food/Kitchen/RecipesAndCosts/RecipesAndCostsScreen';
import RecipeEditorScreen from '../screens/Food/Kitchen/RecipeEditor/RecipeEditorScreen';
import KitchenSettingsScreen from '../screens/Food/Kitchen/KitchenSettings/KitchenSettingsScreen';
import PurchasesScreen from '../screens/Food/Kitchen/Purchases/PurchasesScreen';
import PurchaseScreen from '../screens/Food/Kitchen/Purchase/PurchaseScreen';
import PurchaseFormScreen from '../screens/Food/Kitchen/PurchaseForm/PurchaseFormScreen';
import SuppliersScreen from '../screens/Food/Kitchen/Suppliers/SuppliersScreen';
import PriceWatchScreen from '../screens/Food/Kitchen/PriceWatch/PriceWatchScreen';
import ForecastAndPrepScreen from '../screens/Food/Kitchen/ForecastAndPrep/ForecastAndPrepScreen';
import WasteAndSurplusScreen from '../screens/Food/Kitchen/WasteAndSurplus/WasteAndSurplusScreen';
import WasteFormScreen from '../screens/Food/Kitchen/WasteForm/WasteFormScreen';
import BoxFormScreen from '../screens/Food/Kitchen/BoxForm/BoxFormScreen';
import BoxScreen from '../screens/Food/Kitchen/Box/BoxScreen';
import DonationsScreen from '../screens/Food/Kitchen/Donations/DonationsScreen';
// Growth (5B)
import TiffinPlansScreen from '../screens/Food/Growth/TiffinPlans/TiffinPlansScreen';
import TiffinPlanFormScreen from '../screens/Food/Growth/TiffinPlanForm/TiffinPlanFormScreen';
import TiffinSubscribersScreen from '../screens/Food/Growth/TiffinSubscribers/TiffinSubscribersScreen';
import CateringScreen from '../screens/Food/Growth/Catering/CateringScreen';
import CateringRequestScreen from '../screens/Food/Growth/CateringRequest/CateringRequestScreen';
import QuoteBuilderScreen from '../screens/Food/Growth/QuoteBuilder/QuoteBuilderScreen';
import ChangePasswordScreen from '../screens/Account/ChangePassword/ChangePasswordScreen';
import NotificationsScreen from '../screens/Account/Notifications/NotificationsScreen';

const ORDERS: ITabRoute = { title: ROUTES.ORDERS_TAB, component: VendorOrdersScreen, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' };
const KITCHEN: ITabRoute = { title: ROUTES.KITCHEN_TAB, component: KitchenHubScreen, label: 'Kitchen', icon: 'flame-outline', iconActive: 'flame' };
const MORE: ITabRoute = { title: ROUTES.MORE_TAB, component: VendorMoreScreen, label: 'More', icon: 'grid-outline', iconActive: 'grid' };

export const FOOD_VENDOR_TABS: ITabRoute[] = [
  ORDERS,
  { title: ROUTES.MENU_TAB, component: VendorMenuScreen, label: 'Menu', icon: 'book-outline', iconActive: 'book' },
  KITCHEN,
  { title: ROUTES.RIDERS_TAB, component: VendorRidersScreen, label: 'Riders', icon: 'bicycle-outline', iconActive: 'bicycle' },
  MORE,
];

/**
 * A home kitchen's day comes first: what is cooking and how many plates.
 * Its Menu and Riders open from More (VendorMenuPage, VendorRidersPage).
 */
export const FOOD_VENDOR_HOME_TABS: ITabRoute[] = [
  { title: ROUTES.TODAY_TAB, component: VendorTodayScreen, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  ORDERS,
  KITCHEN,
  MORE,
];

/** Pushed over the tabs (the tabs, or Kitchen setup, are the stack's first screen). */
export const FOOD_VENDOR_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.VENDOR_SETUP, component: VendorSetupScreen },
  { title: ROUTES.VENDOR_BRAND, component: VendorBrandScreen },
  { title: ROUTES.VENDOR_SETTINGS, component: VendorSettingsScreen },
  { title: ROUTES.VENDOR_HOURS, component: VendorHoursScreen },
  { title: ROUTES.VENDOR_ZONES, component: VendorZonesScreen },
  { title: ROUTES.VENDOR_CLOSURES, component: VendorClosuresScreen },
  { title: ROUTES.VENDOR_PLAN, component: VendorPlanScreen },
  { title: ROUTES.VENDOR_RIDER_DETAIL, component: RiderDetailScreen },
  { title: ROUTES.VENDOR_MENU_ITEM, component: VendorMenuItemScreen },
  { title: ROUTES.VENDOR_CATEGORIES, component: VendorCategoriesScreen },
  { title: ROUTES.VENDOR_OPTION_GROUPS, component: VendorOptionGroupsScreen },
  { title: ROUTES.VENDOR_OPTION_GROUP, component: VendorOptionGroupScreen },
  { title: ROUTES.VENDOR_WEEKLY_MENU, component: VendorWeeklyMenuScreen },
  { title: ROUTES.VENDOR_PREORDER_SLOTS, component: VendorPreorderSlotsScreen },
  { title: ROUTES.VENDOR_PROMOTIONS, component: VendorPromotionsScreen },
  { title: ROUTES.VENDOR_PROMOTION, component: VendorPromotionScreen },
  { title: ROUTES.VENDOR_REVIEWS, component: VendorReviewsScreen },
  { title: ROUTES.VENDOR_INSIGHTS, component: VendorInsightsScreen },
  { title: ROUTES.VENDOR_ORDER, component: VendorOrderScreen },
  { title: ROUTES.VENDOR_MENU_PAGE, component: VendorMenuPageScreen },
  { title: ROUTES.VENDOR_RIDERS_PAGE, component: VendorRidersPageScreen },
  // ── Kitchen ──
  { title: ROUTES.KITCHEN_STOCK, component: StockScreen },
  { title: ROUTES.KITCHEN_STOCK_TAKE, component: StockTakeScreen },
  { title: ROUTES.KITCHEN_INGREDIENT, component: IngredientScreen },
  { title: ROUTES.KITCHEN_INGREDIENT_FORM, component: IngredientFormScreen },
  { title: ROUTES.KITCHEN_RECIPES, component: RecipesAndCostsScreen },
  { title: ROUTES.KITCHEN_RECIPE, component: RecipeEditorScreen },
  { title: ROUTES.KITCHEN_SETTINGS, component: KitchenSettingsScreen },
  { title: ROUTES.KITCHEN_PURCHASES, component: PurchasesScreen },
  { title: ROUTES.KITCHEN_PURCHASE, component: PurchaseScreen },
  { title: ROUTES.KITCHEN_PURCHASE_FORM, component: PurchaseFormScreen },
  { title: ROUTES.KITCHEN_SUPPLIERS, component: SuppliersScreen },
  { title: ROUTES.KITCHEN_PRICE_WATCH, component: PriceWatchScreen },
  { title: ROUTES.KITCHEN_FORECAST, component: ForecastAndPrepScreen },
  { title: ROUTES.KITCHEN_WASTE, component: WasteAndSurplusScreen },
  { title: ROUTES.KITCHEN_WASTE_FORM, component: WasteFormScreen },
  { title: ROUTES.KITCHEN_BOX_FORM, component: BoxFormScreen },
  { title: ROUTES.KITCHEN_BOX, component: BoxScreen },
  { title: ROUTES.KITCHEN_DONATIONS, component: DonationsScreen },
  // ── Growth ──
  { title: ROUTES.GROWTH_TIFFIN, component: TiffinPlansScreen },
  { title: ROUTES.GROWTH_TIFFIN_PLAN_FORM, component: TiffinPlanFormScreen },
  { title: ROUTES.GROWTH_TIFFIN_SUBSCRIBERS, component: TiffinSubscribersScreen },
  { title: ROUTES.GROWTH_CATERING, component: CateringScreen },
  { title: ROUTES.GROWTH_CATERING_REQUEST, component: CateringRequestScreen },
  { title: ROUTES.GROWTH_QUOTE, component: QuoteBuilderScreen },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccountsScreen },
  { title: ROUTES.PROFILE, component: ProfileScreen },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePasswordScreen },
  { title: ROUTES.NOTIFICATIONS, component: NotificationsScreen },
];
