// ═══════════════════════════════════════════════════════
// MetroMatrix — Dummy shop records (what the mock DB stores)
// ═══════════════════════════════════════════════════════
// Internal shapes for the dummy API. Views (shopViews.ts) turn them into the
// wire JSON that docs/API_SHOPPING_ASSUMED.md describes.

import type {
  AddressLabel,
  BannerTarget,
  CouponType,
  CourierKey,
  MovementReason,
  NotificationType,
  OrderEventType,
  OrderStatus,
  PaymentAccountKind,
  PaymentMethod,
  PaymentStatus,
  ReportStatus,
  ReturnReason,
  ReturnStatus,
} from '../../../../models/shopping';

export interface MockStore {
  id: string;
  slug: string;
  ownerId: string;
  name: string;
  tagline: string;
  about: string;
  logoUrl: string | null;
  coverUrl: string | null;
  brandColor: string;
  onBrandColor: string;
  city: string;
  socials: { instagram: string | null; facebook: string | null; tiktok: string | null; website: string | null };
  phone: string | null;
  whatsapp: string | null;
  isFeatured: boolean;
  isPaused: boolean;
  pauseMessage: string | null;
  settings: {
    shippingFee: number;
    freeShippingOver: number | null;
    nationwide: boolean;
    deliveryCities: string[];
    dispatchMinDays: number;
    dispatchMaxDays: number;
    returnWindowDays: number;
    codEnabled: boolean;
    codLimit: number | null;
  };
  paymentAccounts: { id: string; kind: PaymentAccountKind; title: string; number: string; bankName: string | null; isActive: boolean }[];
  createdAt: string;
}

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parentId: string | null;
  position: number;
}

export interface MockCollection {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  position: number;
}

export interface MockVariant {
  id: string;
  option1: string | null;
  option2: string | null;
  sku: string;
  stock: number;
  priceDelta: number;
}

export interface MockProduct {
  id: string;
  storeId: string;
  name: string;
  description: string;
  categoryId: string | null;
  collectionId: string | null;
  price: number;
  salePrice: number | null;
  status: 'draft' | 'active' | 'archived';
  images: { url: string; publicId: string }[];
  option1: { name: string; values: string[] } | null;
  option2: { name: string; values: string[]; swatches: Record<string, string> } | null;
  variants: MockVariant[];
  /** Hidden by an admin after a report. */
  removed: boolean;
  trending: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Groceries (Daily Basket): what one unit holds, and the kitchen ingredient
   * it is. Kitchen Intelligence's price compare reads them (TODO(API_SHOPPING)).
   */
  netQuantity?: { qty: number; unit: 'g' | 'ml' | 'pc' };
  ingredientKey?: string;
}

export interface MockReview {
  id: string;
  productId: string;
  storeId: string;
  userId: string;
  authorName: string;
  orderItemId: string | null;
  rating: number;
  title: string | null;
  body: string;
  photos: string[];
  createdAt: string;
  reply: { body: string; createdAt: string } | null;
}

export interface MockCartLine {
  id: string;
  userId: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** The unit price the customer last saw (a change raises PRICE_CHANGED). */
  priceSeen: number;
  addedAt: string;
}

export interface MockAddress {
  id: string;
  userId: string;
  label: AddressLabel;
  fullName: string;
  phone: string;
  city: string;
  area: string;
  line1: string;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export interface MockOrderItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  returnedQty: number;
  reviewed: boolean;
}

export interface MockOrder {
  id: string;
  code: string;
  groupCode: string;
  userId: string;
  storeId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: MockOrderItem[];
  itemsTotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  note: string | null;
  shipment: { courier: CourierKey; trackingRef: string } | null;
  events: { type: OrderEventType; note: string | null; createdAt: string }[];
  paymentAccountId: string | null;
  payBy: string | null;
  paymentProof: { transactionId: string; imageUrl: string | null; submittedAt: string; rejectionReason: string | null } | null;
  cancelReason: string | null;
  internalNote: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface MockGroup {
  code: string;
  userId: string;
  address: MockAddress;
  orderIds: string[];
  createdAt: string;
}

export interface MockReturn {
  id: string;
  orderId: string;
  userId: string;
  storeId: string;
  status: ReturnStatus;
  reason: ReturnReason;
  details: string;
  photos: string[];
  items: { orderItemId: string; quantity: number }[];
  storeNote: string | null;
  refund: { amount: number; reference: string; recordedAt: string } | null;
  createdAt: string;
}

export interface MockCoupon {
  id: string;
  storeId: string;
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
  usedBy: Record<string, number>;
  isActive: boolean;
}

export interface MockMovement {
  id: string;
  variantId: string;
  delta: number;
  stockAfter: number;
  reason: MovementReason;
  note: string | null;
  createdAt: string;
}

export interface MockBanner {
  id: string;
  imageUrl: string;
  headline: string;
  subhead: string | null;
  target: BannerTarget;
  startsAt: string;
  endsAt: string | null;
  position: number;
  isActive: boolean;
}

export interface MockReport {
  id: string;
  productId: string;
  userId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface MockNotification {
  id: string;
  userId: string;
  /** Shopping's kinds, or a Health notice's real type (`health.appointment.new`, …). */
  type: NotificationType | `health.${string}`;
  title: string;
  body: string;
  data: {
    groupCode: string | null;
    orderId: string | null;
    returnId: string | null;
    productId: string | null;
    appointmentCode?: string | null;
    appointmentId?: string | null;
    prescriptionId?: string | null;
  };
  isRead: boolean;
  createdAt: string;
}

export interface MockShop {
  stores: MockStore[];
  categories: MockCategory[];
  collections: MockCollection[];
  products: MockProduct[];
  reviews: MockReview[];
  cart: MockCartLine[];
  wishlist: Record<string, string[]>;
  addresses: MockAddress[];
  orders: MockOrder[];
  groups: MockGroup[];
  returns: MockReturn[];
  coupons: MockCoupon[];
  movements: MockMovement[];
  banners: MockBanner[];
  reports: MockReport[];
  notifications: MockNotification[];
  /** user|key → the first response to that checkout. */
  idempotency: Record<string, { status: number; payload: unknown }>;
  seq: number;
}
