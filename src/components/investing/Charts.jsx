import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../theme';
import { formatDateYear } from '../../utils/dateUtils';
import { money, pct } from '../../utils/investing';
import { SERIES, OTHER_COLOR, gainColor, noSelect } from './ui';

// ── Portfolio value over time (single series, touch/hover crosshair) ────────

// onScrub(point | null): when given, the parent shows the touched value (in a
// headline) and the chart drops its own readout row.
// refs: horizontal dashed lines [{ value, label, color }] (avg cost, target…),
// markers: vertical lines [{ date, label }] at the first point on/after date.
// trades: buy/sell dots [{ id, date, price, type }] drawn at the trade price;
// a tap (not a drag) on or next to one calls onTradeTap(id), elsewhere onTradeTap(null).
// onRange({ from, to } | null): two fingers on the chart select the period between them.
export function ValueChart({ points, hide, onScrub, onRange, refs = [], markers = [], trades = [], selectedTrade = null, onTradeTap, emptyText }) {
  const [hover, setHoverState] = useState(null);
  const setHover = i => { setHoverState(i); if (onScrub) onScrub(i === null ? null : points[i]); };
  const [range, setRangeState] = useState(null); // [fromIndex, toIndex]
  const setRange = r => {
    setRangeState(r);
    if (onRange) onRange(r ? { from: points[r[0]], to: points[r[1]] } : null);
  };
  const ref = useRef(null);
  const downAt = useRef(null);
  const fingers = useRef(new Map()); // pointerId → clientX
  const pinching = useRef(false);
  // One finger: 'pending' until it moves sideways (scrub) or vertically (left to
  // the page: scroll / pull to refresh), or rests 200 ms (scrub in place)
  const gesture = useRef(null); // { mode, x0, y0, timer }

  // A second finger on the chart is ours: stop Safari from treating it as a
  // text selection or zoom (needs a non-passive native listener)
  const hasChart = points.length >= 2;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const stop = e => { if (e.touches.length > 1) e.preventDefault(); };
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => { el.removeEventListener('touchstart', stop); el.removeEventListener('touchmove', stop); };
  }, [hasChart]);
  if (points.length < 2) {
    return (
      <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: '24px 8px', lineHeight: 1.5 }}>
        {emptyText || 'The chart fills in as days pass. A value is saved after each market close, and whenever prices update while the market is open.'}
      </div>
    );
  }

  const W = 340, H = 120, PAD = 4;
  const vals = points.map(p => p.value);
  const refVals = refs.filter(r => r.value > 0).map(r => r.value);
  // Trades inside the chart's dates, each placed on its day (or the next point)
  const lastDate = points[points.length - 1].date;
  const tradeDots = trades
    .filter(t => t.date >= points[0].date && t.date <= lastDate && t.price > 0)
    .map(t => ({ ...t, i: points.findIndex(p => p.date >= t.date) }))
    .filter(t => t.i >= 0);
  const tradeVals = tradeDots.map(t => t.price);
  const min = Math.min(...vals, ...refVals, ...tradeVals), max = Math.max(...vals, ...refVals, ...tradeVals);
  const span = max - min || 1;
  const x = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = v => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`;
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? T.oliveLight : T.red;

  // Screen ↔ chart coordinates (the SVG keeps its aspect ratio, centered)
  const toChartX = clientX => {
    const r = ref.current.getBoundingClientRect();
    const scale = Math.min(r.width / W, r.height / H);
    return (clientX - r.left - (r.width - W * scale) / 2) / scale;
  };
  const indexAt = clientX => {
    const i = Math.round(((toChartX(clientX) - PAD) / (W - PAD * 2)) * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, i));
  };
  const pick = clientX => setHover(indexAt(clientX));
  const updateRange = () => {
    const [a, b] = [...fingers.current.values()].slice(0, 2).map(indexAt).sort((m, n) => m - n);
    if (a !== b) setRange([a, b]);
  };
  const endGesture = () => {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = null;
  };
  const startScrub = (el, pointerId, clientX) => {
    if (!gesture.current) return;
    clearTimeout(gesture.current.timer);
    gesture.current.mode = 'scrub';
    try { el.setPointerCapture(pointerId); } catch { /* not supported */ }
    pick(clientX);
  };
  const onDown = e => {
    fingers.current.set(e.pointerId, e.clientX);
    if (fingers.current.size >= 2) {
      endGesture();
      pinching.current = true;
      downAt.current = null; // a pinch is never a tap
      setHover(null);
      updateRange();
      return;
    }
    downAt.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') { pick(e.clientX); return; }
    const el = e.currentTarget, id = e.pointerId, cx = e.clientX;
    gesture.current = { mode: 'pending', x0: e.clientX, y0: e.clientY, timer: setTimeout(() => startScrub(el, id, cx), 200) };
  };
  const onMove = e => {
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, e.clientX);
    if (fingers.current.size >= 2) { updateRange(); return; }
    if (pinching.current) return;
    const g = gesture.current;
    if (!g) { if (e.pointerType === 'mouse') pick(e.clientX); return; }
    if (g.mode === 'pending') {
      const dx = Math.abs(e.clientX - g.x0), dy = Math.abs(e.clientY - g.y0);
      if (dx > 6 && dx >= dy) startScrub(e.currentTarget, e.pointerId, e.clientX);
      else if (dy > 6) { endGesture(); downAt.current = null; } // vertical: the page scrolls / pulls
      return;
    }
    if (g.mode === 'scrub') pick(e.clientX);
  };
  const onUp = e => {
    endGesture();
    fingers.current.delete(e.pointerId);
    if (pinching.current) {
      // Lifting either finger ends the selection (like Robinhood)
      if (fingers.current.size < 2) setRange(null);
      if (fingers.current.size === 0) { pinching.current = false; setHover(null); }
      return;
    }
    const d = downAt.current;
    downAt.current = null;
    if (onTradeTap && d && Math.abs(e.clientX - d.x) < 8 && Math.abs(e.clientY - d.y) < 8) {
      const cx = toChartX(e.clientX);
      const near = tradeDots
        .map(t => ({ t, dist: Math.abs(x(t.i) - cx) }))
        .filter(o => o.dist <= 14)
        .sort((a, b) => a.dist - b.dist)[0];
      onTradeTap(near ? near.t.id : null);
    }
    if (e.pointerType !== 'mouse') setHover(null);
  };

  const hp = hover !== null ? points[hover] : null;

  // Year marks along the bottom for charts spanning 2+ years (at most ~6 labels)
  const yearTicks = [];
  const firstYear = Number(points[0].date.slice(0, 4)), lastYear = Number(points[points.length - 1].date.slice(0, 4));
  if (lastYear - firstYear >= 2) {
    const step = Math.ceil((lastYear - firstYear) / 6);
    for (let i = 1; i < points.length; i++) {
      const yr = Number(points[i].date.slice(0, 4));
      if (yr !== Number(points[i - 1].date.slice(0, 4)) && (yr - firstYear) % step === 0) yearTicks.push({ year: yr, i });
    }
  }
  return (
    <div style={{ position: 'relative', ...noSelect }}>
      {!onScrub && <div style={{ height: 34, fontSize: 12, color: T.muted }}>
        {hp ? (
          <>
            <div style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>{money(hp.value, hide)}</div>
            <div>{hp.label || formatDateYear(hp.date)}</div>
          </>
        ) : (
          <div style={{ paddingTop: 8 }}>Touch the chart to see values</div>
        )}
      </div>}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        // pan-y: vertical swipes stay with the page (scroll, pull to refresh);
        // sideways drags and two fingers are handled here
        style={{ width: '100%', height: H, display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerLeave={() => { if (!fingers.current.size) setHover(null); }}
        onPointerUp={onUp}
        onPointerCancel={e => { endGesture(); fingers.current.delete(e.pointerId); pinching.current = fingers.current.size > 0 && pinching.current; setRange(null); setHover(null); }}
        role="img"
        aria-label={`Portfolio value from ${money(vals[0], hide)} to ${money(vals[vals.length - 1], hide)}`}
      >
        <path d={area} fill={color} opacity={0.12} />
        {refs.filter(r => r.value > 0).map(r => (
          <g key={r.label}>
            <line x1={0} x2={W} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
            <text x={W - 2} y={y(r.value) + (y(r.value) < 14 ? 10 : -3)} textAnchor="end" fontSize="9" fill={r.color}>
              {r.label} {hide ? '' : money(r.value)}
            </text>
          </g>
        ))}
        {markers.map(m => {
          const i = points.findIndex(p => p.date >= m.date);
          if (i < 0) return null;
          return (
            <g key={m.label + m.date}>
              <line x1={x(i)} x2={x(i)} y1={0} y2={H} stroke={T.khaki} strokeWidth={1} opacity={0.7} />
              <text x={x(i) + (x(i) > W - 40 ? -3 : 3)} y={10} textAnchor={x(i) > W - 40 ? 'end' : 'start'} fontSize="9" fill={T.khaki}>{m.label}</text>
            </g>
          );
        })}
        {yearTicks.map(t => (
          <g key={t.year}>
            <line x1={x(t.i)} x2={x(t.i)} y1={H - 12} y2={H} stroke={T.muted} strokeWidth={0.5} opacity={0.5} />
            <text x={x(t.i) + 2} y={H - 3} fontSize="8" fill={T.muted}>{t.year}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {tradeDots.map(t => {
          const buy = t.type === 'buy';
          const sel = selectedTrade === t.id;
          const cx = x(t.i), cy = y(t.price);
          return (
            <g key={t.id} style={{ pointerEvents: 'none' }}>
              {sel && <circle cx={cx} cy={cy} r={9} fill="none" stroke={T.text} strokeWidth={1.5} />}
              <circle cx={cx} cy={cy} r={6} fill={buy ? '#30D158' : '#FF9F0A'} stroke={T.card} strokeWidth={1.5} />
              <text x={cx} y={cy + 2.6} textAnchor="middle" fontSize="7" fontWeight="800" fill="#000">{buy ? 'B' : 'S'}</text>
            </g>
          );
        })}
        {range && (() => {
          // Two-finger period: shaded span, a line and date pill at each end
          const [a, b] = range;
          const pa = points[a], pb = points[b];
          const up2 = pb.value >= pa.value;
          const c2 = up2 ? T.oliveLight : T.red;
          const la = formatDateYear(pa.date), lb = formatDateYear(pb.date);
          const wa = la.length * 5.2 + 10, wb = lb.length * 5.2 + 10;
          const xa = Math.max(0, Math.min(x(a) - wa, W - wa - wb));
          const xb = Math.min(W - wb, Math.max(x(b), xa + wa + 2));
          return (
            <>
              <rect x={x(a)} y={14} width={x(b) - x(a)} height={H - 14} fill={c2} opacity={0.12} />
              {[a, b].map(i => (
                <g key={i}>
                  <line x1={x(i)} x2={x(i)} y1={14} y2={H} stroke={T.muted} strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={x(i)} cy={y(points[i].value)} r={4.5} fill={c2} stroke={T.card} strokeWidth={2} />
                </g>
              ))}
              <rect x={xa} y={0} width={wa} height={13} rx={6.5} fill={T.subtle} />
              <text x={xa + wa / 2} y={9.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>{la}</text>
              <rect x={xb} y={0} width={wb} height={13} rx={6.5} fill={T.subtle} />
              <text x={xb + wb / 2} y={9.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>{lb}</text>
            </>
          );
        })()}
        {hover !== null && !range && (() => {
          // Date pill at the top of the crosshair, flipped to stay inside the chart
          const label = hp.label || formatDateYear(hp.date);
          const w = label.length * 5.2 + 10;
          const px = Math.min(Math.max(x(hover) - w / 2, 0), W - w);
          return (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={14} y2={H} stroke={T.muted} strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(hp.value)} r={4.5} fill={color} stroke={T.card} strokeWidth={2} />
              <rect x={px} y={0} width={w} height={13} rx={6.5} fill={T.subtle} />
              <text x={px + w / 2} y={9.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={T.text}>{label}</text>
            </>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Allocation donut + optional targets ─────────────────────────────────────

// Colors follow the holding (first-purchase order), so they don't shuffle as values move
export function allocationSlices(portfolio, assets) {
  const byFirst = [...portfolio.holdings].sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));
  const colorOf = Object.fromEntries(byFirst.map((h, i) => [h.symbol, SERIES[i] || OTHER_COLOR]));
  // Share of what you hold (money market funds like FDRXX are holdings too)
  const total = portfolio.holdings.reduce((a, h) => a + Math.max(0, h.value || 0), 0) || 1;

  const slices = portfolio.holdings.map(h => ({
    key: h.symbol, label: h.symbol, value: h.value || 0, color: colorOf[h.symbol],
    target: assets[h.symbol]?.targetPct ?? null,
  }));
  // More holdings than colors: the smallest fold into "Other"
  const named = slices.filter(s => s.color !== OTHER_COLOR);
  const other = slices.filter(s => s.color === OTHER_COLOR);
  const out = [...named];
  if (other.length) out.push({ key: 'other', label: `Other (${other.length})`, value: other.reduce((a, s) => a + s.value, 0), color: OTHER_COLOR, target: null });
  return out.map(s => ({ ...s, pct: s.value / total }));
}

export function AllocationDonut({ slices }) {
  const R = 46, SW = 14, C = 60, CIRC = 2 * Math.PI * R;
  const [hover, setHover] = useState(null);
  const gap = slices.length > 1 ? 2 : 0; // 2px surface gap between segments
  let offset = 0;
  const hs = hover !== null ? slices[hover] : null;

  return (
    <svg width={132} height={132} viewBox="0 0 120 120" role="img" aria-label="Allocation">
      <g transform={`rotate(-90 ${C} ${C})`}>
        {slices.map((s, i) => {
          const len = Math.max(0, s.pct * CIRC - gap);
          const el = (
            <circle
              key={s.key}
              cx={C} cy={C} r={R} fill="none"
              stroke={s.color} strokeWidth={hover === i ? SW + 3 : SW}
              strokeDasharray={`${len} ${CIRC - len}`}
              strokeDashoffset={-offset}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
            />
          );
          offset += s.pct * CIRC;
          return el;
        })}
      </g>
      <text x={C} y={hs ? C - 6 : C} textAnchor="middle" dominantBaseline="central" fill={T.text} fontSize="13" fontWeight="700">
        {hs ? hs.label : `${slices.length}`}
      </text>
      <text x={C} y={hs ? C + 10 : C + 14} textAnchor="middle" dominantBaseline="central" fill={T.muted} fontSize="10">
        {hs ? `${(hs.pct * 100).toFixed(1)}%` : slices.length === 1 ? 'asset' : 'assets'}
      </text>
    </svg>
  );
}

export function AllocationLegend({ slices, onEditTarget }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slices.map(s => {
        const drift = s.target !== null && s.target !== undefined ? s.pct * 100 - s.target : null;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{(s.pct * 100).toFixed(1)}%</span>
            {s.key !== 'other' && (
              <button
                onClick={() => onEditTarget(s.key)}
                style={{
                  minWidth: 74, textAlign: 'right', fontSize: 11,
                  color: drift === null ? T.muted : Math.abs(drift) < 2 ? T.muted : drift > 0 ? '#FF9F0A' : T.khaki,
                }}
              >
                {drift === null ? 'set target' : `${s.target}% · ${drift > 0 ? '+' : ''}${drift.toFixed(1)}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Monthly: deposited vs invested (two thin bars per month) ────────────────

