// ============================================
// Shyam Sweets — TypeScript Types
// ============================================

/** Portal role from API; aligns with `is_superuser`, `is_staff`, `is_delivery_boy`. */
export type UserRole = 'super_admin' | 'admin' | 'delivery_boy' | 'customer';

export interface CustomerAddress {
  id: number;
  label: string;
  address: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  created_at: string;
  updated_at: string;
}

export type OrderChatAggregateStatus = 'sent' | 'delivered' | 'seen';

export interface OrderChatMessage {
  id: number;
  order_id?: number;
  sender: number;
  sender_name: string;
  body: string;
  /** True when message is on the customer ↔ store support thread (not visible to delivery). */
  support?: boolean;
  /** True when message is rider ↔ store only (not visible to the customer). */
  rider_staff?: boolean;
  /** True when message is private between the customer and the assigned delivery partner (+ staff). */
  customer_rider?: boolean;
  aggregate_status?: OrderChatAggregateStatus;
  created_at: string;
  my_delivered_at?: string | null;
  my_read_at?: string | null;
}

/** Participant presence for order chat (from GET .../chat/presence/). */
export interface ChatParticipantPresence {
  user_id: number;
  name: string;
  is_online: boolean;
  last_chat_ping_at?: string | null;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  email?: string;
  /** Present when loaded from API (`/api/auth/me/`). */
  is_staff?: boolean;
  is_superuser?: boolean;
  /** Computed on the server for routing and UI. */
  role?: UserRole;
  profile_photo?: string;
  is_active: boolean;
  is_delivery_boy: boolean;
  /** Delivery partners: when false, no orders are listed or assigned. */
  is_online?: boolean;
  latitude?: number;
  longitude?: number;
  address?: string;
  fcm_token?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SuperSetting {
  id: number;
  name: string;
  logo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  delivery_charge_per_km: number;
  is_open: boolean;
  android_file?: string | null;
  google_playstore_link?: string | null;
  ios_file?: string | null;
  applestore_link?: string | null;
  android_version?: string | null;
  ios_version?: string | null;
  created_at: string;
  updated_at: string;
}

/** Top-level category (has image; groups subcategories). */
export interface ParentCategory {
  id: number;
  kind?: 'parent';
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: Category[];
  products_count?: number;
  subcategories_count?: number;
}

/** Sellable unit (kg, piece, plate, …) — managed under Admin → Units. */
export interface Unit {
  id: number;
  name: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Subcategory — products are always assigned here; must belong to a parent. */
export interface Category {
  id: number;
  kind?: 'sub';
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: Category[];
  products_count?: number;
}

export type DiscountType = 'flat' | 'percentage';

export interface Product {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  price: number;
  discount_type: DiscountType;
  discount_value?: number;
  /** Server-computed: base price minus discount; API may return string decimals. */
  effective_price?: number | string;
  unit: Unit;
  /** Admin write field; present on admin API responses alongside nested `unit`. */
  unit_id?: number;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  is_veg: boolean;
  thumbnail_url?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  category?: Category;
  /** Admin list API denormalized label */
  category_name?: string;
  images?: ProductImage[];
}

export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  alt_text?: string;
  sort_order: number;
  created_at: string;
}

export interface Cart {
  id: number;
  user_id: number;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at: string;
  items?: CartItem[];
}

export interface CartItem {
  id: number;
  cart_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'failed';

/** Staff support inbox row from `GET /api/admin/support/inbox/`. */
export interface SupportInboxRow {
  id: number;
  order_number: string;
  status: OrderStatus;
  /** Ordering customer's user id — for deep links into their chat. */
  customer_user_id?: number | null;
  customer_name: string;
  customer_phone: string;
  /** Absolute or relative profile image URL for the ordering customer. */
  customer_profile_photo?: string;
  delivery_boy_name: string | null;
  delivery_boy_id: number | null;
  /** Profile image URL for the assigned delivery partner, when present. */
  delivery_boy_profile_photo?: string;
  last_message_at: string | null;
}

export type OrderPaymentMethod = 'cash_on_delivery';

/** Cash collected at delivery; pending until order is marked delivered. */
export type OrderPaymentStatus = 'pending' | 'paid';

export type OrderDeliveryType = 'bike' | 'walking';

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  delivery_boy_id?: number;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  special_instructions?: string;
  estimated_delivery_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  /** Only cash on delivery is supported. */
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  delivery_type: OrderDeliveryType;
  created_at: string;
  updated_at: string;
  customer?: User;
  delivery_boy?: User;
  items?: OrderItem[];
}

export type OrderTrackingPhase = 'preparing' | 'on_the_way' | 'delivered';

/** Live map snapshot from `GET /api/orders/:id/tracking/` and WebSocket pushes. */
export interface OrderTrackingPayload {
  order_id: number;
  order_number: string | null;
  status: OrderStatus;
  tracking_phase: OrderTrackingPhase;
  tracking_status_label: string;
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  payment_status_label: string;
  delivery_type: OrderDeliveryType;
  delivery_type_label: string;
  restaurant: { name: string; latitude: number | null; longitude: number | null };
  destination: { address: string; latitude: number | null; longitude: number | null };
  driver: { latitude: number; longitude: number } | null;
  route_polyline: string | null;
  route_straight_fallback: boolean;
  route_distance_meters: number | null;
  route_duration_seconds: number | null;
  distance_remaining_meters: number | null;
  eta_seconds: number | null;
  estimated_delivery_at: string | null;
  tracking_updated_at: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  unit_price: number;
  quantity: number;
  total_price: number;
  notes?: string;
  created_at: string;
  product?: Product;
}

export type NotificationType = 'order_placed' | 'order_confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'promo';
export type NotificationMedium = 'sms' | 'push_notification';

export type NotificationTargetAudience =
  | 'all_customers'
  | 'all_delivery_boys'
  | 'all_users'
  | 'direct';

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  medium: NotificationMedium;
  data?: any;
  created_at: string;
  /** Set when this user has opened the notification inbox (per-recipient). */
  read_at?: string | null;
  recipients?: User[];
  recipients_count?: number;
}

/** Staff API: broadcast history and detail */
export interface AdminNotificationRecipient {
  user_id: number;
  user_name: string;
  user_phone: string;
  delivery_status: NotificationDeliveryStatus;
  error_message: string;
  delivered_at: string | null;
}

export interface AdminNotification extends Notification {
  /** Present for broadcasts; order notifications may use `direct`. */
  target_audience?: NotificationTargetAudience;
  delivery_sent_count?: number;
  delivery_failed_count?: number;
  delivery_skipped_count?: number;
  recipients?: AdminNotificationRecipient[];
}

export interface AdminNotificationSendResponse extends AdminNotification {
  delivery?: { sent: number; failed: number; skipped: number };
  recipients_total?: number;
}

