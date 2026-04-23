/// Backend origin for `/api/...` (must match the deployed FoodDelivery API).
/// Keep the customer site on the same host when possible so cookies and origins align.
const String kApiBase = 'https://shyam-sweets.com';

String get _apiBaseNormalized => kApiBase.replaceAll(RegExp(r'/+$'), '');

String get kSettingsApiUrl => '$_apiBaseNormalized/api/settings/';

/// Initial URL for the in-app browser (trailing slash).
String get kWebViewStartUrl => '$_apiBaseNormalized/';
