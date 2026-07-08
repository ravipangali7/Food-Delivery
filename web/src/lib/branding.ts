/**
 * bundle Shyam's logo (`web/public/logo.png`)।
 * यो पनि प्रतिलिपि: `app/assets/logo.png`, `server/static/panel/logo.png`, `server/static/brand/logo.png`।
 */
export const DEFAULT_STORE_LOGO_URL = '/logo.png';

/** API बाट पसल logo प्राथमिकता; अन्यथा bundle गरिएको पूर्वनिर्धारित। */
export function resolveStoreLogoUrl(settingsLogo?: string | null): string {
  const t = settingsLogo?.trim();
  return t && t.length > 0 ? t : DEFAULT_STORE_LOGO_URL;
}
