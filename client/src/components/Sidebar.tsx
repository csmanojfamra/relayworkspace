import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/hooks/useTheme';
import { useElapsed } from '@/hooks/useUtilities';
import { connectionHealth } from '@/lib/terminalEvents';

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
    role,
  } = useSession();
  const { themeId, setThemeId, themes } = useTheme();
  const elapsed = useElapsed(sessionStartedAt);
  const health = connectionHealth(latency, connected, peerConnected);

  const content = (
    <aside className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Workspace Information
          </p>
          <p className="mt-1.5 font-mono text-[13px] text-[var(--text)]">{roomId ?? '—'}</p>
        </div>
        {mobile && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            aria-label="Close workspace"
          >
            ✕
          </motion.button>
        )}
      </div>

      <div className="scroll-y flex-1 space-y-7 px-4 py-5">
        <Section title="Workspace">
          <Row label="Workspace ID" value={roomId ?? '—'} mono />
          <Row
            label="Connection"
            value={
              !connected ? 'Interrupted' : peerConnected ? 'Secure tunnel' : 'Listening'
            }
          />
          <Row label="Encryption" value={peerConnected ? 'Active' : 'Pending'} />
          <Row
            label="Remote Endpoint"
            value={peerConnected ? (role === 'host' ? 'remote@relay' : 'host@relay') : '—'}
            mono
          />
          <Row label="Started" value={formatStarted(sessionStartedAt)} />
          <Row label="Duration" value={elapsed} mono />
          <Row label="Latency" value={latency != null ? `${latency} ms` : '—'} mono />
          <Row label="Session Health" value={health} />
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
                      ? 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_12%,transparent)]'
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
    <motion.div
      layout
      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]"
    >
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <motion.span
        key={value}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        className={`truncate text-xs text-[var(--text)] ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </motion.span>
    </motion.div>
  );
}

function formatStarted(ts: number | null): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}
