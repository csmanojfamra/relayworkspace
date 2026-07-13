import { useEffect } from 'react';

/**
 * Align the app shell with the visual viewport on mobile.
 * Use vv.height only — do NOT also pad for keyboard (that double-shrinks the UI).
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Height already tracks the visible area above the keyboard.
        root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
        root.style.setProperty('--keyboard-offset', '0px');
      });
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);
}
