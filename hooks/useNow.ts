// MetroMatrix — The current time, refreshed every `everyMs` (waiting timers, "starts in").

import { useEffect, useState } from 'react';

export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
