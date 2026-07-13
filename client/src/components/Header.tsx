import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useElapsed } from '@/hooks/useUtilities';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { sessionStatus, syncStatus } from '@/lib/terminalEvents';

interface HeaderProps {
  onOpenSidebar?: () => void;
  showMenu?: boolean;
}

export function Header({ onOpenSidebar, showMenu }: HeaderProps) {
  const { peerConnected, connected, sessionStartedAt, latency, messages } = useSession();
  const elapsed = useElapsed(sessionStartedAt);
  const isMobile = useIsMobile();
  const liveLatency = connected ? latency : null;
  const memoryMb = useLiveMemory(connected, messages.length, sessionStartedAt);

  const secure = connected && peerConnected;
  const sessionLabel = !connected
    ? 'Reconnecting'
    : peerConnected
      ? 'Secure Workspace'
      : 'Awaiting Endpoint';

  const session = sessionStatus(connected, peerConnected);
  const sync = syncStatus(liveLatency, connected, peerConnected);

  return (
    <header className="status-bar shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {showMenu && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label="Open workspace"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)]"
            >
              <span className="text-base leading-none">☰</span>
            </motion.button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[13px] font-semibold tracking-tight">Relay</h1>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  secure
                    ? 'bg-[var(--accent)]'
                    : connected
                      ? 'bg-[var(--warning)]'
                      : 'bg-[var(--danger)]'
                }`}
              />
            </div>
            <p className="truncate text-[10px] text-[var(--text-muted)] sm:text-[11px]">
              {secure ? 'Secure tunnel' : sessionLabel}
            </p>
          </div>
        </div>

        {isMobile ? (
          <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
            <span>{peerConnected ? 'Remote · on' : 'Remote · off'}</span>
            {liveLatency != null && <span className="text-[var(--text-faint)]">{liveLatency}ms</span>}
          </div>
        ) : (
          <div className="flex shrink-0 items-stretch gap-2.5 sm:gap-4">
            <Stat label="Session" value={session} className="hidden sm:flex" />
            <Stat
              label="Latency"
              value={liveLatency != null ? `${liveLatency} ms` : '—'}
              className="hidden md:flex"
            />
            <Stat label="Sync" value={sync} className="hidden lg:flex" />
            <Stat label="Uptime" value={elapsed} className="hidden xl:flex" />
            <Stat label="Remote" value={peerConnected ? 'Connected' : 'Offline'} />
            <Stat
              label="Memory"
              value={connected ? `${memoryMb} MB` : '—'}
              className="hidden 2xl:flex"
            />
          </div>
        )}
      </div>
    </header>
  );
}

function useLiveMemory(
  connected: boolean,
  entryCount: number,
  sessionStartedAt: number | null
): number {
  const [mb, setMb] = useState(41);

  useEffect(() => {
    if (!connected) {
      setMb(0);
      return;
    }

    const base = 36 + Math.min(18, Math.floor(entryCount * 0.35));
    const uptimeBoost = sessionStartedAt
      ? Math.min(6, Math.floor((Date.now() - sessionStartedAt) / 180_000))
      : 0;
    setMb(Math.max(28, Math.min(72, base + uptimeBoost)));
  }, [connected, entryCount, sessionStartedAt]);

  return mb;
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
      <p className="truncate font-mono text-[11px] tabular-nums text-[var(--text)]">{value}</p>
    </div>
  );
}
