import React from 'react';
import { T } from '../theme';

// A file the app needs couldn't load — almost always because a new version was
// published while the app was open, so the old file names are gone. Reloading
// fetches the new version. Only once per few seconds, so a real outage can't loop.
export const isChunkError = e => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError|Unable to preload/i.test(String(e?.message || e));
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem('momentum_reload_at') || 0);
    if (Date.now() - last < 10000) return false;
    sessionStorage.setItem('momentum_reload_at', String(Date.now()));
  } catch { /* storage unavailable: still try */ }
  window.location.reload();
  return true;
}

// Catches a crash in what it wraps. Without this, one error blanks the whole app
// (the black screen). fallback: what to show instead (default: a reload screen).
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    if (isChunkError(error) && !this.props.fallback) reloadOnce();
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, () => this.setState({ error: null }));
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: 320 }}>
          {isChunkError(error) ? 'A new version of the app is ready. Reload to get it.' : 'Your data is safe. Reload the app to continue.'}
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 12, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}>Reload</button>
        <div style={{ fontSize: 11, color: T.subtle, maxWidth: 320, wordBreak: 'break-word' }}>{String(error?.message || error).slice(0, 200)}</div>
      </div>
    );
  }
}
