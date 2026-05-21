const STORAGE_KEY = 'fd_guest_checkout_details';

export type GuestCheckoutDetails = {
  name: string;
  phone: string;
};

export function readGuestCheckoutDetails(): GuestCheckoutDetails | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const name = typeof (parsed as GuestCheckoutDetails).name === 'string' ? (parsed as GuestCheckoutDetails).name : '';
    const phone = typeof (parsed as GuestCheckoutDetails).phone === 'string' ? (parsed as GuestCheckoutDetails).phone : '';
    if (!name.trim() && !phone.trim()) return null;
    return { name, phone };
  } catch {
    return null;
  }
}

export function writeGuestCheckoutDetails(details: GuestCheckoutDetails): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      name: details.name.trim(),
      phone: details.phone.replace(/\D/g, '').slice(0, 15),
    }),
  );
}

export function clearGuestCheckoutDetails(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 15);
}

export function isCheckoutPersonalDetailsValid(name: string, phone: string): boolean {
  return name.trim().length >= 2 && phoneDigitsOnly(phone).length >= 7;
}
