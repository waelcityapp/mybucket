import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppConfirmProvider } from './components/AppConfirmDialog';
import { AppNoticeProvider } from './components/AppNotice';
import { startSiteVisitTracking } from './services/siteVisitsClient';
import './index.css';

startSiteVisitTracking();

// Register only the install worker; never cache financial pages, auth tokens or API replies.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[My Bucket PWA] Service worker unavailable:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppNoticeProvider>
      <AppConfirmProvider>
        <App />
      </AppConfirmProvider>
    </AppNoticeProvider>
  </StrictMode>,
);
