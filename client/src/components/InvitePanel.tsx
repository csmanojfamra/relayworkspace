import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/hooks/useSession';
import { useCopyToClipboard } from '@/hooks/useUtilities';

export function InvitePanel() {
  const {
    inviteUrl,
    roomId,
    joinRequest,
    acceptRequest,
    rejectRequest,
    peerConnected,
    checkPendingRequest,
  } = useSession();
  const { copied, copy } = useCopyToClipboard();
  const [qr, setQr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkHint, setCheckHint] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteUrl) {
      setQr(null);
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const dark = styles.getPropertyValue('--text').trim() || '#1c1c1e';
    const light = styles.getPropertyValue('--bg-elevated').trim() || '#ffffff';
    void QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 220,
      color: { dark, light },
    }).then(setQr);
  }, [inviteUrl]);

  useEffect(() => {
    if (peerConnected || joinRequest) return;
    checkPendingRequest();
    const id = window.setInterval(() => checkPendingRequest(), 2000);
    return () => window.clearInterval(id);
  }, [peerConnected, joinRequest, checkPendingRequest]);

  if (peerConnected) return null;

  return (
    <div className="relative mx-auto flex h-full w-full max-w-lg flex-col justify-center gap-4 px-4 py-8">
      <div className="inception-wash pointer-events-none absolute inset-0 opacity-70" aria-hidden />

      <div className="relative z-[1] space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="notes-glyph notes-glyph-sm mx-auto mb-4" aria-hidden>
            N
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[var(--text)]">
            Share this note
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-muted)]">
            Send the link. When it opens, you’ll approve access before writing begins.
          </p>
        </motion.div>

        {joinRequest ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] bg-[var(--note)] p-5 shadow-[var(--shadow)]"
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Access request
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">Ready to open the note</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              Accept to unlock the note. The invite can’t be reused after this.
            </p>
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" onClick={acceptRequest}>
                Allow
              </Button>
              <Button className="flex-1" variant="ghost" onClick={rejectRequest}>
                Decline
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[18px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-5 shadow-[var(--shadow)]"
          >
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              Waiting for the invite to be opened.
            </p>
            <Button
              className="mt-4 w-full"
              variant="soft"
              onClick={() => {
                setChecking(true);
                setCheckHint(null);
                checkPendingRequest((found) => {
                  setChecking(false);
                  setCheckHint(
                    found
                      ? null
                      : 'No request yet. Open the link on the other device, or wait a moment.'
                  );
                });
              }}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check for request'}
            </Button>
            {checkHint && (
              <p className="mt-3 text-[12px] text-[var(--text-faint)]">{checkHint}</p>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[18px] border border-[var(--border)] bg-[var(--note)] p-5 shadow-[var(--shadow)]"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Invite link
          </p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">
            Note <span className="font-medium text-[var(--text)]">{roomId}</span> · single use
          </p>
          <div className="mt-3 break-all rounded-[12px] bg-[var(--bg-elevated)] px-3 py-3 text-[12px] leading-relaxed text-[var(--text-muted)] ring-1 ring-[var(--border)]">
            {inviteUrl}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="soft"
              className="min-w-[130px] flex-1"
              onClick={() => inviteUrl && void copy(inviteUrl)}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              variant="ghost"
              className="min-w-[130px] flex-1"
              onClick={async () => {
                if (!inviteUrl) return;
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'Relay note',
                      text: 'Open this shared note on Relay',
                      url: inviteUrl,
                    });
                  } catch {
                    await copy(inviteUrl);
                  }
                } else {
                  await copy(inviteUrl);
                }
              }}
            >
              Share
            </Button>
          </div>
          {qr && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-[12px] text-[var(--text-faint)]">Scan to open</p>
              <img
                src={qr}
                alt="Invite QR code"
                className="rounded-[12px] border border-[var(--border)] bg-white p-2"
                width={148}
                height={148}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
