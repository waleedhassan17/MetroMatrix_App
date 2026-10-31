// Seconds left until an absolute timestamp, re-rendering once a second
// while it runs. State only changes from timer callbacks, never inside the
// effect body itself.

import { useEffect, useState } from 'react';

export function useCountdown(targetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Re-sync at once when the target moves (a resend), then every second.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [targetMs]);

  return remaining;
}
