import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary, { reloadOnce } from './components/ErrorBoundary';
import './index.css';

// Vite reports a lazily loaded file that's gone (an update was published while the
// app was open): reload once to pick up the new version instead of crashing
window.addEventListener('vite:preloadError', e => { if (reloadOnce()) e.preventDefault(); });

// The visible part of the screen, for sheets and full-screen pages: on iPhone the
// keyboard covers the bottom and the page can be shifted up, so "inset: 0" would put
// the field you're typing in off-screen. --vv-top / --vv-height follow what's visible.
const vv = window.visualViewport;
const syncViewport = () => {
  const s = document.documentElement.style;
  s.setProperty('--vv-top', `${vv ? Math.max(0, vv.offsetTop) : 0}px`);
  s.setProperty('--vv-height', `${vv ? vv.height : window.innerHeight}px`);
};
syncViewport();
vv?.addEventListener('resize', syncViewport);
vv?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);
// Once the keyboard is up, bring the focused field to the middle of its sheet
document.addEventListener('focusin', e => {
  const el = e.target;
  if (!(el instanceof HTMLElement) || !el.matches('input, textarea, [contenteditable="true"]')) return;
  setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
});

// Ask the browser to keep the app's saved data (your sign-in, offline copy) even
// when the phone runs low on space, instead of clearing it as it can for websites
navigator.storage?.persist?.().catch(() => {});

// Updates: an installed iPhone app rarely checks for a new version and keeps running
// the old code until it's fully restarted. Check whenever the app comes to the front;
// once a new version has taken over, reload the next time the app goes to the
// background (so nothing you're doing gets interrupted).
if ('serviceWorker' in navigator) {
  let updateReady = false;
  const check = () => navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    updateReady = true;
    if (document.visibilityState === 'hidden') window.location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (updateReady) window.location.reload(); }
    else check();
  });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30 * 60 * 1000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
