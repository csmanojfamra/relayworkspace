import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';

interface HeaderProps {
  onOpenSidebar?: () => void;
  showMenu?: boolean;
}

/** Slim toolbar — no status label clutter. */
export function Header({ onOpenSidebar, showMenu }: HeaderProps) {
  const { connected, messages, clearMessages } = useSession();
  const [confirmClear, setConfirmClear] = useState(false);
  const canClear = connected && messages.length > 0;

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 3500);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  return (
    <header className="notes-chrome shrink-0 border-b border-[var(--border)]">
      <div className="flex h-11 items-center justify-between gap-2 px-2 sm:h-12 sm:px-3">
        <div className="flex items-center">
          {showMenu ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label="Open notes list"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--me)]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M4 6.5h12v1.4H4V6.5zm0 3.3h12v1.4H4V9.8zm0 3.3h8v1.4H4v-1.4z" />
              </svg>
            </motion.button>
          ) : (
            <span className="px-2 text-[13px] font-medium text-[var(--text-muted)]">Notes</span>
          )}
        </div>

        {canClear && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              clearMessages(() => setConfirmClear(false));
            }}
            className={`rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium ${
              confirmClear ? 'text-[var(--danger)]' : 'text-[var(--me)]'
            }`}
          >
            {confirmClear ? 'Confirm' : 'Clear'}
          </motion.button>
        )}
      </div>
    </header>
  );
}
