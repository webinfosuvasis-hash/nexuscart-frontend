// ─── Core Entity Types ────────────────────────────────────────────────────────

export type BusinessType = 'fashion' | 'electronics' | 'furniture' | 'grocery' | 'cosmetics' | 'gifts' | 'lifestyle';
export type PlanTier = 'starter' | 'growth' | 'pro' | 'enterprise';
export type StoreStatus = 'active' | 'suspended' | 'trial';

export interface Store {
  id: string;
  name: string;
  slug: string;
  domain: string;
  customDomain?: string;
  businessType: BusinessType;
  plan: PlanTier;
  status: StoreStatus;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  revenue: number;
  orders: number;
  products: number;
  createdAt: string;
  trialEndsAt?: string;
  logo?: string;
  settings: StoreSettings;
}

export interface StoreSettings {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  currency: string;
  language: string;
  timezone: string;
  taxEnabled: boolean;
  taxRate: number;
  metaTitle?: string;
  metaDescription?: string;
  socialLinks?: SocialLinks;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

// ─── Product Types ────────────────────────────────────────────────────────────

export type ProductStatus = 'Active' | 'Draft' | 'Archived';

export interface Product {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  comparePrice?: number;
  costPrice?: number;
  category: string;
  categoryId?: string;
  brand?: string;
  brandId?: string;
  stock: number;
  sku: string;
  barcode?: string;
  weight?: number;
  dimensions?: Dimensions;
  status: ProductStatus;
  sales: number;
  rating: number;
  reviewCount?: number;
  featured: boolean;
  image: string;
  images?: string[];
  tags?: string[];
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  seo?: SEOMeta;
  collections?: string[];
  taxable?: boolean;
  requiresShipping?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  comparePrice?: number;
  stock: number;
  options: Record<string, string>;
  image?: string;
  barcode?: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  values: string[];
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

// ─── Category Types ───────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  count: number;
  level: number;
  parentId?: number;
  children?: Category[];
  image?: string;
  banner?: string;
  seo?: SEOMeta;
  attributes?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  conditions?: CollectionCondition[];
  isManual: boolean;
  productCount: number;
  isActive: boolean;
}

export interface CollectionCondition {
  field: string;
  operator: string;
  value: string;
}

// ─── Inventory Types ──────────────────────────────────────────────────────────

export type WarehouseStatus = 'Operational' | 'Low Capacity' | 'Closed';

export interface Warehouse {
  id: number;
  name: string;
  location: string;
  address?: string;
  stock: number;
  capacity: number;
  status: WarehouseStatus;
  manager?: string;
  phone?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  items: number;
  leadTime: string;
  rating: number;
  status: 'Active' | 'Pending' | 'Inactive';
  website?: string;
  currency?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  warehouseId: number;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: number;
  supplierName: string;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  items: POItem[];
  total: number;
  expectedDate: string;
  createdAt: string;
}

export interface POItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

// ─── Order Types ──────────────────────────────────────────────────────────────

export type OrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refunded';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Partial';

export interface Order {
  id: string;
  customer: string;
  customerId?: string;
  customerEmail?: string;
  date: string;
  items: number;
  total: number;
  subtotal?: number;
  tax?: number;
  shippingCost?: number;
  discount?: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  payment: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  orderItems?: OrderItem[];
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  timeline?: OrderTimeline[];
  refund?: RefundInfo;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
  variantId?: string;
  variantName?: string;
}

export interface OrderTimeline {
  status: string;
  timestamp: string;
  note?: string;
}

export interface RefundInfo {
  amount: number;
  reason: string;
  createdAt: string;
}

// ─── Customer Types ───────────────────────────────────────────────────────────

export type CustomerSegment = 'VIP' | 'Regular' | 'New' | 'At Risk';
export type CustomerStatus = 'Active' | 'Inactive';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  orders: number;
  spent: number;
  segment: CustomerSegment;
  joined: string;
  lastOrder?: string;
  status: CustomerStatus;
  addresses?: Address[];
  tags?: string[];
  notes?: string;
  wishlistCount?: number;
  loyaltyPoints?: number;
  tier?: 'Bronze' | 'Silver' | 'Gold';
}

