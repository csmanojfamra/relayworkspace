import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/LandingPage';
import { BootSequence } from '@/components/BootSequence';
import { Workspace } from '@/components/Workspace';
import { ErrorScreen } from '@/components/ErrorScreen';
import { useSession } from '@/hooks/useSession';

const JoinFlow = lazy(() =>
  import('@/components/JoinFlow').then((m) => ({ default: m.JoinFlow }))
);

function Shell() {
  const { phase } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isJoinRoute = location.pathname.startsWith('/join/');

  useEffect(() => {
    if (phase === 'chat' && isJoinRoute) {
      navigate('/', { replace: true });
    }
  }, [phase, isJoinRoute, navigate]);

  if (phase === 'booting') return <BootSequence />;
  if (phase === 'error') return <ErrorScreen />;
  if (phase === 'host-ready' || phase === 'chat') return <Workspace />;

  if (isJoinRoute) {
    return (
      <Suspense
        fallback={
          <div className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
            Loading...
          </div>
        }
      >
        <JoinFlow />
      </Suspense>
    );
  }

  if (phase === 'joining' || phase === 'waiting-approval') {
    return (
      <Suspense fallback={<BootSequence />}>
        <JoinFlow />
      </Suspense>
    );
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />} />
      <Route path="/join/:roomId" element={<Shell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
