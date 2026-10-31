// MetroMatrix — How times read in the app (one place, so every screen agrees).

import dayjs from 'dayjs';

/** "14 Oct, 3:05 pm" — a timeline step, an order's time. */
export const formatDateTime = (iso: string) => dayjs(iso).format('D MMM, h:mm a');

/** "14 Oct 2026" */
export const formatDate = (iso: string) => dayjs(iso).format('D MMM YYYY');

/** "Today", "Yesterday", or "14 Oct". */
export const formatDay = (iso: string, now: Date = new Date()) => {
  const d = dayjs(iso).startOf('day');
  const today = dayjs(now).startOf('day');
  const diff = today.diff(d, 'day');
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.format('D MMM');
};

/** "5h 20m left" / "40m left" / null once it has passed. */
export const timeLeft = (iso: string, now: Date = new Date()): string | null => {
  const ms = new Date(iso).getTime() - now.getTime();
  if (!(ms > 0)) return null;
  const minutes = Math.ceil(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};
