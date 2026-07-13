import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/hooks/useTheme';
import { useElapsed } from '@/hooks/useUtilities';

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
    latency,
    sessionStartedAt,
    messages,
    clearMessages,
  } = useSession();
  const { themeId, setThemeId, themes } = useTheme();
  const elapsed = useElapsed(sessionStartedAt);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const noteCount = messages.length;

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  const onClearPad = () => {
    if (!noteCount || clearing || !connected) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    clearMessages((ok) => {
      setClearing(false);
      setConfirmClear(false);
      if (ok && mobile) onClose();
    });
  };

  const content = (
    <aside className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Shared pad
          </p>
          <p className="mt-1.5 font-mono text-[13px] text-[var(--text)]">{roomId ?? '—'}</p>
        </div>
        {mobile && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            aria-label="Close workspace"
          >
            ✕
          </motion.button>
        )}
      </div>

      <div className="scroll-y flex-1 space-y-7 px-4 py-5">
        <Section title="Status">
          <Row
            label="Connection"
            value={!connected ? 'Interrupted' : peerConnected ? 'Linked' : 'Waiting'}
          />
          <Row label="Remote" value={peerConnected ? 'Online' : 'Offline'} />
          <Row label="Open for" value={elapsed} mono />
          <Row label="Latency" value={latency != null ? `${latency} ms` : '—'} mono />
          <Row label="Notes" value={noteCount ? String(noteCount) : 'None'} mono />
        </Section>

        <Section title="Pad">
          <motion.button
            type="button"
            whileTap={noteCount && connected ? { scale: 0.98 } : undefined}
            disabled={!noteCount || !connected || clearing}
            onClick={onClearPad}
            className={`w-full rounded-xl border px-3 py-3 text-left text-xs transition-colors ${
              confirmClear
                ? 'border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg))] text-[var(--danger)]'
                : noteCount && connected
                  ? 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--border-strong)]'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-faint)] opacity-50'
            }`}
          >
            <span className="block font-medium">
              {clearing
                ? 'Clearing…'
                : confirmClear
                  ? 'Tap again to clear all notes'
                  : 'Clear all notes'}
            </span>
            <span className="mt-1 block text-[10px] tracking-wide text-[var(--text-faint)]">
              {confirmClear
                ? 'Removes the pad for both of you'
                : 'Or type /clear in the composer'}
            </span>
          </motion.button>
        </Section>

        <Section title="Theme">
          <div className="space-y-2">
            {themes.map((theme) => {
              const active = themeId === theme.id;
              return (
                <motion.button
                  key={theme.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setThemeId(theme.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-200 ${
                    active
                      ? 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{theme.label}</span>
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </Section>
      </div>
    </aside>
  );

  if (!mobile) {
    if (fill) return <div className="h-full w-full">{content}</div>;
    return <div className="hidden h-full w-[280px] shrink-0 lg:block">{content}</div>;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close overlay"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[6px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 left-0 z-50 w-[min(88vw,330px)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] shadow-[var(--shadow)] lg:hidden"
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className={`truncate text-xs text-[var(--text)] ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
