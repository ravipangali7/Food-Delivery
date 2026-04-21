/// Backend origin for `/api/...` (must match the deployed FoodDelivery API).
/// WebView base URL is defined in [WebViewScreen.startUrl]; keep API on same host when possible.
const String kApiBase = 'https://atozmobilenp.com';

String get kSettingsApiUrl => '$kApiBase/api/settings/';
