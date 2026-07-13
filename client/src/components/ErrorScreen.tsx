import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/hooks/useSession';

export function ErrorScreen() {
  const { error, reset, roomId, inviteToken, beginJoin, reconnect } = useSession();

  const canRetryJoin = Boolean(roomId && inviteToken && error?.code === 'SERVER_ERROR');

  return (
    <div className="app-shell safe-pad flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass w-full max-w-md rounded-2xl p-6 text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
          Workspace Interrupted
        </p>
        <h2 className="mt-3 text-xl font-semibold text-[var(--text)]">
          {error?.message ?? 'Unable to continue workspace'}
        </h2>
        {error?.code && (
          <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">⚠ {error.code}</p>
        )}
        <div className="mt-6 flex flex-col items-center gap-3">
          {canRetryJoin && (
            <Button
              className="min-w-[200px]"
              onClick={() => {
                reconnect();
                beginJoin(roomId!, inviteToken!);
              }}
            >
              Retry connection
            </Button>
          )}
          <Button variant={canRetryJoin ? 'ghost' : 'primary'} onClick={reset}>
            Return Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
