// ============================================
// Shyam Sweets — TypeScript प्रकारहरू
// ============================================

/** API बाट पोर्टल भूमिका; `is_superuser`, `is_staff`, `is_delivery_boy` सँग मिल्छ। */
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
  /** सन्देश ग्राहक ↔ पसल सहायता थ्रेडमा छ (डेलिभरीलाई देखिन्न)। */
  support?: boolean;
  /** सन्देश राइडर ↔ पसल मात्र (ग्राहकलाई देखिन्न)। */
  rider_staff?: boolean;
  /** सन्देश ग्राहक र तोकिएको डेलिभरी साझेदार (+ स्टाफ) बीच निजी छ। */
  customer_rider?: boolean;
  aggregate_status?: OrderChatAggregateStatus;
  created_at: string;
  my_delivered_at?: string | null;
  my_read_at?: string | null;
}

/** अर्डर च्याटका सहभागीको उपस्थिति (GET .../chat/presence/ बाट)। */
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
  /** API बाट लोड गर्दा उपस्थित (`/api/auth/me/`)। */
  is_staff?: boolean;
  is_superuser?: boolean;
  /** राउटिङ र UI का लागि सर्भरले गणना गर्छ। */
  role?: UserRole;
  profile_photo?: string;
  is_active: boolean;
  is_delivery_boy: boolean;
  /** स्टाफ: true भए OTP SMS मालिकको बाँकीमा; false भए रेस्टुरेन्टको बाँकीमा (super admin मात्र)। */
  is_store_owner?: boolean;
  /** डेलिभरी साझेदार: false भए कुनै अर्डर सूचीबद्ध वा तोकिँदैन। */
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
  /** सादा पाठ; `/customer/about` मा मात्र देखिन्छ। बोल्डका लागि `**heading**` प्रयोग गर्नुहोस्। */
  about_us?: string | null;
  /** सादा पाठ; सेट भए ग्राहक Terms मा देखिन्छ। */
  terms_and_conditions?: string | null;
  /** सादा पाठ; सेट भए ग्राहक Privacy मा देखिन्छ। */
  privacy_policy?: string | null;
  delivery_charge_per_km: number;
  /** पसलबाट अधिकतम डेलिभरी दूरी (km); 0 = सीमा छैन। शुल्क = दूरी × प्रति km दर। */
  delivery_under_km: number;
  is_open: boolean;
  android_file?: string | null;
  google_playstore_link?: string | null;
  ios_file?: string | null;
  applestore_link?: string | null;
  android_version?: string | null;
  ios_version?: string | null;
  /** superuser को रूपमा प्रमाणीकरण भए GET /api/settings/ मा super admin लाई मात्र। */
  sms_cost_per_message?: number;
  /** प्रति अर्डर ग्लोबल प्लेटफर्म शुल्क (NPR); शून्य नभए सधैं लागू। */
  per_transaction_fee?: number;
  owner_sms_due?: number;
  restaurant_sms_due?: number;
  restaurant_platform_due?: number;
  created_at: string;
  updated_at: string;
}

/** ग्राहक home / explore / sweets मा प्रचार पट्टी (`GET /api/banners/`)। */
export interface Banner {
  id: number;
  image: string | null;
  url: string;
  is_active: boolean;
}

