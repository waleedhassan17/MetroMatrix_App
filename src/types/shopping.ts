// ═══════════════════════════════════════════════════════
// MetroMatrix — Shopping types (mirror docs/API_SHOPPING_ASSUMED.md)
// ═══════════════════════════════════════════════════════
// TODO(API_SHOPPING): reconcile with MetroMatrix-API docs/API_SHOPPING.md.
// Money is INTEGER rupees everywhere; format only with utils/money.formatPKR.

/** One page of a list: `GET …?page=&pageSize=` → `{ items, total, page, pageSize }`. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Catalogue ────────────────────────────────────────
export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  /** MaterialCommunityIcons glyph name, chosen by the API. */
  icon: string;
  parentId: string | null;
  productCount: number;
  children: ShopCategory[];
}

export type PaymentMethod = 'cod' | 'transfer';
export type PaymentAccountKind = 'raast' | 'jazzcash' | 'easypaisa' | 'bank';

export interface StoreSocials {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
}

export interface StorePolicies {
  shippingFee: number;
  /** Free delivery when the store's subtotal reaches this, or null. */
  freeShippingOver: number | null;
  nationwide: boolean;
  deliveryCities: string[];
  dispatchMinDays: number;
  dispatchMaxDays: number;
  returnWindowDays: number;
  codEnabled: boolean;
  codLimit: number | null;
  paymentMethods: PaymentMethod[];
}

export interface StoreSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  city: string;
  rating: number;
  ratingCount: number;
  freeShippingOver: number | null;
  isFeatured: boolean;
  isPaused: boolean;
  productCount: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  position: number;
}

export interface StoreDetail extends StoreSummary {
  about: string;
  socials: StoreSocials;
  phone: string | null;
  whatsapp: string | null;
  pauseMessage: string | null;
  policies: StorePolicies;
  collections: Collection[];
}

export interface ProductSummary {
  id: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  name: string;
  imageUrl: string | null;
  /** What the customer pays now. */
  price: number;
  /** The struck "was" price when on sale, else null. */
  compareAtPrice: number | null;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  isNew: boolean;
}

export interface ProductOption {
  name: string;
  values: string[];
  /** Colour option: value → hex swatch. */
  swatches: Record<string, string>;
}

export interface ProductVariant {
  id: string;
  option1: string | null;
  option2: string | null;
  sku: string;
  stock: number;
  price: number;
  compareAtPrice: number | null;
}

export interface ReviewReply {
  body: string;
  createdAt: string;
  editableUntil: string;
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string;
  photos: string[];
  authorName: string;
  verified: boolean;
  createdAt: string;
  reply: ReviewReply | null;
}

export interface ReviewSummary {
  average: number;
  count: number;
  /** counts[0] = 1★ … counts[4] = 5★ */
  counts: [number, number, number, number, number];
  withPhotos: number;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  images: string[];
  categoryId: string;
  collectionId: string | null;
  option1: ProductOption | null;
  option2: ProductOption | null;
  variants: ProductVariant[];
  lowStock: boolean;
  store: StoreDetail;
  reviewSummary: ReviewSummary;
  topReviews: Review[];
  related: ProductSummary[];
  wishlisted: boolean;
}

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'trending';

export interface ProductQuery {
  q?: string;
  storeId?: string;
  categoryId?: string;
  collectionId?: string;
  sort?: ProductSort;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  inStock?: boolean;
  onSale?: boolean;
}

export type BannerTarget =
  | { kind: 'store'; slug: string }
  | { kind: 'category'; id: string; name: string }
  | { kind: 'product'; id: string };

export interface Banner {
  id: string;
  imageUrl: string;
  headline: string;
  subhead: string | null;
  target: BannerTarget;
}

export interface ShopHome {
  banners: Banner[];
  categories: ShopCategory[];
  featuredStores: StoreSummary[];
  newThisWeek: ProductSummary[];
}

export interface SearchSuggestion {
  kind: 'product' | 'store' | 'category';
  id: string;
  label: string;
  /** What to search for when tapped (a corrected spelling, a store slug …). */
  query: string;
}

// ─── Bag ──────────────────────────────────────────────
export type CartWarningCode = 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'STORE_PAUSED';

export interface CartWarning {
  code: CartWarningCode;
  message: string;
  lineId: string | null;
  previousPrice: number | null;
  currentPrice: number | null;
  available: number | null;
}

export interface StoreRef {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  phone: string | null;
  whatsapp: string | null;
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  warnings: CartWarning[];
}

export interface CartGroup {
  store: StoreRef;
  isPaused: boolean;
  lines: CartLine[];
  subtotal: number;
  shippingFee: number;
  freeShippingOver: number | null;
  /** Rupees left until free delivery, or null. */
  toFreeShipping: number | null;
  warnings: CartWarning[];
}

