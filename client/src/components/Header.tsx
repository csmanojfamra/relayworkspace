import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '@/hooks/useSession';
import { useElapsed } from '@/hooks/useUtilities';
import {
  memoryStatus,
  sessionStatus,
  syncStatus,
} from '@/lib/terminalEvents';

interface HeaderProps {
  onOpenSidebar?: () => void;
  showMenu?: boolean;
}

export function Header({ onOpenSidebar, showMenu }: HeaderProps) {
  const { peerConnected, connected, sessionStartedAt, latency } = useSession();
  const elapsed = useElapsed(sessionStartedAt);

  const secure = connected && peerConnected;
  const sessionLabel = !connected
    ? 'Reconnecting'
    : peerConnected
      ? 'Secure Workspace'
      : 'Awaiting Endpoint';

  const session = sessionStatus(connected, peerConnected);
  const sync = syncStatus(latency, connected, peerConnected);
  const memory = memoryStatus(latency, connected);

  return (
    <header className="status-bar shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_90%,transparent)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {showMenu && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label="Open workspace"
              onClick={onOpenSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            >
              <span className="text-base leading-none">☰</span>
            </motion.button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[13px] font-semibold tracking-tight">Relay</h1>
              <span className="relative flex h-2 w-2">
                <AnimatePresence>
                  {secure && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 0.45, scale: 1.8 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full bg-[var(--accent)]"
                    />
                  )}
                </AnimatePresence>
                <span
                  className={`relative inline-block h-2 w-2 rounded-full transition-colors duration-300 ${
                    secure
                      ? 'bg-[var(--accent)]'
                      : connected
                        ? 'bg-[var(--warning)]'
                        : 'bg-[var(--danger)]'
                  }`}
                />
              </span>
            </div>
            <motion.p
              key={sessionLabel}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className="truncate text-[11px] text-[var(--text-muted)]"
            >
              {secure ? '✓ Secure tunnel active' : sessionLabel}
            </motion.p>
          </div>
        </div>

        <div className="flex shrink-0 items-stretch gap-2.5 sm:gap-4">
          <Stat label="Session" value={session} className="hidden sm:flex" />
          <Stat
            label="Latency"
            value={latency != null ? `${latency} ms` : '—'}
            className="hidden md:flex"
          />
          <Stat label="Sync" value={sync} className="hidden lg:flex" />
          <Stat label="Uptime" value={elapsed} className="hidden xl:flex" />
          <Stat
            label="Remote"
            value={peerConnected ? 'Connected' : 'Offline'}
          />
          <Stat label="Memory" value={memory} className="hidden 2xl:flex" />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto border-t border-[var(--border)] px-3 py-1.5 no-scrollbar sm:hidden">
        <MiniStat label="Session" value={session} />
        <MiniStat label="RTT" value={latency != null ? `${latency} ms` : '—'} />
        <MiniStat label="Sync" value={sync} />
        <MiniStat label="Up" value={elapsed} />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex-col justify-center text-right ${className || 'flex'}`}>
      <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</p>
      <motion.p
        key={value}
        initial={{ opacity: 0.45, y: 1 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="truncate font-mono text-[11px] text-[var(--text)]"
      >
        {value}
      </motion.p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg)] px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-[10px] text-[var(--text-muted)]">{value}</span>
    </div>
  );
}
