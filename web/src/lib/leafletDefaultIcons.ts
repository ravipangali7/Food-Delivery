import L from 'leaflet';
import iconRetina2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

/** bundler सँग default Leaflet marker काम गर्न एक पटक बोलाउनुहोस्। */
function ensureLeafletDefaultIconUrls() {
  if ((L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl) {
    delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
  }
  L.Icon.Default.mergeOptions({
    iconUrl: icon,
    iconRetinaUrl: iconRetina2x,
    shadowUrl: iconShadow,
  });
}

ensureLeafletDefaultIconUrls();
