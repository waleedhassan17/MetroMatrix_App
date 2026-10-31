// MetroMatrix — Directions, navigation, calls and WhatsApp (opens the phone's own apps).

import { Linking } from 'react-native';

/** Google Maps directions: the app on Android, the app or browser elsewhere. */
export const directionsUrl = (place: { lat: number | null; lng: number | null; address: string | null; name: string }) => {
  const destination =
    place.lat !== null && place.lng !== null ? `${place.lat},${place.lng}` : encodeURIComponent(place.address ?? place.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

export const openDirections = (place: Parameters<typeof directionsUrl>[0]) => Linking.openURL(directionsUrl(place)).catch(() => undefined);

export const callNumber = (number: string) => Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`).catch(() => undefined);

/** Turn-by-turn to a point, for riders (Google Maps; no paid Directions API). */
export const navigateUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export const navigateTo = (lat: number, lng: number) => Linking.openURL(navigateUrl(lat, lng)).catch(() => undefined);

/** A WhatsApp chat with a Pakistani number (+92…, 03…). */
export const whatsAppUrl = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `92${digits.slice(1)}` : digits}`;
};

export const openWhatsApp = (phone: string) => Linking.openURL(whatsAppUrl(phone)).catch(() => undefined);
