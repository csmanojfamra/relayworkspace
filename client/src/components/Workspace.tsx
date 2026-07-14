import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ResizableSidebar } from '@/components/ResizableSidebar';
import { MessageStream } from '@/components/MessageStream';
import { InvitePanel } from '@/components/InvitePanel';
import { StatusBanner } from '@/components/StatusBanner';
import { useSession } from '@/hooks/useSession';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function Workspace() {
  const {
    role,
    phase,
    messages,
    peerTyping,
    peerDraft,
    peerConnected,
    connected,
    latency,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    setTyping,
    sendDraft,
    markSeen,
  } = useSession();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onVisible = useCallback(
    (ids: string[]) => {
      markSeen(ids);
    },
    [markSeen]
  );

  // Invite UI only before the tunnel is established.
  const showInvite = role === 'host' && phase === 'host-ready' && !peerConnected;

  return (
    <motion.div
      className="app-shell safe-pad"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex h-full overflow-hidden">
        <ResizableSidebar />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} mobile />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header showMenu={isMobile} onOpenSidebar={() => setSidebarOpen(true)} />
          <StatusBanner />

          <main className="relative min-h-0 flex-1">
            {showInvite ? (
              <div className="scroll-y h-full">
                <InvitePanel />
              </div>
            ) : (
              <MessageStream
                messages={messages}
                role={role}
                peerTyping={peerTyping}
                peerDraft={peerDraft}
                peerConnected={peerConnected}
                connected={connected}
                latency={latency}
                onVisible={onVisible}
                onSend={sendMessage}
                onEdit={editMessage}
                onDeleteMessage={deleteMessage}
                onAttach={sendAttachment}
                onTyping={setTyping}
                onDraft={sendDraft}
                inputDisabled={!connected}
              />
            )}
          </main>
        </div>
      </div>
    </motion.div>
  );
}