export interface Cart {
  groups: CartGroup[];
  itemCount: number;
  itemsTotal: number;
  shippingTotal: number;
  total: number;
  /** Warnings the customer must resolve (or acknowledge) before checkout. */
  blocking: boolean;
}

// ─── Addresses ────────────────────────────────────────
export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  label: AddressLabel;
  fullName: string;
  /** +92… */
  phone: string;
  city: string;
  area: string;
  line1: string;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

// ─── Checkout ─────────────────────────────────────────
export interface CheckoutStoreInput {
  storeId: string;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  note: string | null;
}

export interface CheckoutInput {
  addressId: string;
  stores: CheckoutStoreInput[];
}

export interface ApiIssue {
  code: string;
  message: string;
}

export interface PaymentOption {
  method: PaymentMethod;
  available: boolean;
  /** Why it is off ("Cash on delivery up to Rs 15,000"), when it is. */
  reason: string | null;
}

export interface PreviewStore {
  store: StoreRef;
  lineCount: number;
  lines: CartLine[];
  itemsTotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  couponError: ApiIssue | null;
  paymentOptions: PaymentOption[];
  paymentMethod: PaymentMethod;
  error: ApiIssue | null;
  dispatchMinDays: number;
  dispatchMaxDays: number;
}

export interface CheckoutPreview {
  stores: PreviewStore[];
  itemsTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  canPlace: boolean;
}

export interface AvailableCoupon {
  code: string;
  label: string;
  minOrder: number | null;
  endsAt: string | null;
  /** Rupees still needed to use it, or 0 when it applies. */
  shortBy: number;
}

// ─── Orders ───────────────────────────────────────────
export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'cancellation_requested'
  | 'returned';

export type PaymentStatus =
  | 'cod_pending'
  | 'awaiting_transfer'
  | 'proof_submitted'
  | 'proof_rejected'
  | 'paid'
  | 'cash_collected'
  | 'refunded';

export type OrderEventType =
  | OrderStatus
  | 'payment_proof_submitted'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'cash_collected'
  | 'return_requested';

export type CourierKey = 'tcs' | 'leopards' | 'mnp' | 'postex' | 'trax' | 'own_rider' | 'other';

export interface OrderEvent {
  type: OrderEventType;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  courier: CourierKey;
  courierName: string;
  trackingRef: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  reviewed: boolean;
  /** How many can still be returned. */
  returnableQuantity: number;
}

export interface PaymentInstructions {
  kind: PaymentAccountKind;
  accountTitle: string;
  accountNumber: string;
  bankName: string | null;
  amount: number;
  payBy: string;
}

export interface PaymentProof {
  transactionId: string;
  imageUrl: string | null;
  submittedAt: string;
  rejectionReason: string | null;
}

export interface StoreOrder {
  id: string;
  code: string;
  groupCode: string;
  store: StoreRef;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  itemsTotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  note: string | null;
  shipment: Shipment | null;
  events: OrderEvent[];
  paymentInstructions: PaymentInstructions | null;
  paymentProof: PaymentProof | null;
  returnWindowEndsAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  deliveredAt: string | null;
  canCancel: boolean;
  canRequestCancel: boolean;
  canConfirmReceived: boolean;
  canReturn: boolean;
  canReview: boolean;
}

export interface OrderGroup {
  code: string;
  createdAt: string;
  address: Address;
  orders: StoreOrder[];
  itemsTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
}

export interface OrderGroupSummary {
  code: string;
  createdAt: string;
  total: number;
  itemCount: number;
  stores: { name: string; logoUrl: string | null; brandColor: string }[];
  thumbnails: string[];
  orders: { status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod }[];
}

export type OrderSegment = 'active' | 'completed' | 'cancelled';

// ─── Returns & reviews ────────────────────────────────
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';
export type ReturnReason = 'size_issue' | 'damaged' | 'wrong_item' | 'not_as_described' | 'changed_mind';

export interface ReturnItem {
  orderItemId: string;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderCode: string;
  storeName: string;
  status: ReturnStatus;
  reason: ReturnReason;
  details: string;
  photos: string[];
  items: ReturnItem[];
  storeNote: string | null;
  refund: { amount: number; reference: string; recordedAt: string } | null;
  createdAt: string;
  customerName: string;
}

export interface ReturnInput {
  items: { orderItemId: string; quantity: number }[];
  reason: ReturnReason;
  details: string;
  photos: string[];
}

export interface ReviewInput {
  rating: number;
  title: string | null;
  body: string;
  photos: string[];
}

// ─── Notifications ────────────────────────────────────
export type NotificationType =
  | 'order_placed'
  | 'order_update'
  | 'payment_update'
  | 'return_update'
  | 'review_reply'
  | 'new_order'
  | 'payment_proof'
  | 'return_requested'
  | 'low_stock';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { groupCode: string | null; orderId: string | null; returnId: string | null; productId: string | null };
  isRead: boolean;
  createdAt: string;
}

