// ═══════════════════════════════════════════════════════
// MetroMatrix — The Food vendor's app (restaurant, home or cloud kitchen)
// ═══════════════════════════════════════════════════════
// Orders · Menu · Kitchen · Riders · More at the root of a stack (a home
// kitchen: Today · Orders · Kitchen · More); every tool pushes over the tabs. Until the kitchen is live the
// stack opens on Kitchen setup instead (sessionGate.foodVendorRootRoute).

import type { IRoute, ITabRoute } from './types';
import { ROUTES } from './Base';

import VendorOrders from '../screens/vendor-orders-screen/VendorOrders';
import VendorMenu from '../screens/vendor-menu-screen/VendorMenu';
import VendorRiders from '../screens/vendor-riders-screen/VendorRiders';
import VendorMore from '../screens/vendor-more-screen/VendorMore';
import VendorSetup from '../screens/vendor-setup-screen/VendorSetup';
import VendorBrand from '../screens/vendor-brand-screen/VendorBrand';
import VendorSettings from '../screens/vendor-settings-screen/VendorSettings';
import VendorHours from '../screens/vendor-hours-screen/VendorHours';
import VendorZones from '../screens/vendor-zones-screen/VendorZones';
import VendorClosures from '../screens/vendor-closures-screen/VendorClosures';
import VendorPlan from '../screens/vendor-plan-screen/VendorPlan';
import RiderDetail from '../screens/rider-detail-screen/RiderDetail';
import VendorToday from '../screens/vendor-today-screen/VendorToday';
import VendorMenuItem from '../screens/vendor-menu-item-screen/VendorMenuItem';
import VendorCategories from '../screens/vendor-categories-screen/VendorCategories';
import VendorOptionGroups from '../screens/vendor-option-groups-screen/VendorOptionGroups';
import VendorOptionGroup from '../screens/vendor-option-group-screen/VendorOptionGroup';
import VendorWeeklyMenu from '../screens/vendor-weekly-menu-screen/VendorWeeklyMenu';
import VendorPreorderSlots from '../screens/vendor-preorder-slots-screen/VendorPreorderSlots';
import VendorPromotions from '../screens/vendor-promotions-screen/VendorPromotions';
import VendorPromotion from '../screens/vendor-promotion-screen/VendorPromotion';
import VendorReviews from '../screens/vendor-reviews-screen/VendorReviews';
import VendorInsights from '../screens/vendor-insights-screen/VendorInsights';
import VendorOrder from '../screens/vendor-order-screen/VendorOrder';
import PaymentAccounts from '../screens/payment-accounts-screen/PaymentAccounts';
import Profile from '../screens/profile-screen/Profile';
import { VendorMenuPageScreen, VendorRidersPageScreen } from '../screens/vendor-pages-screen/VendorPages';
// Kitchen Intelligence (Chunk 5)
import KitchenHub from '../screens/kitchen-hub-screen/KitchenHub';
import Stock from '../screens/stock-screen/Stock';
import StockTake from '../screens/stock-take-screen/StockTake';
import Ingredient from '../screens/ingredient-screen/Ingredient';
import IngredientForm from '../screens/ingredient-form-screen/IngredientForm';
import RecipesAndCosts from '../screens/recipes-and-costs-screen/RecipesAndCosts';
import RecipeEditor from '../screens/recipe-editor-screen/RecipeEditor';
import KitchenSettings from '../screens/kitchen-settings-screen/KitchenSettings';
import Purchases from '../screens/purchases-screen/Purchases';
import Purchase from '../screens/purchase-screen/Purchase';
import PurchaseForm from '../screens/purchase-form-screen/PurchaseForm';
import Suppliers from '../screens/suppliers-screen/Suppliers';
import PriceWatch from '../screens/price-watch-screen/PriceWatch';
import ForecastAndPrep from '../screens/forecast-and-prep-screen/ForecastAndPrep';
import WasteAndSurplus from '../screens/waste-and-surplus-screen/WasteAndSurplus';
import WasteForm from '../screens/waste-form-screen/WasteForm';
import BoxForm from '../screens/box-form-screen/BoxForm';
import Box from '../screens/box-screen/Box';
import Donations from '../screens/donations-screen/Donations';
// Growth (5B)
import TiffinPlans from '../screens/tiffin-plans-screen/TiffinPlans';
import TiffinPlanForm from '../screens/tiffin-plan-form-screen/TiffinPlanForm';
import TiffinSubscribers from '../screens/tiffin-subscribers-screen/TiffinSubscribers';
import Catering from '../screens/catering-screen/Catering';
import CateringRequest from '../screens/catering-request-screen/CateringRequest';
import QuoteBuilder from '../screens/quote-builder-screen/QuoteBuilder';
import Assistant from '../screens/assistant-screen/Assistant';
import AiDescriptions from '../screens/ai-descriptions-screen/AiDescriptions';
import AiSpecials from '../screens/ai-specials-screen/AiSpecials';
import AiCombos from '../screens/ai-combos-screen/AiCombos';
import AiPhotoCheck from '../screens/ai-photo-check-screen/AiPhotoCheck';
import ReviewInsights from '../screens/review-insights-screen/ReviewInsights';
import ReviewTheme from '../screens/review-theme-screen/ReviewTheme';
import NutritionVendor from '../screens/nutrition-vendor-screen/NutritionVendor';
import RamadanMode from '../screens/ramadan-mode-screen/RamadanMode';
import Storefront from '../screens/storefront-screen/Storefront';
import DemandMap from '../screens/demand-map-screen/DemandMap';
import MenuInsights from '../screens/menu-insights-screen/MenuInsights';
import MenuExperiment from '../screens/menu-experiment-screen/MenuExperiment';
import StoryAndHygiene from '../screens/story-and-hygiene-screen/StoryAndHygiene';
import ChangePassword from '../screens/change-password-screen/ChangePassword';
import Notifications from '../screens/notifications-screen/Notifications';

