// MetroMatrix — Directions and calls for a clinic (opens the phone's own apps).

import { Linking } from 'react-native';

/** Google Maps directions: the app on Android, the app or browser elsewhere. */
export const directionsUrl = (place: { lat: number | null; lng: number | null; address: string | null; name: string }) => {
  const destination =
    place.lat !== null && place.lng !== null ? `${place.lat},${place.lng}` : encodeURIComponent(place.address ?? place.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

export const openDirections = (place: Parameters<typeof directionsUrl>[0]) => Linking.openURL(directionsUrl(place)).catch(() => undefined);

export const callNumber = (number: string) => Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`).catch(() => undefined);
