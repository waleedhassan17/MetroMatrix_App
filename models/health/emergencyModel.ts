// MetroMatrix — Emergency numbers and the "share my location" message.

import { Platform } from 'react-native';
import type { EmergencyNumber } from '../health';

/** Used only when the API's own list hasn't loaded (no connection is exactly when it matters). */
export const FALLBACK_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { label: 'Rescue 1122', number: '1122' },
  { label: 'Edhi ambulance', number: '115' },
  { label: 'Police', number: '15' },
];

export const helpMessage = (mapLink: string | null) =>
  mapLink ? `I need medical help. I am here: ${mapLink}` : 'I need medical help. Please call me.';

/** An SMS composer link with the body filled in (iOS uses "&", Android "?"). */
export const smsUrl = (body: string) => `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
