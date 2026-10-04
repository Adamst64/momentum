import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { inputStyle } from './ui';

// Results per query, kept for the session so retyping doesn't refetch
const cache = new Map();

// Ticker field with suggestions as you type: your own symbols show instantly,
// then matches from the price service (by ticker or company name).
export default function SymbolInput({ hook, value, onChange, onPick, onKeyDown, placeholder, autoFocus }) {
  const { assets, searchSymbols } = hook;
  const [focused, setFocused] = useState(false);
  const [picked, setPicked]   = useState(null);
  const [remote, setRemote]   = useState({ q: '', results: [] });
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef(null);

  const q = value.trim().toUpperCase();
  const open = focused && q.length > 0 && picked !== q;

  // Debounced lookup
  useEffect(() => {
    if (!open) return;
    if (cache.has(q)) { setRemote({ q, results: cache.get(q) }); setLoading(false); return; }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchSymbols(q);
        cache.set(q, res);
        if (live) setRemote({ q, results: res });
      } catch {
        if (live) setRemote({ q, results: [] }); // offline or rate-limited: local matches still show
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, searchSymbols]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const suggestions = useMemo(() => {
    const local = Object.entries(assets)
      .filter(([sym, a]) => sym.startsWith(q) || a.name?.toUpperCase().includes(q))
      .map(([sym, a]) => ({ symbol: sym, name: a.name || '', mine: true }));
    const seen = new Set(local.map(s => s.symbol));
    // Only results for exactly what's typed, never a previous query's
    const fresh = (remote.q === q ? remote.results : []).filter(r => !seen.has(r.symbol));
    return [...local, ...fresh].slice(0, 8);
  }, [assets, q, remote]);

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
