/// `/api/...` को backend origin (deploy गरिएको FoodDelivery API सँग मिल्नुपर्छ)।
/// सकेसम्म ग्राहक साइट उही host मा राख्नुहोस् ताकि cookies र origin मिलून्।
const String kApiBase = 'https://shyam-sweets.com';

String get _apiBaseNormalized => kApiBase.replaceAll(RegExp(r'/+$'), '');

/// in-app browser को प्रारम्भिक URL (अन्त्यमा slash)।
String get kWebViewStartUrl => '$_apiBaseNormalized/';
