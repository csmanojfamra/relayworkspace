import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/hooks/useSession';

const JOIN_STEPS = [
  'Connecting workspace...',
  'Verifying secure invite...',
  'Awaiting host authorization...',
] as const;

export function JoinFlow() {
  const { roomId = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { beginJoin, phase, error, reset, resendJoinRequest, connected, connectionStatus } =
    useSession();
  const [step, setStep] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestHint, setRequestHint] = useState<string | null>(null);
  const started = useMemo(() => Boolean(roomId && token), [roomId, token]);
  const requested = useRef(false);

  useEffect(() => {
    if (!started || requested.current) return;
    requested.current = true;
    beginJoin(roomId, token);
  }, [started, roomId, token, beginJoin]);

  useEffect(() => {
    if (phase === 'joining') setStep(0);
    if (phase === 'waiting-approval') setStep(2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'joining') return;
    const t1 = window.setTimeout(() => setStep(1), 700);
    return () => window.clearTimeout(t1);
  }, [phase]);

  if (!roomId || !token) {
    return (
      <div className="app-shell safe-pad flex items-center justify-center px-6">
        <div className="glass w-full max-w-md rounded-2xl p-6 text-center">
          <p className="font-mono text-sm text-[var(--danger)]">⚠ Invalid invite</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            This invite link is incomplete or malformed.
          </p>
          <Button className="mt-6" onClick={reset}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'error' && error) {
    return (
      <div className="app-shell safe-pad flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-md rounded-2xl p-6 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
            Access Denied
          </p>
          <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">{error.message}</h2>
          <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">{error.code}</p>
          <Button className="mt-6" onClick={reset}>
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-shell safe-pad flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-faint)]">
          Remote Access
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Connecting workspace</h1>

        <div className="glass mt-8 rounded-2xl p-5">
          <div className="space-y-4">
            {JOIN_STEPS.map((label, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <motion.div
                  key={label}
                  animate={{ opacity: done || active ? 1 : 0.35 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className={active ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]'}>
                    {done ? '✓' : active ? '>' : '·'}
                  </span>
                  <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>
                    {label}
                  </span>
                  {active && (
                    <span className="blink ml-1 inline-block h-4 w-[7px] bg-[var(--cursor)]" />
                  )}
                </motion.div>
              );
            })}
          </div>

          <AnimatePresence>
            {phase === 'waiting-approval' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6"
              >
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  &gt; Waiting for host authorization. Keep this window open.
                </p>
                {!connected && (
                  <p className="mt-2 font-mono text-[11px] text-[var(--warning)]">
                    &gt; Connection interrupted — restoring request…
                  </p>
                )}
                <Button
                  className="mt-4 w-full"
                  variant="soft"
                  disabled={requesting || connectionStatus === 'unavailable'}
                  onClick={() => {
                    setRequesting(true);
                    setRequestHint(null);
                    resendJoinRequest((ok) => {
                      setRequesting(false);
                      setRequestHint(
                        ok
                          ? '> Access request sent to host again.'
                          : '> Could not notify host. Try again.'
                      );
                    });
                  }}
                >
                  {requesting ? 'Requesting…' : 'Request Access'}
                </Button>
                {requestHint && (
                  <p className="mt-3 font-mono text-[11px] text-[var(--text-faint)]">
                    {requestHint}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
