import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary, { reloadOnce } from './components/ErrorBoundary';
import './index.css';

// Vite reports a lazily loaded file that's gone (an update was published while the
// app was open): reload once to pick up the new version instead of crashing
window.addEventListener('vite:preloadError', e => { if (reloadOnce()) e.preventDefault(); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
