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
import { getSocketUrl } from '@/lib/utils';

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
  sessionStartedAt: number | null;
  bootComplete: boolean;
  createSession: () => void;
  beginJoin: (roomId: string, token: string) => void;
  acceptRequest: () => void;
  rejectRequest: () => void;
  sendMessage: (content: string) => void;
  setTyping: (typing: boolean) => void;
  markSeen: (ids: string[]) => void;
  reset: () => void;
  setBootComplete: () => void;
  clearError: () => void;
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

    const socket = io(getSocketUrl(), {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    const attemptRejoin = () => {
      const persisted = loadPersistedSession();
      const activeRoom = roomIdRef.current ?? persisted?.roomId;
      const activeKey = sessionKeyRef.current ?? persisted?.sessionKey;
      if (!activeRoom || !activeKey) return;
      if (!['host-ready', 'chat', 'booting'].includes(phaseRef.current) && !persisted) return;

      socket.emit(
        SocketEvents.REJOIN,
        { roomId: activeRoom, sessionKey: activeKey },
        (result: JoinResult | ErrorPayload) => {
          if ('code' in result) return;
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
      setError((prev) => (prev?.code === 'SERVER_ERROR' ? null : prev));
      attemptRejoin();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on(SocketEvents.ROOM_STATE, (state: RoomPublicState) => {
      setRoomState(state);
      setPeerConnected(state.peerConnected);
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

    socket.emit(SocketEvents.CREATE_ROOM, (result: CreateRoomResult) => {
      setRole(result.role);
      setRoomId(result.roomId);
      setInviteUrl(result.inviteUrl);
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
  }, [ensureSocket]);

  const beginJoin = useCallback(
    (targetRoomId: string, token: string) => {
      const socket = ensureSocket();
      setError(null);
      setPhase('joining');
      setRoomId(targetRoomId);
      setInviteToken(token);
      setBootCompleteState(false);

      window.setTimeout(() => setPhase('waiting-approval'), 1200);

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
      sessionStartedAt,
      bootComplete,
      createSession,
      beginJoin,
      acceptRequest,
      rejectRequest,
      sendMessage,
      setTyping,
      markSeen,
      reset,
      setBootComplete,
      clearError,
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
      sessionStartedAt,
      bootComplete,
      createSession,
      beginJoin,
      acceptRequest,
      rejectRequest,
      sendMessage,
      setTyping,
      markSeen,
      reset,
      setBootComplete,
      clearError,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
