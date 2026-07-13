import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { InceptionShell } from '@/components/InceptionShell';
import { useSession } from '@/hooks/useSession';

const JOIN_STEPS = ['Finding note…', 'Checking invite…', 'Waiting for access…'] as const;

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
      <InceptionShell>
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md text-center">
            <div className="notes-glyph notes-glyph-sm mx-auto mb-6" aria-hidden>
              N
            </div>
            <p className="text-[15px] font-semibold text-[var(--danger)]">Invite incomplete</p>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">
              This link is missing what Relay needs to open the note.
            </p>
            <Button className="mt-7 min-w-[180px]" onClick={reset}>
              Back to Relay
            </Button>
          </div>
        </div>
      </InceptionShell>
    );
  }

  if (phase === 'error' && error) {
    return (
      <InceptionShell>
        <div className="flex h-full items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center"
          >
            <div className="notes-glyph notes-glyph-sm mx-auto mb-6" aria-hidden>
              N
            </div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
              Can’t open note
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
              {error.message}
            </h2>
            <Button className="mt-7 min-w-[180px]" onClick={reset}>
              Back to Relay
            </Button>
          </motion.div>
        </div>
      </InceptionShell>
    );
  }

  return (
    <InceptionShell>
      <div className="flex h-full items-center justify-center px-6">
        <div className="w-full max-w-[22rem]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="notes-glyph notes-glyph-sm mx-auto mb-6" aria-hidden>
              N
            </div>
            <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[var(--text)]">
              You’re invited
            </h1>
            <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-muted)]">
              This link opens a shared note. Access is confirmed before writing starts.
            </p>
          </motion.div>

          <div className="mt-8 rounded-[18px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--note)_88%,transparent)] p-5 shadow-[var(--shadow)]">
            <div className="space-y-3.5">
              {JOIN_STEPS.map((label, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <div key={label} className="flex items-center gap-3 text-[14px]">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-semibold ${
                        done
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                          : active
                            ? 'border border-[var(--accent)] text-[var(--text)]'
                            : 'border border-[var(--border)] text-[var(--text-faint)]'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      className={active || done ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {phase === 'waiting-approval' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 border-t border-[var(--border)] pt-5"
                >
                  <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                    Waiting for access. Keep this page open.
                  </p>
                  {!connected && (
                    <p className="mt-2 text-[12px] text-[var(--warning)]">
                      Connection interrupted — restoring…
                    </p>
                  )}
                  <Button
                    className="mt-4 w-full"
                    variant="soft"
                    disabled={requesting || connectionStatus === 'unavailable'}
                    onClick={() => {
                      setRequesting(true);
                      setRequestHint(null);
                      resendJoinRequest((ok, detail) => {
                        setRequesting(false);
                        setRequestHint(
                          ok
                            ? 'Request sent again.'
                            : detail?.trim() || 'Couldn’t send the request. Try again.'
                        );
                      });
                    }}
                  >
                    {requesting ? 'Asking…' : 'Ask again'}
                  </Button>
                  {requestHint && (
                    <p className="mt-3 text-center text-[12px] text-[var(--text-faint)]">
                      {requestHint}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </InceptionShell>
  );
}
