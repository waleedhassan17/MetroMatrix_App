// ═══════════════════════════════════════════════════════
// MetroMatrix — Today's rules (the doctor's dashboard)
// ═══════════════════════════════════════════════════════
// Pure: the greeting, which visits each queue tab holds, who is with the
// doctor or next, the one step on that visit, and the "Needs you" wording.

import type { DoctorAttention, DoctorNeed, QueueItem, TodayCounts } from '../health';
import type { IonName } from '../../Custom-Components/Icon';
import { timeInZone } from '../../utils/health-time/healthTime';

/** "Good morning" before noon, "Good afternoon" until 5 PM, "Good evening" after, in the practice's time. */
export const greeting = (nowMs: number, timezone: string): string => {
  const hour = Number(timeInZone(new Date(nowMs).toISOString(), timezone).slice(0, 2));
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export type QueueTabKey = 'waiting' | 'upcoming' | 'done';

/** The visits each queue tab holds, in the server's order. */
export const queueIn = (queue: QueueItem[], tab: QueueTabKey): QueueItem[] =>
  queue.filter(q =>
    tab === 'waiting'
      ? q.status === 'checked_in' || q.status === 'in_progress'
      : tab === 'upcoming'
        ? q.status === 'confirmed' || q.status === 'awaiting_payment'
        : q.status === 'completed' || q.status === 'no_show',
  );

export const queueTabLabel = (tab: QueueTabKey, counts: TodayCounts): string =>
  tab === 'waiting'
    ? `Here · ${counts.waiting + counts.withDoctor}`
    : tab === 'upcoming'
      ? `Upcoming · ${counts.upcoming}`
      : `Done · ${counts.seen + counts.missed}`;

/**
 * The hero: the patient with the doctor now, else the one who has waited
 * longest, else the next booked visit (the server orders the queue so).
 */
export const nextUp = (queue: QueueItem[]): { mode: 'with' | 'waiting' | 'next'; item: QueueItem } | null => {
  const withYou = queue.find(q => q.status === 'in_progress');
  if (withYou) return { mode: 'with', item: withYou };
  const waiting = queue.find(q => q.status === 'checked_in');
  if (waiting) return { mode: 'waiting', item: waiting };
  const next = queue.find(q => q.status === 'confirmed' || q.status === 'awaiting_payment');
  return next ? { mode: 'next', item: next } : null;
};

export type QueueStep = 'join' | 'complete' | 'start' | 'check-in';

/** The one step on a visit now, from the server's flags (video join first inside its window). */
export const nextStep = (q: QueueItem): QueueStep | null => {
  const a = q.actions;
  if (a.canJoinVideo) return 'join';
  if (a.canComplete) return 'complete';
  if (a.canStart) return 'start';
  if (a.canCheckIn) return 'check-in';
  return null;
};

export const STEP_LABEL: Record<QueueStep, string> = {
  join: 'Join video',
  complete: 'Complete visit',
  start: 'Start visit',
  'check-in': 'Check in',
};

/** How far through the day: the visits that ended out of the day's visits (0–1). */
export const dayProgress = (c: TodayCounts): number => (c.total ? Math.min(1, (c.seen + c.missed) / c.total) : 0);

export interface NeedCopy {
  icon: IonName;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
}

/** The words for each "Needs you" list (Today's rows and the list they open). */
export const NEED_COPY: Record<DoctorNeed, NeedCopy> = {
  transfer: {
    icon: 'swap-horizontal-outline',
    title: 'Transfers to confirm',
    subtitle: 'Proof of payment sent by patients',
    emptyTitle: 'No transfers waiting',
    emptyBody: 'When a patient sends proof of a transfer, it waits here until you check your account.',
  },
  fee: {
    icon: 'cash-outline',
    title: 'Fees to mark paid',
    subtitle: 'Clinic fees not recorded, last 30 days',
    emptyTitle: 'Every fee is recorded',
    emptyBody: 'A clinic visit whose fee you didn’t mark as paid shows here.',
  },
  prescription: {
    icon: 'document-text-outline',
    title: 'Prescriptions to write',
    subtitle: 'Visits finished in the last 24 hours',
    emptyTitle: 'Nothing to write',
    emptyBody: 'A visit you finished without a prescription shows here for 24 hours.',
  },
  refund: {
    icon: 'return-down-back-outline',
    title: 'Refunds to record',
    subtitle: 'Fees owed back after a cancelled visit',
    emptyTitle: 'No refunds owed',
    emptyBody: 'When a paid visit is cancelled, record the refund here once you send it.',
  },
};

export interface NeedRow {
  key: DoctorNeed | 'review';
  icon: IonName;
  title: string;
  count: number;
}

/** "Needs you": only what has something in it, transfers first (a patient is waiting on them). */
export const needRows = (a: DoctorAttention | null): NeedRow[] => {
  if (!a) return [];
  const rows: NeedRow[] = [
    { key: 'transfer', icon: NEED_COPY.transfer.icon, title: NEED_COPY.transfer.title, count: a.transfersToConfirm },
    { key: 'prescription', icon: NEED_COPY.prescription.icon, title: NEED_COPY.prescription.title, count: a.prescriptionsToWrite },
    { key: 'fee', icon: NEED_COPY.fee.icon, title: NEED_COPY.fee.title, count: a.feesToMark },
    { key: 'refund', icon: NEED_COPY.refund.icon, title: NEED_COPY.refund.title, count: a.refundsDue },
    { key: 'review', icon: 'chatbubble-ellipses-outline', title: 'Reviews to reply to', count: a.reviewsToReply },
  ];
  return rows.filter(r => r.count > 0);
};

/** Why patients can't find the doctor, in the words the notice uses. */
export type ListingNotice =
  | { kind: 'staff'; reason: string }
  | { kind: 'hidden_by_you' }
  | { kind: 'incomplete'; missing: string[] }
  | null;

/**
 * The listing notice: staff took the profile down (their reason), the
 * doctor hid it, or a step of the setup is missing (what). Nothing when
 * patients can find them.
 */
export const listingNotice = (me: { isListed: boolean; hiddenByStaff: string | null } | null, missing: string[]): ListingNotice => {
  if (!me || me.isListed) return null;
  if (me.hiddenByStaff) return { kind: 'staff', reason: me.hiddenByStaff };
  if (missing.length) return { kind: 'incomplete', missing };
  return { kind: 'hidden_by_you' };
};
