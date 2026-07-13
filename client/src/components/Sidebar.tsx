import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/hooks/useTheme';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  mobile?: boolean;
  fill?: boolean;
}

export function Sidebar({ open, onClose, mobile = false, fill = false }: SidebarProps) {
  const {
    roomId,
    connected,
    peerConnected,
    messages,
    clearMessages,
    sessionStartedAt,
  } = useSession();
  const { themeId, setThemeId, themes } = useTheme();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const preview = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) return 'No notes yet';
    const line = last.content.trim().split('\n')[0] ?? '';
    return line.length > 48 ? `${line.slice(0, 48)}…` : line;
  }, [messages]);

  const listTitle = useMemo(() => {
    const first = messages[0]?.content?.trim();
    if (!first) return 'Untitled';
    const line = first.split('\n')[0] ?? first;
    return line.length > 28 ? `${line.slice(0, 28)}…` : line;
  }, [messages]);

  const startedLabel = sessionStartedAt
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
        new Date(sessionStartedAt)
      )
    : 'Today';

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  const onClearPad = () => {
    if (!messages.length || clearing || !connected) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    clearMessages(() => {
      setClearing(false);
      setConfirmClear(false);
      if (mobile) onClose();
    });
  };

  const content = (
    <aside className="notes-sidebar flex h-full w-full flex-col border-r border-[var(--border)]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-[22px] font-bold tracking-[-0.03em]">Notes</p>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-[var(--me)]"
            aria-label="Close"
          >
            Done
          </button>
        )}
      </div>

      <div className="scroll-y flex-1 px-2 pb-4">
        <p className="px-2 pb-1.5 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          On Relay
        </p>

        <button
          type="button"
          className="flex w-full flex-col rounded-[12px] bg-[var(--bg-elevated)] px-3 py-2.5 text-left shadow-[var(--note-shadow)] ring-1 ring-[color-mix(in_srgb,var(--accent)_35%,var(--border))]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {listTitle}
            </span>
            <span className="shrink-0 text-[12px] text-[var(--text-faint)]">{startedLabel}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">{preview}</p>
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">
            {peerConnected ? 'Shared' : 'Private'}
            {roomId ? ` · ${roomId}` : ''}
          </p>
        </button>

        <p className="px-2 pb-1.5 pt-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          Appearance
        </p>
        <div className="mx-1 space-y-1 rounded-[12px] bg-[var(--bg-elevated)] p-1.5 ring-1 ring-[var(--border)]">
          {themes.map((theme) => {
            const active = themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setThemeId(theme.id)}
                className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[14px] ${
                  active ? 'bg-[var(--accent-soft)] font-semibold' : 'text-[var(--text-muted)]'
                }`}
              >
                <span>{theme.label}</span>
                {active && <span className="text-[var(--text)]">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="mx-1 mt-6">
          <button
            type="button"
            disabled={!messages.length || !connected || clearing}
            onClick={onClearPad}
            className={`w-full rounded-[12px] px-3 py-3 text-left text-[14px] ring-1 ${
              confirmClear
                ? 'bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-elevated))] text-[var(--danger)] ring-[color-mix(in_srgb,var(--danger)_30%,transparent)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text)] ring-[var(--border)] disabled:opacity-40'
            }`}
          >
            <span className="block font-semibold">
              {clearing ? 'Clearing…' : confirmClear ? 'Tap again to clear all' : 'Clear all notes'}
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--text-faint)]">
              Or type /clear while writing
            </span>
          </button>
        </div>
      </div>
    </aside>
  );

  if (!mobile) {
    if (fill) return <div className="h-full w-full">{content}</div>;
    return <div className="hidden h-full w-[300px] shrink-0 lg:block">{content}</div>;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close overlay"
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 left-0 z-50 w-[min(90vw,340px)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] shadow-[var(--shadow)] lg:hidden"
            initial={{ x: '-105%' }}
            animate={{ x: 0 }}
            exit={{ x: '-105%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.85 }}
          >
            {content}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
