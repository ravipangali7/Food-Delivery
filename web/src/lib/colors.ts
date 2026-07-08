// ============================================
// Shyam's — केन्द्रीकृत रङ स्थिरांक
// ब्रान्ड: red #E31E24, yellow #FFC72C
// ============================================

export const colors = {
  brand: {
    red: '#E31E24',
    yellow: '#FFC72C',
    redDark: '#8B1216',
    redLight: '#FDE8E9',
    yellowLight: '#FFF8E1',
  },

  primary: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFC72C',
    500: '#E31E24',
    600: '#C4191F',
    700: '#A01418',
    800: '#8B1216',
    900: '#6E0E12',
  },

  surface: {
    white: '#ffffff',
    alt: '#FFFBF5',
    card: '#ffffff',
    border: '#F0E6D8',
    borderLight: '#FAF6F0',
  },

  text: {
    primary: '#2A1214',
    secondary: '#6B5B5C',
    muted: '#9A8A8B',
    inverse: '#ffffff',
  },

  status: {
    success: '#16a34a',
    successBg: '#f0fdf4',
    warning: '#FFC72C',
    warningBg: '#FFF8E1',
    danger: '#dc2626',
    dangerBg: '#fef2f2',
    info: '#2563eb',
    infoBg: '#eff6ff',
  },

  orderStatus: {
    pending: '#78716c',
    confirmed: '#2563eb',
    preparing: '#7c3aed',
    ready_for_delivery: '#E31E24',
    out_for_delivery: '#C4191F',
    delivered: '#16a34a',
    cancelled: '#dc2626',
    failed: '#9a3412',
  },

  stone: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
  },

  sidebar: {
    bg: '#8B1216',
    hover: 'rgba(255,255,255,0.05)',
    active: 'rgba(255,199,44,0.15)',
  },
} as const;

// अर्डर स्थिति लेबलहरू
export const orderStatusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_delivery: 'Ready',
  out_for_delivery: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

// मान्य स्थिति संक्रमणहरू
export const validStatusTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['out_for_delivery'],
  delivered: [],
  cancelled: [],
};

/** तोकिएको डेलिभरी साझेदार मात्र — Preparing देखि (pending/confirmed होइन)। */
export const deliveryPartnerValidStatusTransitions: Record<string, string[]> = {
  pending: [],
  confirmed: [],
  preparing: ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'failed'],
  failed: ['out_for_delivery'],
  delivered: [],
  cancelled: [],
};

// सूचना प्रकारहरू
export const notificationTypes = [
  'order_placed',
  'order_confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'promo',
] as const;