const ORDERS: ITabRoute = { title: ROUTES.ORDERS_TAB, component: VendorOrders, label: 'Orders', icon: 'receipt-outline', iconActive: 'receipt' };
const KITCHEN: ITabRoute = { title: ROUTES.KITCHEN_TAB, component: KitchenHub, label: 'Kitchen', icon: 'flame-outline', iconActive: 'flame' };
const MORE: ITabRoute = { title: ROUTES.MORE_TAB, component: VendorMore, label: 'More', icon: 'grid-outline', iconActive: 'grid' };

export const FOOD_VENDOR_TABS: ITabRoute[] = [
  ORDERS,
  { title: ROUTES.MENU_TAB, component: VendorMenu, label: 'Menu', icon: 'book-outline', iconActive: 'book' },
  KITCHEN,
  { title: ROUTES.RIDERS_TAB, component: VendorRiders, label: 'Riders', icon: 'bicycle-outline', iconActive: 'bicycle' },
  MORE,
];

/**
 * A home kitchen's day comes first: what is cooking and how many plates.
 * Its Menu and Riders open from More (VendorMenuPage, VendorRidersPage).
 */
export const FOOD_VENDOR_HOME_TABS: ITabRoute[] = [
  { title: ROUTES.TODAY_TAB, component: VendorToday, label: 'Today', icon: 'today-outline', iconActive: 'today' },
  ORDERS,
  KITCHEN,
  MORE,
];

