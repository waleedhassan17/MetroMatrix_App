// ═══════════════════════════════════════════════════════
// MetroMatrix — "Use my location" for a business pin
// ═══════════════════════════════════════════════════════
// Optional: a partner can always type the address. Returns null when
// permission is refused. Reverse geocoding (to suggest city + street) is
// native-only — on web Expo needs a Google Maps key for it, so web just
// stores the coordinates.

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { GeoPoint } from '../types/auth';

export interface LocatedPlace {
  location: GeoPoint;
  city: string | null;
  address: string | null;
}

export const locateBusiness = async (): Promise<LocatedPlace | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const location = { lat: position.coords.latitude, lng: position.coords.longitude };
  if (Platform.OS === 'web') return { location, city: null, address: null };
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: location.lat, longitude: location.lng });
    const street = [place?.name, place?.street, place?.district].filter(Boolean).join(', ');
    return { location, city: place?.city ?? place?.subregion ?? null, address: street || null };
  } catch {
    return { location, city: null, address: null };
  }
};

/** "I need help. I'm here: <map link>" — for the Emergency screen's SMS. Null when refused. */
export const locationForSms = async (): Promise<string | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return `https://maps.google.com/?q=${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`;
  } catch {
    return null;
  }
};

/** Where the customer is now (Food Court's "Use my current location"); null when refused or unavailable. */
export const currentPoint = async (): Promise<GeoPoint | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    return null;
  }
};
