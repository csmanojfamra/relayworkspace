import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SocketEvents,
  type ChatMessage,
  type CreateRoomResult,
  type ErrorPayload,
  type JoinRequestPayload,
  type JoinResult,
  type PeerStatusPayload,
  type RoomPublicState,
  type UserRole,
} from '@terminalchat/shared';
import { getSocketUrl, isSocketUrlConfigured } from '@/lib/utils';

type SessionPhase =
  | 'landing'
  | 'booting'
  | 'host-ready'
  | 'joining'
  | 'waiting-approval'
  | 'chat'
  | 'error';

interface SessionContextValue {
  phase: SessionPhase;
  role: UserRole | null;
  roomId: string | null;
  inviteUrl: string | null;
  inviteToken: string | null;
  messages: ChatMessage[];
  roomState: RoomPublicState | null;
  peerConnected: boolean;
  peerTyping: boolean;
  latency: number | null;
  joinRequest: JoinRequestPayload | null;
  error: ErrorPayload | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'unavailable';
  sessionStartedAt: number | null;
  bootComplete: boolean;
  createSession: () => void;
  beginJoin: (roomId: string, token: string) => void;
  acceptRequest: () => void;
  rejectRequest: () => void;
  checkPendingRequest: (onResult?: (found: boolean) => void) => void;
  resendJoinRequest: (onResult?: (ok: boolean) => void) => void;
  sendMessage: (content: string) => void;
  setTyping: (typing: boolean) => void;
  markSeen: (ids: string[]) => void;
  reset: () => void;
  setBootComplete: () => void;
  clearError: () => void;
  reconnect: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const SESSION_STORAGE_KEY = 'terminalchat.session';

interface PersistedSession {
  roomId: string;
  sessionKey: string;
  role: UserRole;
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function savePersistedSession(session: PersistedSession | null): void {
  if (!session) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const pingSentRef = useRef<number>(0);
  const sessionKeyRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const phaseRef = useRef<SessionPhase>('landing');

  const [phase, setPhase] = useState<SessionPhase>('landing');
  const [role, setRole] = useState<UserRole | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomState, setRoomState] = useState<RoomPublicState | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequestPayload | null>(null);
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'unavailable'
  >(() => (isSocketUrlConfigured() ? 'connecting' : 'unavailable'));
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [bootComplete, setBootCompleteState] = useState(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const url = getSocketUrl();
    if (!url) {
      setConnectionStatus('unavailable');
      setConnected(false);
      // Still create a disconnected stub-less path: callers expect a socket.
      // Use current origin so Socket.IO exists, but mark unavailable for UI.
    }

    const socket = io(url || undefined, {
      autoConnect: Boolean(url),
      transports: ['websocket', 'polling'],
      reconnection: Boolean(url),
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });

    if (url) setConnectionStatus('connecting');

    const attemptRejoin = () => {
      const persisted = loadPersistedSession();
      const activeRoom = roomIdRef.current ?? persisted?.roomId;
      const activeKey = sessionKeyRef.current ?? persisted?.sessionKey;
      if (!activeRoom || !activeKey) return;
      // Only restore when we already have an active workspace phase, or a
      // persisted session from this browser tab. Never surface a hard error
      // if the ephemeral room is already gone.
      if (!['host-ready', 'chat', 'booting'].includes(phaseRef.current) && !persisted) return;

      socket.emit(
        SocketEvents.REJOIN,
        { roomId: activeRoom, sessionKey: activeKey },
        (result: JoinResult | ErrorPayload) => {
          if ('code' in result) {
            // Stale session after server restart / both endpoints left.
            sessionKeyRef.current = null;
            roomIdRef.current = null;
            savePersistedSession(null);
            if (phaseRef.current === 'landing' || phaseRef.current === 'error') {
              setError(null);
              setPhase('landing');
              setRole(null);
              setRoomId(null);
              setMessages([]);
              setBootCompleteState(false);
            }
            return;
          }
          setRole(result.role);
          setRoomId(result.roomId);
          setMessages(result.messages);
          setSessionStartedAt(result.createdAt);
          setPeerConnected(result.peerConnected);
          sessionKeyRef.current = result.sessionKey;
          savePersistedSession({
            roomId: result.roomId,
            sessionKey: result.sessionKey,
            role: result.role,
          });
          if (phaseRef.current === 'landing' || phaseRef.current === 'error') {
            setPhase(result.role === 'host' && !result.peerConnected ? 'host-ready' : 'chat');
            setBootCompleteState(true);
          }
        }
      );
    };

    socket.on('connect', () => {
      setConnected(true);
      setConnectionStatus('connected');
      setError((prev) => (prev?.code === 'SERVER_ERROR' ? null : prev));
      attemptRejoin();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setConnectionStatus((prev) => (prev === 'unavailable' ? prev : 'connecting'));
    });

    socket.on('connect_error', () => {
      setConnected(false);
      setConnectionStatus('unavailable');
    });
    socket.on(SocketEvents.ROOM_STATE, (state: RoomPublicState) => {
      setRoomState(state);
      setPeerConnected(state.peerConnected);
      if (state.pendingRequest) {
        setJoinRequest(state.pendingRequest);
      }
    });

    socket.on(SocketEvents.JOIN_REQUEST, (request: JoinRequestPayload) => {
      setJoinRequest(request);
    });

    socket.on(SocketEvents.RECEIVE_MESSAGE, (message: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on(SocketEvents.MESSAGE_UPDATED, (message: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    });

    socket.on(SocketEvents.MESSAGE_DELETED, (payload: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
    });

    socket.on(SocketEvents.TYPING_START, () => setPeerTyping(true));
    socket.on(SocketEvents.TYPING_STOP, () => setPeerTyping(false));

    socket.on(SocketEvents.PEER_STATUS, (payload: PeerStatusPayload) => {
      setPeerConnected(payload.connected);
      if (!payload.connected) setPeerTyping(false);
    });

    socket.on(SocketEvents.LATENCY, (payload: { latency: number }) => {
      setLatency(payload.latency);
    });

    socket.on(SocketEvents.ERROR, (payload: ErrorPayload) => {
      // Ignore stale restore noise — handled in rejoin ack.
      if (
        payload.code === 'ROOM_NOT_FOUND' &&
        (phaseRef.current === 'landing' || phaseRef.current === 'error')
      ) {
        sessionKeyRef.current = null;
        savePersistedSession(null);
        setError(null);
        setPhase('landing');
        return;
      }

      setError(payload);
      if (
        payload.code === 'INVALID_INVITE' ||
        payload.code === 'EXPIRED_INVITE' ||
        payload.code === 'ROOM_FULL' ||
        payload.code === 'ROOM_NOT_FOUND' ||
        payload.code === 'HOST_LEFT'
      ) {
        setPhase('error');
      }
    });

    socket.on(SocketEvents.REQUEST_REJECTED, () => {
      setError({
        code: 'UNAUTHORIZED',
        message: 'Access was declined by the host.',
      });
      setPhase('error');
    });

    socket.on('join-approved', (result: JoinResult) => {
      setRole(result.role);
      setRoomId(result.roomId);
      setMessages(result.messages);
      setSessionStartedAt(result.createdAt);
      setPeerConnected(result.peerConnected);
      sessionKeyRef.current = result.sessionKey;
      savePersistedSession({
        roomId: result.roomId,
        sessionKey: result.sessionKey,
        role: result.role,
      });
      setPhase('booting');
    });

    socket.on(SocketEvents.ROOM_LOCKED, () => {
      setRoomState((prev) => (prev ? { ...prev, locked: true, inviteStatus: 'used' } : prev));
      setInviteToken(null);
    });

    socketRef.current = socket;
    return socket;
  }, []);

  useEffect(() => {
    const socket = ensureSocket();

    heartbeatRef.current = window.setInterval(() => {
      if (!socket.connected) return;
      pingSentRef.current = performance.now();
      socket.emit(SocketEvents.HEARTBEAT, { roomId: roomId ?? '' }, () => {
        const rtt = Math.round(performance.now() - pingSentRef.current);
        setLatency(rtt);
      });
    }, 4000);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [ensureSocket, roomId]);

  const createSession = useCallback(() => {
    const socket = ensureSocket();
    setError(null);
    setPhase('booting');
    setBootCompleteState(false);

    const emitCreate = () => {
      socket.emit(SocketEvents.CREATE_ROOM, (result: CreateRoomResult) => {
        setRole(result.role);
        setRoomId(result.roomId);
        // Always build the invite against the browser origin so production
        // never ships localhost links if CLIENT_ORIGIN is misconfigured.
        const origin = window.location.origin.replace(/\/$/, '');
        setInviteUrl(`${origin}/join/${result.roomId}?token=${result.inviteToken}`);
        setInviteToken(result.inviteToken);
        setSessionStartedAt(Date.now());
        setMessages([]);
        setPeerConnected(false);
        setJoinRequest(null);
        sessionKeyRef.current = result.sessionKey;
        savePersistedSession({
          roomId: result.roomId,
          sessionKey: result.sessionKey,
          role: result.role,
        });
      });
    };

    if (socket.connected) {
      emitCreate();
    } else {
      socket.once('connect', emitCreate);
      if (!socket.active) socket.connect();
    }
  }, [ensureSocket]);

  const beginJoin = useCallback(
    (targetRoomId: string, token: string) => {
      const socket = ensureSocket();
      setError(null);
      setPhase('joining');
      setRoomId(targetRoomId);
      setInviteToken(token);
      setBootCompleteState(false);

      const emitJoin = () => {
        socket.emit(
          SocketEvents.JOIN_ROOM,
          { roomId: targetRoomId, token },
          (result: { status: 'pending' } | JoinResult | ErrorPayload) => {
            if ('code' in result) {
              setError(result);
              setPhase('error');
              return;
            }
            if ('status' in result && result.status === 'pending') {
              setPhase('waiting-approval');
            }
          }
        );
      };

      // Wait for socket connect so the join is not lost on a cold start.
      if (socket.connected) {
        emitJoin();
      } else {
        socket.once('connect', emitJoin);
        if (!socket.active) socket.connect();
      }
    },
    [ensureSocket]
  );

  const acceptRequest = useCallback(() => {
    const socket = ensureSocket();
    if (!joinRequest) return;
    socket.emit(SocketEvents.ACCEPT_REQUEST, { requestId: joinRequest.requestId }, (ok: boolean) => {
      if (ok) {
        setJoinRequest(null);
        setPeerConnected(true);
      }
    });
  }, [ensureSocket, joinRequest]);

  const rejectRequest = useCallback(() => {
    const socket = ensureSocket();
    if (!joinRequest) return;
    socket.emit(SocketEvents.REJECT_REQUEST, { requestId: joinRequest.requestId }, () => {
      setJoinRequest(null);
    });
  }, [ensureSocket, joinRequest]);

  const checkPendingRequest = useCallback((onResult?: (found: boolean) => void) => {
    const socket = ensureSocket();
    socket.emit(SocketEvents.GET_PENDING_REQUEST, (request: JoinRequestPayload | null) => {
      if (request) setJoinRequest(request);
      onResult?.(Boolean(request));
    });
  }, [ensureSocket]);

  const resendJoinRequest = useCallback(
    (onResult?: (ok: boolean) => void) => {
      if (!roomId || !inviteToken) {
        onResult?.(false);
        return;
      }
      const socket = ensureSocket();
      const emitResend = () => {
        socket.emit(
          SocketEvents.RESEND_JOIN_REQUEST,
          { roomId, token: inviteToken },
          (result: { status: 'pending' } | ErrorPayload) => {
            if ('code' in result) {
              // Keep guest on the waiting screen for transient host blips.
              if (result.code === 'HOST_LEFT' || result.code === 'ROOM_FULL') {
                onResult?.(false);
                return;
              }
              setError(result);
              setPhase('error');
              onResult?.(false);
              return;
            }
            setPhase('waiting-approval');
            onResult?.(true);
          }
        );
      };

      if (socket.connected) {
        emitResend();
      } else {
        socket.once('connect', emitResend);
        if (!socket.active) socket.connect();
      }
    },
    [ensureSocket, roomId, inviteToken]
  );

  const sendMessage = useCallback(
    (content: string) => {
      const socket = ensureSocket();
      const trimmed = content.trim();
      if (!trimmed) return;
      socket.emit(SocketEvents.SEND_MESSAGE, { content: trimmed });
      socket.emit(SocketEvents.TYPING_STOP);
    },
    [ensureSocket]
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      const socket = ensureSocket();
      socket.emit(typing ? SocketEvents.TYPING_START : SocketEvents.TYPING_STOP);
    },
    [ensureSocket]
  );

  const markSeen = useCallback(
    (ids: string[]) => {
      if (!ids.length || !roomId) return;
      const socket = ensureSocket();
      socket.emit(SocketEvents.SEEN, { roomId, messageIds: ids });
    },
    [ensureSocket, roomId]
  );

  const reset = useCallback(() => {
    setPhase('landing');
    setRole(null);
    setRoomId(null);
    setInviteUrl(null);
    setInviteToken(null);
    setMessages([]);
    setRoomState(null);
    setPeerConnected(false);
    setPeerTyping(false);
    setJoinRequest(null);
    setError(null);
    setSessionStartedAt(null);
    setBootCompleteState(false);
    sessionKeyRef.current = null;
    savePersistedSession(null);
  }, []);

  const setBootComplete = useCallback(() => {
    setBootCompleteState(true);
    setPhase((prev) => {
      if (prev === 'booting') {
        return role === 'host' ? 'host-ready' : 'chat';
      }
      return prev;
    });
  }, [role]);

  useEffect(() => {
    if (bootComplete && role === 'guest' && phase === 'booting') {
      setPhase('chat');
    }
    if (bootComplete && role === 'host' && phase === 'booting') {
      setPhase(peerConnected ? 'chat' : 'host-ready');
    }
  }, [bootComplete, role, phase, peerConnected]);

  useEffect(() => {
    if (role === 'host' && peerConnected && (phase === 'host-ready' || phase === 'booting') && bootComplete) {
      setPhase('chat');
    }
  }, [role, peerConnected, phase, bootComplete]);

  const clearError = useCallback(() => setError(null), []);

  const reconnect = useCallback(() => {
    if (!isSocketUrlConfigured()) {
      setConnectionStatus('unavailable');
      setConnected(false);
      return;
    }
    setConnectionStatus('connecting');
    const socket = ensureSocket();
    if (!socket.connected) {
      socket.connect();
    }
  }, [ensureSocket]);

  const value = useMemo<SessionContextValue>(
    () => ({
      phase,
      role,
      roomId,
      inviteUrl,
      inviteToken,
      messages,
      roomState,
      peerConnected,
      peerTyping,
      latency,
      joinRequest,
      error,
      connected,
      connectionStatus,
      sessionStartedAt,
      bootComplete,
      createSession,
      beginJoin,
      acceptRequest,
      rejectRequest,
      checkPendingRequest,
      resendJoinRequest,
      sendMessage,
      setTyping,
      markSeen,
      reset,
      setBootComplete,
      clearError,
      reconnect,
    }),
    [
      phase,
      role,
      roomId,
      inviteUrl,
      inviteToken,
      messages,
      roomState,
      peerConnected,
      peerTyping,
      latency,
      joinRequest,
      error,
      connected,
      connectionStatus,
      sessionStartedAt,
      bootComplete,
      createSession,
      beginJoin,
      acceptRequest,
      rejectRequest,
      checkPendingRequest,
      resendJoinRequest,
      sendMessage,
      setTyping,
      markSeen,
      reset,
      setBootComplete,
      clearError,
      reconnect,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
