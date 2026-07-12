import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/hooks/useSession';
import { useCopyToClipboard } from '@/hooks/useUtilities';
import { AsciiRule } from '@/components/SystemEventLine';

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
    const dark = styles.getPropertyValue('--text').trim() || '#e8eaed';
    const light = styles.getPropertyValue('--bg-elevated').trim() || '#111214';
    void QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 220,
      color: { dark, light },
    }).then(setQr);
  }, [inviteUrl]);

  // Keep polling so a missed socket event still surfaces the authorization card.
  useEffect(() => {
    if (peerConnected || joinRequest) return;
    checkPendingRequest();
    const id = window.setInterval(() => checkPendingRequest(), 2000);
    return () => window.clearInterval(id);
  }, [peerConnected, joinRequest, checkPendingRequest]);

  const onManualCheck = () => {
    setChecking(true);
    setCheckHint(null);
    checkPendingRequest((found) => {
      setChecking(false);
      setCheckHint(
        found
          ? null
          : 'No pending request yet. Ask the remote endpoint to open the invite.'
      );
    });
  };

  if (peerConnected) return null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      {joinRequest ? (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass rounded-2xl border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Incoming Endpoint
          </p>
          <div className="mt-4 font-mono text-[12px] text-[var(--text)]">
            <AsciiRule />
            <p className="py-2 text-[var(--accent)]">&gt; Remote endpoint requesting access</p>
            <AsciiRule />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Authorize to establish a permanent secure tunnel. Workspace locks after join.
          </p>
          <div className="mt-5 flex gap-3">
            <Button className="flex-1" onClick={acceptRequest}>
              Establish Tunnel
            </Button>
            <Button className="flex-1" variant="danger" onClick={rejectRequest}>
              Deny
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
            Authorization
          </p>
          <p className="mt-3 text-sm text-[var(--text)]">
            When the remote endpoint opens your invite, their request appears here.
          </p>
          <Button
            className="mt-4 w-full"
            variant="soft"
            onClick={onManualCheck}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Check Incoming Request'}
          </Button>
          {checkHint && !joinRequest && (
            <p className="mt-3 font-mono text-[11px] text-[var(--text-faint)]">{checkHint}</p>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-2xl p-5"
      >
        <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
          Share Workspace
        </p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">Invite remote endpoint</h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
          Workspace <span className="font-mono text-[var(--text)]">{roomId}</span>. Single-use invite.
          Session encrypts after authorization.
        </p>

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 font-mono text-[11px] leading-relaxed text-[var(--text-muted)] break-all">
          {inviteUrl}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="soft"
            onClick={() => inviteUrl && void copy(inviteUrl)}
            className="min-w-[140px] flex-1"
          >
            {copied ? 'Link Copied' : 'Copy Link'}
          </Button>
          <Button
            variant="ghost"
            className="min-w-[140px] flex-1"
            onClick={async () => {
              if (!inviteUrl) return;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'Relay Workspace',
                    text: 'Join my temporary secure Relay workspace',
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
            Share Link
          </Button>
        </div>

        {qr && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
              Scan to Connect
            </p>
            <motion.img
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              src={qr}
              alt="Invite QR code"
              className="rounded-xl border border-[var(--border)]"
              width={180}
              height={180}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
