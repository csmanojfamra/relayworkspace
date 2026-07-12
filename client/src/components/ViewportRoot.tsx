import type { ReactNode } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export function ViewportRoot({ children }: { children: ReactNode }) {
  useVisualViewport();
  return children;
}
