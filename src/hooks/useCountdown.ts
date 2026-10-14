// Seconds left until an absolute timestamp, ticking once a second.

import { useEffect, useState } from 'react';

export function useCountdown(targetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [remaining, targetMs]);
  useEffect(() => setNow(Date.now()), [targetMs]);
  return remaining;
}