/** स्टाफ क्यारोसेल व्यवस्थापन (`GET/PATCH/POST /api/admin/banners/`)। */
export interface AdminBanner {
  id: number;
  image_url: string | null;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** शीर्ष-स्तर श्रेणी (छवि छ; उपश्रेणीहरू समूहबद्ध गर्छ)। */
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

/** बिक्री योग्य एकाइ (kg, piece, plate, …) — Admin → Units अन्तर्गत व्यवस्थापन। */
export interface Unit {
  id: number;
  name: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** उपश्रेणी — उत्पादन सधैं यहाँ तोकिन्छ; अभिभावक श्रेणीमा हुनुपर्छ। */
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

export interface ProductVariant {
  id: number;
  label?: string;
  display_label?: string;
  unit: Unit;
  price: number;
  effective_price?: number | string;
  stock_quantity: number;
  is_available?: boolean;
  sort_order?: number;
}

/** उत्पादन विवरण पृष्ठमा ग्राहकले छान्न सक्ने एकाइ/मूल्य विकल्प। */
export interface ProductPurchaseOption {
  variant_id: number | null;
  label: string;
  unit: Unit;
  price: number | string;
  effective_price: number | string;
  stock_quantity: number;
}

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
  /** सर्भरले गणना: आधार मूल्य घटाएर छुट; API ले string दशमलव फर्काउन सक्छ। */
  effective_price?: number | string;
  unit: Unit;
  /** Admin लेख्ने फिल्ड; nested `unit` सँग admin API प्रतिक्रियामा उपस्थित। */
  unit_id?: number;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  is_veg: boolean;
  /** true भए उत्पादन ग्राहक Sweets ट्याबमा देखिन्छ। */
  is_sweet?: boolean;
  thumbnail_url?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  category?: Category;
  /** Admin सूची API को denormalized लेबल */
  category_name?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  has_variants?: boolean;
  purchase_options?: ProductPurchaseOption[];
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
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  /** मिठाई मात्र: लाइन चेकआउटमा pre-order को रूपमा थपियो (मिति/समय)। */
  is_preorder?: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
  variant?: ProductVariant | null;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'failed';

/** स्टाफ सहायता इनबक्स पङ्क्ति `GET /api/admin/support/inbox/` बाट। */
export interface SupportInboxRow {
  id: number;
  order_number: string;
  status: OrderStatus;
  /** अर्डर गर्ने ग्राहकको user id — च्याटमा deep link का लागि। */
  customer_user_id?: number | null;
  customer_name: string;
  customer_phone: string;
  /** अर्डर गर्ने ग्राहकको पूर्ण वा सापेक्ष प्रोफाइल छवि URL। */
  customer_profile_photo?: string;
  delivery_boy_name: string | null;
  delivery_boy_id: number | null;
  /** तोकिएको डेलिभरी साझेदारको प्रोफाइल छवि URL, उपस्थित भए। */
  delivery_boy_profile_photo?: string;
  last_message_at: string | null;
  unread_count?: number;
  has_unread?: boolean;
}

export type OrderPaymentMethod = 'cash_on_delivery';

/** डेलिभरीमा नगद सङ्कलन; अर्डर delivered चिन्ह नलाग्दासम्म pending। */
export type OrderPaymentStatus = 'pending' | 'paid';

export type OrderDeliveryType = 'bike' | 'walking';

/** ग्राहक रद्द अनुरोध pending; super admin समीक्षा पर्खँदा `GET /api/orders/:id/` मा उपस्थित। */
export interface PendingCancellationRequest {
  id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id?: number | null;
  /** अतिथि अर्डरका लागि; लगइन बिना विवरण हेर्न आवश्यक। */
  guest_access_token?: string | null;
  delivery_boy_id?: number;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  /** चेकआउटमा रेकर्ड भएको प्रति-अर्डर प्लेटफर्म शुल्क (NPR)। */
  platform_fee_amount?: number;
  total_amount: number;
  address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  special_instructions?: string;
  estimated_delivery_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  /** cash on delivery मात्र समर्थित। */
  payment_method: OrderPaymentMethod;
  payment_status: OrderPaymentStatus;
  delivery_type: OrderDeliveryType;
  /** अर्डरमा कम्तीमा एउटा pre-order मिठाई लाइन छ। */
  is_preorder?: boolean;
  /** ग्राहकले pre-order वस्तु कहिले तयार चाहे (API बाट ISO datetime)। */
  pre_order_date_time?: string | null;
  created_at: string;
  updated_at: string;
  customer?: User;
  delivery_boy?: User;
  items?: OrderItem[];
  pending_cancellation_request?: PendingCancellationRequest | null;
}

export type OrderTrackingPhase = 'preparing' | 'on_the_way' | 'delivered';

/** `GET /api/orders/:id/tracking/` र WebSocket push बाट लाइभ नक्शा स्न्यापसट। */
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
  variant_id?: number | null;
  unit_price: number;
  quantity: number;
  total_price: number;
  notes?: string;
  created_at: string;
  product?: Product;
  variant?: ProductVariant | null;
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
  /** यो प्रयोगकर्ताले सूचना इनबक्स खोलेपछि सेट (प्रति प्राप्तकर्ता)। */
  read_at?: string | null;
  recipients?: User[];
  recipients_count?: number;
}

/** स्टाफ API: प्रसारण इतिहास र विवरण */
export interface AdminNotificationRecipient {
  user_id: number;
  user_name: string;
  user_phone: string;
  delivery_status: NotificationDeliveryStatus;
  error_message: string;
  delivered_at: string | null;
}

export interface AdminNotification extends Notification {
  /** प्रसारणका लागि उपस्थित; अर्डर सूचनाले `direct` प्रयोग गर्न सक्छ। */
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

