import { useEffect, useState } from 'react';

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function useCountdown(deleteAt: number | null | undefined): string | null {
  const [remaining, setRemaining] = useState<string | null>(() => {
    if (!deleteAt) return null;
    return formatRemaining(deleteAt - Date.now());
  });

  useEffect(() => {
    if (!deleteAt) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const left = deleteAt - Date.now();
      if (left <= 0) {
        setRemaining('00:00');
        return;
      }
      setRemaining(formatRemaining(left));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deleteAt]);

  return remaining;
}
