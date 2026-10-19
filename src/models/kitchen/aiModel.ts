// ═══════════════════════════════════════════════════════
// MetroMatrix — The assistant: its meter, and what to say when it can't help
// ═══════════════════════════════════════════════════════
// The assistant is never a wall: off, or out of this month's actions, the
// screen keeps its manual form and says when the assistant is back.

import type { AiUsage } from '../../types/kitchen';
import { formatDayFull } from '../../utils/healthTime';
import { dateInZone } from '../../utils/healthTime';

export const AI_UNAVAILABLE = 'AI_UNAVAILABLE';
export const AI_QUOTA_REACHED = 'AI_QUOTA_REACHED';

export const isAiDown = (code: string | null | undefined) => code === AI_UNAVAILABLE || code === AI_QUOTA_REACHED;

/** "142 of 300 assistant actions left". */
export const usageLine = (u: AiUsage) => `${u.left} of ${u.limit} assistant actions left`;

/** 0–1 of the month's actions used. */
export const usageFill = (u: AiUsage) => (u.limit > 0 ? Math.max(0, Math.min(1, u.used / u.limit)) : 1);

const resetDay = (iso: string) => (iso ? formatDayFull(dateInZone(iso, 'Asia/Karachi')) : 'next month');

/** The manual path's note when the assistant can't help, by the API's code. */
export const aiDownNote = (code: string | null | undefined, details?: Record<string, unknown> | null): { title: string; message: string } => {
  if (code === AI_QUOTA_REACHED) {
    const resetsAt = typeof details?.resetsAt === 'string' ? details.resetsAt : '';
    return details?.feature === 'voice'
      ? { title: 'Voice entry is used up for today', message: 'Type it instead. Voice comes back tomorrow.' }
      : { title: 'Assistant actions used up', message: `You can still do this by hand. Your actions reset on ${resetDay(resetsAt)}.` };
  }
  return { title: 'The assistant is off right now', message: 'You can still do this by hand below.' };
};

/** The meter's line when the assistant is off or used up (null: it's fine). */
export const usageNote = (u: AiUsage | null) => {
  if (!u) return null;
  if (!u.enabled) return 'The assistant is off right now.';
  if (u.left <= 0) return `Used up. Resets on ${resetDay(u.resetsAt)}.`;
  return null;
};
