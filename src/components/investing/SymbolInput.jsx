import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../theme';
import { inputStyle } from './ui';

// Lookups per query ({ results, exact }), kept for the session so retyping
// doesn't refetch. Failed lookups aren't cached, so they retry.
const cache = new Map();

const LIST_MAX = 260;

function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

// Ticker field with suggestions as you type: your own symbols show instantly,
// then matches from the price service (by ticker or company name).
// onStatus reports whether the typed value is a real ticker:
//   'ok' | 'checking' | 'invalid' | 'offline' | 'error' | null (empty)
export default function SymbolInput({ hook, value, onChange, onPick, onStatus, onOpenChange, onKeyDown, placeholder, autoFocus }) {
  const { assets, txs, searchSymbols } = hook;
  const [focused, setFocused] = useState(false);
  const [picked, setPicked]   = useState(null);
  const [remote, setRemote]   = useState({ q: '' });
  const lastResults = useRef([]); // shown while the next query loads, so the list doesn't flicker
  const [retry, setRetry]     = useState(0);
  const blurTimer = useRef(null);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const [listMax, setListMax] = useState(LIST_MAX);

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
    : current.exact || current.results?.some(r => r.symbol === q) ? 'ok' : 'invalid'; // a suggested ticker is real

  useEffect(() => { onStatus?.(status); }, [status, onStatus]);

  const suggestions = useMemo(() => {
    const local = Object.entries(assets)
      .filter(([sym, a]) => sym.startsWith(q) || a.name?.toUpperCase().includes(q))
      .map(([sym, a]) => ({ symbol: sym, name: a.name || '', mine: true }));
    const seen = new Set(local.map(s => s.symbol));
    if (current?.results) lastResults.current = current.results;
    const remoteList = current ? (current.results || [])
      : lastResults.current.filter(r => r.symbol.startsWith(q) || r.name.toUpperCase().includes(q));
    const fresh = remoteList.filter(r => !seen.has(r.symbol));
    return [...local, ...fresh].slice(0, 8);
  }, [assets, q, current]);

  // Keep the whole list on screen above the keyboard: scroll the input up
  // (never past the top of the visible area), then cap the list to what's left.
  const fit = useCallback(() => {
    const input = inputRef.current, list = listRef.current;
    if (!input || !list) return;
    const vv = window.visualViewport;
    const vTop = vv ? vv.offsetTop : 0;
    const vBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const parent = scrollParent(input);
    const pr = parent ? parent.getBoundingClientRect() : { top: vTop, bottom: vBottom };
    const top = Math.max(pr.top, vTop) + 8, bottom = Math.min(pr.bottom, vBottom) - 8;
    const r = input.getBoundingClientRect();
    const delta = Math.min(r.bottom + 6 + LIST_MAX - bottom, r.top - top);
    if (delta > 0) {
      if (parent) parent.scrollTop += delta;
      else window.scrollBy(0, delta);
    }
    const after = input.getBoundingClientRect();
    setListMax(Math.max(120, Math.min(LIST_MAX, bottom - after.bottom - 6)));
  }, []);

  // The list stays open with a fixed height while typing, so new results never
  // change the page layout; it's positioned once when it opens.
  const listShown = open;
  useLayoutEffect(() => { if (listShown) fit(); }, [listShown, fit]);
  useEffect(() => { onOpenChange?.(listShown); }, [listShown, onOpenChange]);

  // Keyboard opening/closing changes the visible area
  useEffect(() => {
    const vv = window.visualViewport;
    if (!listShown || !vv) return;
    vv.addEventListener('resize', fit);
    return () => vv.removeEventListener('resize', fit);
  }, [listShown, fit]);

  const pick = s => {
    setPicked(s.symbol);
    onChange(s.symbol);
    onPick?.(s);
  };

  return (
    <div>
      <input
        ref={inputRef}
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
      {listShown && (
        <div ref={listRef} style={{
          marginTop: 6, background: T.bg, border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', height: listMax, overflowY: 'auto',
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
          {suggestions.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: T.muted }}>{loading ? 'Searching…' : 'No matches'}</div>
          )}
        </div>
      )}
    </div>
  );
}
