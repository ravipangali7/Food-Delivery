const PREFIX = 'fd_guest_order_';

export function saveGuestOrderAccess(orderId: number, token: string): void {
  try {
    sessionStorage.setItem(`${PREFIX}${orderId}`, token);
  } catch {
    /* ignore quota errors */
  }
}

export function getGuestOrderAccess(orderId: number): string | null {
  try {
    return sessionStorage.getItem(`${PREFIX}${orderId}`);
  } catch {
    return null;
  }
}

export function orderApiPath(orderId: number | string, guestToken?: string | null): string {
  const base = `/api/orders/${orderId}/`;
  if (!guestToken) return base;
  const qs = new URLSearchParams({ guest_token: guestToken });
  return `${base}?${qs.toString()}`;
}

export function orderTrackingApiPath(orderId: number | string, guestToken?: string | null): string {
  const base = `/api/orders/${orderId}/tracking/`;
  if (!guestToken) return base;
  const qs = new URLSearchParams({ guest_token: guestToken });
  return `${base}?${qs.toString()}`;
}
