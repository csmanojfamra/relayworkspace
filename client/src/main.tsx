import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ThemeProvider } from '@/hooks/useTheme';
import { SessionProvider } from '@/hooks/useSession';
import { ViewportRoot } from '@/components/ViewportRoot';
import './index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SessionProvider>
          <ViewportRoot>
            <App />
          </ViewportRoot>
        </SessionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
