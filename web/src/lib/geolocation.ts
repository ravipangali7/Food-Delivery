export type GeolocationErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown';

export class GeolocationError extends Error {
  readonly code: GeolocationErrorCode;

  constructor(code: GeolocationErrorCode, message: string) {
    super(message);
    this.name = 'GeolocationError';
    this.code = code;
  }
}

function mapGeolocationError(error: GeolocationPositionError): GeolocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new GeolocationError('denied', 'Location permission was denied. You can still use the map pin or search.');
    case error.POSITION_UNAVAILABLE:
      return new GeolocationError('unavailable', 'Your current location is unavailable right now.');
    case error.TIMEOUT:
      return new GeolocationError('timeout', 'Finding your location took too long. Try again.');
    default:
      return new GeolocationError('unknown', 'Could not get your current location.');
  }
}

/** वास्तविक-समय GPS स्थान — map pin अपडेट गर्न प्रयोग। */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new GeolocationError('unsupported', 'Geolocation is not supported on this device.'),
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, err => reject(mapGeolocationError(err)), {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 5_000,
    });
  });
}
