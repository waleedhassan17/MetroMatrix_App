// ═══════════════════════════════════════════════════════
// MetroMatrix — Add an appointment to the phone's calendar (expo-calendar)
// ═══════════════════════════════════════════════════════
// Asks permission the first time; a refusal is an answer, not an error.
// There's no device calendar on web.

import { Platform } from 'react-native';

export type CalendarResult = 'added' | 'denied' | 'unavailable';

export const isCalendarSupported = () => Platform.OS !== 'web';

export const addToCalendar = async (e: {
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  location: string | null;
  notes: string;
}): Promise<CalendarResult> => {
  if (!isCalendarSupported()) return 'unavailable';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Calendar = require('expo-calendar') as typeof import('expo-calendar');
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';
    let calendarId: string | undefined;
    if (Platform.OS === 'ios') {
      calendarId = (await Calendar.getDefaultCalendarAsync()).id;
    } else {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = calendars.filter(c => c.allowsModifications);
      calendarId = (writable.find(c => c.isPrimary) ?? writable[0])?.id;
    }
    if (!calendarId) return 'unavailable';
    await Calendar.createEventAsync(calendarId, {
      title: e.title,
      startDate: new Date(e.startAt),
      endDate: new Date(e.endAt),
      timeZone: e.timezone,
      location: e.location ?? undefined,
      notes: e.notes,
      alarms: [{ relativeOffset: -60 }],
    });
    return 'added';
  } catch {
    return 'unavailable';
  }
};
