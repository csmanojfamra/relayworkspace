import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NoteAttachment } from '@terminalchat/shared';

interface NoteAttachmentPreviewProps {
  attachment: NoteAttachment;
  url: string;
  canRemove?: boolean;
  onRemove?: () => void;
}

function isPdf(attachment: NoteAttachment): boolean {
  const mime = attachment.mime.toLowerCase();
  if (mime === 'application/pdf' || mime.includes('pdf')) return true;
  return attachment.name.toLowerCase().endsWith('.pdf');
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Inline photo / PDF preview with Apple Notes–style expand. */
export function NoteAttachmentPreview({
  attachment,
  url,
  canRemove,
  onRemove,
}: NoteAttachmentPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const pdf = isPdf(attachment);
  const image = attachment.kind === 'image' && !pdf;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  return (
    <div className="note-attachment mb-1 py-1">
      {image && (
        <button
          type="button"
          className="note-media-frame group relative block w-full max-w-lg cursor-zoom-in border-0 bg-transparent p-0 text-left"
          onClick={() => setExpanded(true)}
          aria-label={`Expand ${attachment.name}`}
        >
          <img
            src={url}
            alt={attachment.name}
            className="max-h-[min(58vh,420px)] w-full rounded-[14px] object-contain ring-1 ring-[var(--border)] transition-[filter] duration-200 group-hover:brightness-[0.98]"
            loading="lazy"
          />
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-[8px] bg-[color-mix(in_srgb,var(--text)_55%,transparent)] px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Expand
          </span>
        </button>
      )}

      {pdf && (
        <div className="note-pdf-card max-w-lg overflow-hidden rounded-[14px] ring-1 ring-[var(--border)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--text)]">{attachment.name}</p>
              <p className="text-[11px] text-[var(--text-faint)]">PDF · {formatBytes(attachment.size)}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className="rounded-[8px] px-2 py-1 text-[12px] font-medium text-[var(--me)] hover:bg-[color-mix(in_srgb,var(--me)_10%,transparent)]"
                onClick={() => setExpanded(true)}
              >
                Expand
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[8px] px-2 py-1 text-[12px] font-medium text-[var(--text-muted)] no-underline hover:bg-[var(--bg-soft)]"
              >
                Open
              </a>
            </div>
          </div>
          <div className="note-pdf-frame bg-[var(--note)]">
            <iframe
              title={attachment.name}
              src={`${url}#toolbar=0&navpanes=0&view=FitH`}
              className="h-[min(52vh,380px)] w-full border-0"
            />
          </div>
        </div>
      )}

      {!image && !pdf && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={attachment.name}
          className="inline-flex max-w-full items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--me)] no-underline"
        >
          <span className="truncate font-medium">{attachment.name}</span>
          <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
            {formatBytes(attachment.size)}
          </span>
        </a>
      )}

      {canRemove && onRemove && (
        <button
          type="button"
          className="mt-1.5 text-[12px] text-[var(--text-faint)] hover:text-[var(--danger)]"
          onClick={onRemove}
        >
          Remove
        </button>
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="media-lightbox"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[80] flex flex-col bg-[color-mix(in_srgb,#000_72%,transparent)] backdrop-blur-[2px]"
                onClick={() => setExpanded(false)}
              >
                <div
                  className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,var(--safe-top))]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p id={titleId} className="min-w-0 truncate text-[14px] font-medium text-white">
                    {attachment.name}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-white/90 no-underline hover:bg-white/10"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      className="rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/10"
                      onClick={() => setExpanded(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>

                <motion.div
                  initial={{ scale: 0.96, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(16px,var(--safe-bottom))]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {image ? (
                    <img
                      src={url}
                      alt={attachment.name}
                      className="max-h-full max-w-full rounded-[12px] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                    />
                  ) : (
                    <iframe
                      title={attachment.name}
                      src={`${url}#view=FitH`}
                      className="h-full min-h-[70vh] w-full max-w-5xl rounded-[12px] border-0 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                    />
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