/** Pushed over the tabs (the tabs, or Kitchen setup, are the stack's first screen). */
export const FOOD_VENDOR_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.VENDOR_SETUP, component: VendorSetup },
  { title: ROUTES.VENDOR_BRAND, component: VendorBrand },
  { title: ROUTES.VENDOR_SETTINGS, component: VendorSettings },
  { title: ROUTES.VENDOR_HOURS, component: VendorHours },
  { title: ROUTES.VENDOR_ZONES, component: VendorZones },
  { title: ROUTES.VENDOR_CLOSURES, component: VendorClosures },
  { title: ROUTES.VENDOR_PLAN, component: VendorPlan },
  { title: ROUTES.VENDOR_RIDER_DETAIL, component: RiderDetail },
  { title: ROUTES.VENDOR_MENU_ITEM, component: VendorMenuItem },
  { title: ROUTES.VENDOR_CATEGORIES, component: VendorCategories },
  { title: ROUTES.VENDOR_OPTION_GROUPS, component: VendorOptionGroups },
  { title: ROUTES.VENDOR_OPTION_GROUP, component: VendorOptionGroup },
  { title: ROUTES.VENDOR_WEEKLY_MENU, component: VendorWeeklyMenu },
  { title: ROUTES.VENDOR_PREORDER_SLOTS, component: VendorPreorderSlots },
  { title: ROUTES.VENDOR_PROMOTIONS, component: VendorPromotions },
  { title: ROUTES.VENDOR_PROMOTION, component: VendorPromotion },
  { title: ROUTES.VENDOR_REVIEWS, component: VendorReviews },
  { title: ROUTES.VENDOR_INSIGHTS, component: VendorInsights },
  { title: ROUTES.VENDOR_ORDER, component: VendorOrder },
  { title: ROUTES.VENDOR_MENU_PAGE, component: VendorMenuPageScreen },
  { title: ROUTES.VENDOR_RIDERS_PAGE, component: VendorRidersPageScreen },
  // ── Kitchen ──
  { title: ROUTES.KITCHEN_STOCK, component: Stock },
  { title: ROUTES.KITCHEN_STOCK_TAKE, component: StockTake },
  { title: ROUTES.KITCHEN_INGREDIENT, component: Ingredient },
  { title: ROUTES.KITCHEN_INGREDIENT_FORM, component: IngredientForm },
  { title: ROUTES.KITCHEN_RECIPES, component: RecipesAndCosts },
  { title: ROUTES.KITCHEN_RECIPE, component: RecipeEditor },
  { title: ROUTES.KITCHEN_SETTINGS, component: KitchenSettings },
  { title: ROUTES.KITCHEN_PURCHASES, component: Purchases },
  { title: ROUTES.KITCHEN_PURCHASE, component: Purchase },
  { title: ROUTES.KITCHEN_PURCHASE_FORM, component: PurchaseForm },
  { title: ROUTES.KITCHEN_SUPPLIERS, component: Suppliers },
  { title: ROUTES.KITCHEN_PRICE_WATCH, component: PriceWatch },
  { title: ROUTES.KITCHEN_FORECAST, component: ForecastAndPrep },
  { title: ROUTES.KITCHEN_WASTE, component: WasteAndSurplus },
  { title: ROUTES.KITCHEN_WASTE_FORM, component: WasteForm },
  { title: ROUTES.KITCHEN_BOX_FORM, component: BoxForm },
  { title: ROUTES.KITCHEN_BOX, component: Box },
  { title: ROUTES.KITCHEN_DONATIONS, component: Donations },
  // ── Growth ──
  { title: ROUTES.GROWTH_TIFFIN, component: TiffinPlans },
  { title: ROUTES.GROWTH_TIFFIN_PLAN_FORM, component: TiffinPlanForm },
  { title: ROUTES.GROWTH_TIFFIN_SUBSCRIBERS, component: TiffinSubscribers },
  { title: ROUTES.GROWTH_CATERING, component: Catering },
  { title: ROUTES.GROWTH_CATERING_REQUEST, component: CateringRequest },
  { title: ROUTES.GROWTH_QUOTE, component: QuoteBuilder },
  { title: ROUTES.GROWTH_RAMADAN, component: RamadanMode },
  { title: ROUTES.GROWTH_STOREFRONT, component: Storefront },
  { title: ROUTES.GROWTH_DEMAND, component: DemandMap },
  { title: ROUTES.GROWTH_MENU_INSIGHTS, component: MenuInsights },
  { title: ROUTES.GROWTH_EXPERIMENT, component: MenuExperiment },
  { title: ROUTES.GROWTH_STORY, component: StoryAndHygiene },
  // ── The assistant (5C) ──
  { title: ROUTES.KITCHEN_ASSISTANT, component: Assistant },
  { title: ROUTES.KITCHEN_AI_DESCRIPTIONS, component: AiDescriptions },
  { title: ROUTES.KITCHEN_AI_SPECIALS, component: AiSpecials },
  { title: ROUTES.KITCHEN_AI_COMBOS, component: AiCombos },
  { title: ROUTES.KITCHEN_AI_PHOTO_CHECK, component: AiPhotoCheck },
  { title: ROUTES.KITCHEN_REVIEW_INSIGHTS, component: ReviewInsights },
  { title: ROUTES.KITCHEN_REVIEW_THEME, component: ReviewTheme },
  { title: ROUTES.KITCHEN_NUTRITION, component: NutritionVendor },
  { title: ROUTES.PAYMENT_ACCOUNTS, component: PaymentAccounts },
  { title: ROUTES.PROFILE, component: Profile },
  { title: ROUTES.CHANGE_PASSWORD, component: ChangePassword },
  { title: ROUTES.NOTIFICATIONS, component: Notifications },
];
