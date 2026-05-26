/** Bundled Shyam's logo; mirrored at `app/assets/logo.png` for Flutter. */
export const DEFAULT_STORE_LOGO_URL = '/logo.png';

/** Prefer API-provided store logo; otherwise the bundled default. */
export function resolveStoreLogoUrl(settingsLogo?: string | null): string {
  const t = settingsLogo?.trim();
  return t && t.length > 0 ? t : DEFAULT_STORE_LOGO_URL;
}