export interface Address {
  id?: string;
  label?: string;
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

export interface CustomerSegmentRule {
  id: string;
  name: string;
  conditions: Array<{ field: string; operator: string; value: string }>;
  customerCount: number;
}

// ─── Marketing Types ──────────────────────────────────────────────────────────

export type CouponType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';

export interface Coupon {
  id: number;
  code: string;
  type: string;
  discountType?: CouponType;
  discountValue?: number;
  uses: number;
  limit: number;
  limitPerCustomer?: number;
  status: 'Active' | 'Expired' | 'Disabled';
  expires: string;
  minOrderAmount?: number;
  applicableTo?: 'all' | 'category' | 'product';
  conditions?: CouponCondition[];
  createdAt?: string;
}

export interface CouponCondition {
  type: 'minOrder' | 'category' | 'product' | 'customer';
  value: string | number;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'flash_sale';
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  audience: string;
  reach: number;
  opens?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  scheduledAt?: string;
  completedAt?: string;
  subject?: string;
  content?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'welcome' | 'order_confirmation' | 'shipping' | 'abandoned_cart' | 'review' | 'promotional';
  subject: string;
  preview: string;
  isActive: boolean;
  openRate?: number;
  clickRate?: number;
  updatedAt: string;
}

// ─── CMS Types ────────────────────────────────────────────────────────────────

export type SectionType =
  | 'hero' | 'banner' | 'product_grid' | 'collection_grid' | 'category_grid'
  | 'blog' | 'video' | 'faq' | 'testimonials' | 'newsletter' | 'brands'
  | 'feature_grid' | 'image_gallery' | 'countdown' | 'promo_bar' | 'rich_text';

export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  type: 'home' | 'landing' | 'custom' | 'blog' | 'policy';
  status: 'published' | 'draft';
  sections: PageSection[];
  seo?: SEOMeta;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface PageSection {
  id: string;
  type: SectionType;
  name: string;
  order: number;
  isVisible: boolean;
  settings: Record<string, any>;
  blocks?: PageBlock[];
}

export interface PageBlock {
  id: string;
  type: string;
  content: Record<string, any>;
  order: number;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  target?: '_blank' | '_self';
  children?: MenuItem[];
}

export interface Menu {
  id: string;
  name: string;
  handle: string;
  items: MenuItem[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  status: 'published' | 'draft';
  tags?: string[];
  category?: string;
  coverImage?: string;
  seo?: SEOMeta;
  publishedAt?: string;
  createdAt: string;
  views?: number;
  readTime?: number;
}

// ─── Theme Types ──────────────────────────────────────────────────────────────

export type ThemeCategory = 'minimal' | 'bold' | 'elegant' | 'modern' | 'vintage' | 'all';

export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: string;
  thumbnail: string;
  category: ThemeCategory;
  price: number;
  rating: number;
  ratingCount: number;
  downloads: number;
  author: string;
  authorAvatar?: string;
  tags?: string[];
  isInstalled: boolean;
  isActive: boolean;
  version: string;
  compatibleWith: string[];
  features: string[];
  colors?: ThemeColors;
  fonts?: ThemeFonts;
  demoUrl?: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  surface: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface ThemeSetting {
  key: string;
  label: string;
  type: 'color' | 'font' | 'text' | 'number' | 'select' | 'toggle';
  value: any;
  options?: Array<{ label: string; value: string }>;
}

// ─── SaaS / Subscription Types ────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  price: number;
  yearlyPrice?: number;
  billingCycle: 'monthly' | 'yearly';
  description: string;
  features: string[];
  limits: PlanLimits;
  isPopular?: boolean;
  badge?: string;
}

export interface PlanLimits {
  products: number;
  staff: number;
  storage: number;
  bandwidth: number;
  customDomains: number;
  apiCalls: number;
  emailsPerMonth: number;
}

export interface Subscription {
  id: string;
  storeId: string;
  planId: string;
  plan: Plan;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: PaymentMethod;
  usage: UsageMetrics;
  invoices?: Invoice[];
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface UsageMetrics {
  products: { used: number; limit: number };
  staff: { used: number; limit: number };
  storage: { used: number; limit: number };
  apiCalls: { used: number; limit: number };
  emails: { used: number; limit: number };
}

export interface Invoice {
  id: string;
  amount: number;
  status: 'paid' | 'open' | 'void';
  date: string;
  pdfUrl?: string;
  description: string;
}

// ─── Search & Discovery Types ─────────────────────────────────────────────────

export interface SearchConfig {
  enableAutoComplete: boolean;
  enableFuzzySearch: boolean;
  enableSynonyms: boolean;
  enableSpellCheck: boolean;
  enableProductRecommendations: boolean;
  boostInStock: boolean;
  boostFeatured: boolean;
  resultLimit: number;
}

export interface SearchSynonym {
  id: string;
  terms: string[];
  type: 'one_way' | 'two_way';
}

export interface MerchandisingRule {
  id: string;
  name: string;
  type: 'pin' | 'hide' | 'boost' | 'bury';
  query: string;
  productId?: string;
  multiplier?: number;
  position?: number;
  isActive: boolean;
}

export interface SearchAnalytics {
  totalSearches: number;
  noResultsRate: number;
  clickThroughRate: number;
  topQueries: Array<{ query: string; count: number; resultsFound: boolean }>;
  zeroResultQueries: string[];
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface RevenuePoint {
  month: string;
  revenue: number;
  orders: number;
  profit: number;
}

export interface TrafficSource {
  name: string;
  value: number;
  color: string;
}

export interface TopProduct {
  name: string;
  views: number;
  sales: number;
  revenue: number;
}

export interface AnalyticsSummary {
  revenue: number;
  revenueChange: number;
  orders: number;
  ordersChange: number;
  customers: number;
  customersChange: number;
  avgOrderValue: number;
  aovChange: number;
  conversionRate: number;
  conversionChange: number;
  cartAbandonment: number;
  cartChange: number;
  traffic: number;
  trafficChange: number;
  customerLTV: number;
  ltvChange: number;
}

// ─── SEO Types ────────────────────────────────────────────────────────────────

export interface SEOMeta {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  message?: string;
  success: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

// ─── Staff / RBAC Types ───────────────────────────────────────────────────────

export type StaffRole = 'owner' | 'admin' | 'manager' | 'support' | 'analyst';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  avatar?: string;
  status: 'active' | 'invited' | 'suspended';
  lastLogin?: string;
  permissions: string[];
  createdAt: string;
}

export interface Permission {
  resource: string;
  actions: ('read' | 'create' | 'update' | 'delete')[];
}

// ─── Notification Types ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'order' | 'stock' | 'review' | 'payment' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// ─── Page Builder Types ───────────────────────────────────────────────────────
// Generic entities that support Homepage, Collection Page, Product Page,
// Landing Page, Blog Page, and any future page type.

export type PageType =
  | 'home'
  | 'collection'
  | 'product'
  | 'landing'
  | 'blog'
  | 'checkout'
  | 'custom';

export type BuilderSectionStatus = 'LIVE' | 'DRAFT' | 'SCHEDULED' | 'DISABLED';

export interface BuilderSection {
  id: string;
  sectionType: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  isLocked: boolean;
  status: BuilderSectionStatus;
  goLiveAt?: string;
  expireAt?: string;
}

export interface BuilderPage {
  id: string;
  pageType: PageType;
  slug: string;
  name: string;
  status: 'LIVE' | 'DRAFT';
  publishedAt?: string;
  sections: BuilderSection[];
}
