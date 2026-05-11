import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { hideSplash, isNative, setStatusBarLight } from './lib/native';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // LO-01 fix: success path is silent (was a noisy console.log on every
      // page load). Errors still surface — they actually warrant attention.
    } catch (err) {
      console.error('[SW] Registration failed:', err);
    }
  });
}

// Capacitor native bootstrap. No-ops on web, so this block is safe to keep
// in the unified bundle.
if (isNative()) {
  // Don't await — let React mount in parallel; the splash hide just signals
  // "we're ready" once React is on screen.
  setStatusBarLight();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Hide splash AFTER React has mounted. Slight delay (300ms) so first paint
// has actual content; otherwise users see a white flash between splash and
// React being ready.
if (isNative()) {
  setTimeout(() => { void hideSplash(); }, 300);
}
