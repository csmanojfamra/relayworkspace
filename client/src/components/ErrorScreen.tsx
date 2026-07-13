import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { InceptionShell } from '@/components/InceptionShell';
import { useSession } from '@/hooks/useSession';

export function ErrorScreen() {
  const { error, reset, roomId, inviteToken, beginJoin, reconnect } = useSession();

  const canRetryJoin = Boolean(roomId && inviteToken && error?.code === 'SERVER_ERROR');

  return (
    <InceptionShell>
      <div className="flex h-full items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md text-center"
        >
          <div className="notes-glyph notes-glyph-sm mx-auto mb-6" aria-hidden>
            N
          </div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
            Note unavailable
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
            {error?.message ?? 'This note can’t be opened right now'}
          </h2>
          <div className="mt-7 flex flex-col items-center gap-3">
            {canRetryJoin && (
              <Button
                className="min-w-[200px]"
                onClick={() => {
                  reconnect();
                  beginJoin(roomId!, inviteToken!);
                }}
              >
                Try again
              </Button>
            )}
            <Button variant={canRetryJoin ? 'ghost' : 'primary'} onClick={reset}>
              Back to Relay
            </Button>
          </div>
        </motion.div>
      </div>
    </InceptionShell>
  );
}