// ─── Store partner ────────────────────────────────────
export interface PartnerSummary {
  storeName: string;
  storeSlug: string;
  isPaused: boolean;
  pauseMessage: string | null;
  counts: { newOrders: number; toShip: number; paymentsToConfirm: number; returnsOpen: number; lowStock: number };
  /** Recorded sales per day for the last 7 days, oldest first. */
  sales7d: { date: string; amount: number }[];
  recordedSales7d: number;
}

export type PartnerOrderSegment = 'new' | 'to_pack' | 'to_ship' | 'shipped' | 'done' | 'cancelled';

export interface PartnerOrderRow {
  id: string;
  code: string;
  customerFirstName: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export type PartnerOrderAction =
  | 'confirm'
  | 'pack'
  | 'ship'
  | 'deliver'
  | 'cancel'
  | 'confirm_payment'
  | 'reject_payment'
  | 'cash_collected'
  | 'approve_cancellation';

export interface PartnerOrderDetail extends StoreOrder {
  customer: { name: string; phone: string };
  address: Address;
  internalNote: string | null;
  allowedActions: PartnerOrderAction[];
  /** Why ship is not offered, when it isn't ("Confirm the transfer first"). */
  shipBlockedReason: string | null;
}

export type PartnerProductStatus = 'draft' | 'active' | 'archived';

export interface PartnerProductRow {
  id: string;
  name: string;
  status: PartnerProductStatus;
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
  totalStock: number;
  variantCount: number;
  lowStock: boolean;
  updatedAt: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
}

export interface PartnerVariantInput {
  id: string | null;
  option1: string | null;
  option2: string | null;
  sku: string;
  stock: number;
  priceDelta: number;
}

export interface PartnerProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  collectionId: string | null;
  price: number;
  salePrice: number | null;
  status: PartnerProductStatus;
  images: ProductImage[];
  option1: { name: string; values: string[] } | null;
  option2: { name: string; values: string[]; swatches: Record<string, string> } | null;
  variants: PartnerVariantInput[];
  updatedAt: string;
}

export type PartnerProductInput = Omit<PartnerProduct, 'id' | 'updatedAt'>;

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  stock: number;
  lowStock: boolean;
  imageUrl: string | null;
}

export type MovementReason = 'initial' | 'manual' | 'bulk' | 'order' | 'cancel' | 'return_restock';

export interface InventoryMovement {
  id: string;
  delta: number;
  stockAfter: number;
  reason: MovementReason;
  note: string | null;
  createdAt: string;
}

export type CouponType = 'percent' | 'fixed';
export type CouponStatus = 'active' | 'scheduled' | 'expired' | 'used_up' | 'inactive';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  isActive: boolean;
  status: CouponStatus;
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount' | 'status'>;

export interface PartnerReview extends Review {
  productName: string;
  productImage: string | null;
}

export type InsightsRange = '7d' | '30d' | '90d';

export interface Insights {
  range: InsightsRange;
  orders: { date: string; count: number }[];
  sales: { date: string; amount: number }[];
  recordedSales: number;
  orderCount: number;
  topProducts: { productId: string; name: string; imageUrl: string | null; units: number; amount: number }[];
  repeatCustomerPct: number;
  deliveredRatePct: number;
}

export interface StoreProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  socials: StoreSocials;
  phone: string | null;
  whatsapp: string | null;
}

export type StoreProfileInput = Omit<StoreProfile, 'id' | 'slug' | 'name'>;

export interface StoreSettings {
  shippingFee: number;
  freeShippingOver: number | null;
  nationwide: boolean;
  deliveryCities: string[];
  dispatchMinDays: number;
  dispatchMaxDays: number;
  returnWindowDays: number;
  codEnabled: boolean;
  codLimit: number | null;
  isPaused: boolean;
  pauseMessage: string | null;
}

export interface PaymentAccount {
  id: string;
  kind: PaymentAccountKind;
  title: string;
  number: string;
  bankName: string | null;
  isActive: boolean;
}

export type PaymentAccountInput = Omit<PaymentAccount, 'id'>;

// ─── Admin ────────────────────────────────────────────
export interface ShopOverview {
  stores: number;
  activeProducts: number;
  openReports: number;
  ordersToday: number;
}

export interface AdminBanner extends Banner {
  startsAt: string;
  endsAt: string | null;
  position: number;
  isActive: boolean;
}

export type AdminBannerInput = Omit<AdminBanner, 'id'>;

export type ReportStatus = 'open' | 'dismissed' | 'removed';

export interface ProductReport {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  storeName: string;
  reason: string;
  details: string | null;
  reportCount: number;
  status: ReportStatus;
  createdAt: string;
}

export interface AdminOrderLookup {
  group: OrderGroup;
  customer: { name: string; email: string };
}
