import type { User } from '@/types';

/** Admin portal (Django staff/superuser or API role). */
export function isAdminUser(u: User): boolean {
  if (u.role === 'super_admin' || u.role === 'admin') return true;
  return !!(u.is_staff || u.is_superuser);
}

/** Delivery app (not staff/superuser; delivery role only). */
export function isDeliveryPortalUser(u: User): boolean {
  if (u.role === 'delivery_boy') return true;
  if (isAdminUser(u)) return false;
  return !!u.is_delivery_boy;
}

export function homeForUser(u: User): string {
  if (isAdminUser(u)) return '/admin/dashboard';
  if (isDeliveryPortalUser(u)) return '/delivery';
  return '/customer';
}
