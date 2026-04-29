/** Same asset as Flutter `assets/logo.png`; must exist at `web/public/logo.png`. */
export const DEFAULT_STORE_LOGO_URL = '/logo.png';

/** Prefer API-provided store logo; otherwise the bundled default. */
export function resolveStoreLogoUrl(settingsLogo?: string | null): string {
  const t = settingsLogo?.trim();
  return t && t.length > 0 ? t : DEFAULT_STORE_LOGO_URL;
}
