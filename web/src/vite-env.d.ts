/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** वैकल्पिक local override; production ले `GET /api/google-maps-js-key/` प्रयोग गर्छ (Infelo → Google Maps JS key)। */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
