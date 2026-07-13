import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useElapsed } from '@/hooks/useUtilities';
import { useIsMobile } from '@/hooks/useMediaQuery';

interface HeaderProps {
  onOpenSidebar?: () => void;
  showMenu?: boolean;
}

export function Header({ onOpenSidebar, showMenu }: HeaderProps) {
  const { peerConnected, connected, sessionStartedAt, latency, messages, clearMessages } =
    useSession();
  const elapsed = useElapsed(sessionStartedAt);
  const isMobile = useIsMobile();
  const liveLatency = connected ? latency : null;
  const [confirmClear, setConfirmClear] = useState(false);
  const canClear = connected && messages.length > 0;

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 3500);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  const secure = connected && peerConnected;
  const statusLabel = !connected
    ? 'Reconnecting…'
    : peerConnected
      ? 'Shared notes'
      : 'Waiting for remote';

  const onClear = () => {
    if (!canClear) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearMessages(() => setConfirmClear(false));
  };

  return (
    <header className="notes-chrome shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {showMenu && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label="Open workspace"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-muted)]"
            >
              <span className="text-base leading-none" aria-hidden>
                ☰
              </span>
            </motion.button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                Relay
              </h1>
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  secure
                    ? 'bg-[var(--accent)]'
                    : connected
                      ? 'bg-[var(--warning)]'
                      : 'bg-[var(--danger)]'
                }`}
                aria-hidden
              />
            </div>
            <p className="truncate text-[11px] tracking-wide text-[var(--text-muted)]">
              {statusLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {canClear && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onClear}
              aria-label={confirmClear ? 'Confirm clear all notes' : 'Clear all notes'}
              title={confirmClear ? 'Tap again to confirm' : 'Clear all notes'}
              className={`rounded-xl border px-2.5 py-1.5 text-[11px] tracking-wide transition-colors ${
                confirmClear
                  ? 'border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] text-[var(--danger)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {confirmClear ? 'Confirm clear' : 'Clear'}
            </motion.button>
          )}

          {isMobile ? (
            <div className="flex items-center gap-2.5 text-[11px] tabular-nums text-[var(--text-muted)]">
              <span
                className={
                  peerConnected
                    ? 'text-[var(--accent)]'
                    : connected
                      ? 'text-[var(--text-faint)]'
                      : 'text-[var(--danger)]'
                }
              >
                {peerConnected ? 'Remote on' : 'Remote off'}
              </span>
              {liveLatency != null && (
                <span className="font-mono text-[10px] text-[var(--text-faint)]">
                  {liveLatency}ms
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <Meta
                label="Remote"
                value={peerConnected ? 'Connected' : 'Offline'}
                emphasize={peerConnected}
              />
              <Meta
                label="Latency"
                value={liveLatency != null ? `${liveLatency} ms` : '—'}
                className="hidden md:flex"
              />
              <Meta label="Open" value={elapsed} className="hidden lg:flex" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Meta({
  label,
  value,
  emphasize = false,
  className = '',
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex-col justify-center text-right ${className || 'flex'}`}>
      <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</p>
      <p
        className={`truncate text-[12px] tabular-nums ${
          emphasize ? 'text-[var(--accent)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
