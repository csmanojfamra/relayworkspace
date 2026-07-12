import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Sidebar } from '@/components/Sidebar';

const MIN = 240;
const MAX = 420;
const DEFAULT = 280;
const STORAGE_KEY = 'terminalchat.sidebarWidth';

export function ResizableSidebar() {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved >= MIN && saved <= MAX ? saved : DEFAULT;
  });
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const next = Math.min(MAX, Math.max(MIN, e.clientX));
    setWidth(next);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  return (
    <div className="relative hidden h-full shrink-0 lg:flex" style={{ width }}>
      <div className="h-full w-full overflow-hidden">
        <Sidebar open onClose={() => undefined} mobile={false} fill />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-[var(--accent-soft)]"
      />
    </div>
  );
}