export function MonthlyFlows({ months, hide }) {
  const rows = months.slice(0, 12);
  if (!rows.length) return <div style={{ fontSize: 13, color: T.muted }}>No activity yet.</div>;
  const max = Math.max(1, ...rows.flatMap(m => [Math.abs(m.deposited), Math.abs(m.invested)]));
  const bar = (v, color) => (
    <div style={{ height: 6, borderRadius: 3, background: color, width: `${Math.max(2, (Math.abs(v) / max) * 100)}%`, opacity: v < 0 ? 0.45 : 1 }} />
  );
  const label = m => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.muted }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 6, borderRadius: 3, background: SERIES[0], marginRight: 5 }} />Deposited</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 6, borderRadius: 3, background: SERIES[1], marginRight: 5 }} />Invested</span>
      </div>
      {rows.map(m => {
        const rate = m.deposited > 0 ? m.invested / m.deposited : null;
        return (
          <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: T.muted }}>{label(m.month)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {bar(m.deposited, SERIES[0])}
              {bar(m.invested, SERIES[1])}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ color: T.text }}>{money(m.deposited, hide)}</div>
              <div style={{ color: T.muted }}>
                {money(m.invested, hide)}{rate !== null && !hide ? ` · ${Math.round(rate * 100)}%` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Best / worst holdings by unrealized return ──────────────────────────────

export function Performers({ holdings, hide, onOpen }) {
  const ranked = holdings.filter(h => h.unrealizedPct !== null).sort((a, b) => b.unrealizedPct - a.unrealizedPct);
  if (ranked.length < 2) return <div style={{ fontSize: 13, color: T.muted }}>Needs at least two priced holdings.</div>;
  const best = ranked.slice(0, Math.min(3, Math.ceil(ranked.length / 2)));
  const worst = ranked.slice(-Math.min(3, Math.floor(ranked.length / 2))).reverse();
  const row = h => (
    <button key={h.symbol} onClick={() => onOpen(h.symbol)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', width: '100%' }}>
      <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>{h.symbol}</span>
      <span style={{ fontSize: 13, color: gainColor(h.unrealized) }}>
        {pct(h.unrealizedPct)} {!hide && <span style={{ color: T.muted }}>· {money(h.unrealized)}</span>}
      </span>
    </button>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: T.green, marginBottom: 2 }}>▲ Top</div>
        {best.map(row)}
      </div>
      <div>
        <div style={{ fontSize: 11, color: T.red, marginBottom: 2 }}>▼ Bottom</div>
        {worst.map(row)}
      </div>
    </div>
  );
}
