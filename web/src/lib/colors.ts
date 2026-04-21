// ============================================
// Shyam Sweets — Centralized Color Constants
// ============================================

export const colors = {
  // Primary Amber Palette
  primary: {
    50:  '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Main Brand
    600: '#d97706',  // Hover / Active
    700: '#b45309',  // Pressed
    800: '#92400e',
    900: '#78350f',
  },

  // Neutral / Surface
  surface: {
    white:   '#ffffff',
    alt:     '#fafaf9',
    card:    '#ffffff',
    border:  '#e7e5e4',
    borderLight: '#f5f5f4',
  },

  // Text
  text: {
    primary:   '#1c1917',
    secondary: '#78716c',
    muted:     '#a8a29e',
    inverse:   '#ffffff',
  },

  // Status Colors
  status: {
    success:   '#16a34a',
    successBg: '#f0fdf4',
    warning:   '#d97706',
    warningBg: '#fffbeb',
    danger:    '#dc2626',
    dangerBg:  '#fef2f2',
    info:      '#2563eb',
    infoBg:    '#eff6ff',
  },

  // Order Status Colors
  orderStatus: {
    pending:            '#78716c',
    confirmed:          '#2563eb',
    preparing:          '#7c3aed',
    ready_for_delivery: '#d97706',
    out_for_delivery:   '#f59e0b',
    delivered:          '#16a34a',
    cancelled:          '#dc2626',
    failed:             '#9a3412',
  },

  // Stone palette for UI
  stone: {
    50:  '#fafaf9',
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

  // Admin sidebar
  sidebar: {
    bg:     '#1c1917',
    hover:  'rgba(255,255,255,0.05)',
    active: 'rgba(245,158,11,0.15)',
  },
} as const;

// Order status labels
export const orderStatusLabels: Record<string, string> = {
  pending:            'Pending',
  confirmed:          'Confirmed',
  preparing:          'Preparing',
  ready_for_delivery: 'Ready',
  out_for_delivery:   'On the Way',
  delivered:          'Delivered',
  cancelled:          'Cancelled',
  failed:             'Failed',
};

// Valid status transitions
export const validStatusTransitions: Record<string, string[]> = {
  pending:            ['confirmed', 'cancelled'],
  confirmed:          ['preparing', 'cancelled'],
  preparing:          ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery:   ['delivered', 'failed'],
  failed:             ['out_for_delivery'],
  delivered:          [],
  cancelled:          [],
};

/** Assigned delivery partner only — from Preparing onward (not pending/confirmed). */
export const deliveryPartnerValidStatusTransitions: Record<string, string[]> = {
  pending:            [],
  confirmed:          [],
  preparing:          ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery:   ['delivered', 'failed'],
  failed:             ['out_for_delivery'],
  delivered:          [],
  cancelled:          [],
};

// Notification types
export const notificationTypes = [
  'order_placed', 'order_confirmed', 'out_for_delivery',
  'delivered', 'cancelled', 'promo',
] as const;
