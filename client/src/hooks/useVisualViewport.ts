import { useEffect } from 'react';

/**
 * Keeps the app shell aligned with the visual viewport so the command bar
 * stays above the on-screen keyboard on iOS/Android.
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
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--keyboard-offset', `${offset}px`);
        root.style.setProperty('--vv-height', `${vv.height}px`);
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
