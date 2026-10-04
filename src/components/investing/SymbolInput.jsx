import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { inputStyle } from './ui';

// Lookups per query ({ results, exact }), kept for the session so retyping
// doesn't refetch. Failed lookups aren't cached, so they retry.
const cache = new Map();

// Ticker field with suggestions as you type: your own symbols show instantly,
// then matches from the price service (by ticker or company name).
// onStatus reports whether the typed value is a real ticker:
//   'ok' | 'checking' | 'invalid' | 'offline' | 'error' | null (empty)
export default function SymbolInput({ hook, value, onChange, onPick, onStatus, onKeyDown, placeholder, autoFocus }) {
  const { assets, txs, searchSymbols } = hook;
  const [focused, setFocused] = useState(false);
  const [picked, setPicked]   = useState(null);
  const [remote, setRemote]   = useState({ q: '' });
  const [retry, setRetry]     = useState(0);
  const blurTimer = useRef(null);

  const q = value.trim().toUpperCase();
  const open = focused && q.length > 0 && picked !== q;

  // Symbols you already have are real; checking them works offline too
  const known = useMemo(
    () => new Set([...Object.keys(assets), ...txs.map(t => t.symbol).filter(Boolean)]),
    [assets, txs]);

  // Debounced lookup: suggestions while the list is open, and the ticker check
  useEffect(() => {
    if (!q) return;
    if (cache.has(q)) { setRemote({ q, ...cache.get(q) }); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setRemote({ q, failed: 'offline' }); return; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await searchSymbols(q);
        cache.set(q, res);
        if (live) setRemote({ q, ...res });
      } catch (e) {
        const offline = e?.code === 'functions/unavailable' || navigator.onLine === false;
        if (live) setRemote({ q, failed: offline ? 'offline' : 'error' });
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, searchSymbols, retry]);

  // Come back online → recheck
  useEffect(() => {
    const onOnline = () => setRetry(n => n + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const current = remote.q === q ? remote : null; // never a previous query's answer
  const loading = !!q && !current;

  const status = !q ? null
    : known.has(q) ? 'ok'
    : !current ? 'checking'
    : current.failed ? current.failed
    : current.exact ? 'ok' : 'invalid';

  useEffect(() => { onStatus?.(status); }, [status, onStatus]);

  const suggestions = useMemo(() => {
    const local = Object.entries(assets)
      .filter(([sym, a]) => sym.startsWith(q) || a.name?.toUpperCase().includes(q))
      .map(([sym, a]) => ({ symbol: sym, name: a.name || '', mine: true }));
    const seen = new Set(local.map(s => s.symbol));
    const fresh = (current?.results || []).filter(r => !seen.has(r.symbol));
    return [...local, ...fresh].slice(0, 8);
  }, [assets, q, current]);

  const pick = s => {
    setPicked(s.symbol);
    onChange(s.symbol);
    onPick?.(s);
  };

  return (
    <div>
      <input
        value={value}
        onChange={e => { setPicked(null); onChange(e.target.value.toUpperCase()); }}
        onFocus={() => { clearTimeout(blurTimer.current); setFocused(true); }}
        // Delay so a tap on a suggestion lands before the list closes
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />
      {open && (suggestions.length > 0 || loading) && (
        <div style={{
          marginTop: 6, background: T.bg, border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={e => e.preventDefault()} // keep input focused on desktop
              onClick={() => pick(s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'baseline', gap: 10,
                padding: '10px 12px', textAlign: 'left',
                borderTop: i ? `1px solid ${T.cardBorder}` : 'none',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flexShrink: 0 }}>{s.symbol}</span>
              <span style={{ fontSize: 13, color: T.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
              {s.mine && <span style={{ fontSize: 11, color: T.khaki, flexShrink: 0 }}>yours</span>}
            </button>
          ))}
          {loading && suggestions.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: T.muted }}>Searching…</div>
          )}
        </div>
      )}
    </div>
  );
}
