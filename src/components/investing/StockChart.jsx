import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { formatDateYear } from '../../utils/dateUtils';
import { money, signedMoney, pct, qtyFmt } from '../../utils/investing';
import { Chips, gainColor, noSelect } from './ui';
import { ValueChart } from './Charts';

const RANGES = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y',  label: '1Y' },
  { value: '5y',  label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: 'max', label: 'Max' },
];

// Price chart for one stock (trading days only), with optional reference lines
// (avg cost, sell price, your target) and markers (when you sold).
// livePrice replaces the last close so the chart ends at the current quote.
export default function StockChart({ symbol, priceHistory, livePrice, refs, markers, trades = [], hide, initialRange = '6mo' }) {
  const [range, setRange]   = useState(initialRange);
  const [points, setPoints] = useState(null);
  const [error, setError]   = useState(null);
  const [scrub, setScrub]   = useState(null);
  const [tradeId, setTradeId] = useState(null);
  const [span, setSpan]     = useState(null); // two-finger { from, to }
  const trade = trades.find(t => t.id === tradeId) || null;

  useEffect(() => {
    let live = true;
    setPoints(null);
    setError(null);
    priceHistory(symbol, range)
      .then(p => live && setPoints(p))
      .catch(e => live && setError(e.message || 'Could not load the chart'));
    return () => { live = false; };
  }, [symbol, range, priceHistory]);

  let pts = points || [];
  if (pts.length && livePrice) pts = [...pts.slice(0, -1), { ...pts[pts.length - 1], value: livePrice }];
  const first = pts[0];
  const shown = scrub || pts[pts.length - 1];
  const change = shown && first ? shown.value - first.value : null;

  return (
    <div style={noSelect}>
      <div style={{ minHeight: 38 }}>
        {span ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: gainColor(span.to.value - span.from.value), fontVariantNumeric: 'tabular-nums' }}>
              {signedMoney(span.to.value - span.from.value, hide)} ({pct(span.to.value / span.from.value - 1)})
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {formatDateYear(span.from.date)} → {formatDateYear(span.to.date)} · {money(span.from.value, hide)} → {money(span.to.value, hide)}
            </div>
          </>
        ) : shown && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{money(shown.value, hide)}</div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {scrub ? formatDateYear(scrub.date) : 'Now'}
              {change !== null && shown !== first && (
                <span style={{ color: gainColor(change) }}> · {signedMoney(change, hide)} ({pct(change / first.value)}) since {formatDateYear(first.date)}</span>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {error ? (
          <div style={{ fontSize: 13, color: T.muted, padding: '24px 0', textAlign: 'center' }}>Chart unavailable: {error}</div>
        ) : points === null ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: T.muted }}>Loading chart…</div>
        ) : (
          <ValueChart points={pts} hide={hide} onScrub={setScrub} onRange={setSpan} refs={refs} markers={markers} trades={trades} selectedTrade={tradeId} onTradeTap={setTradeId} emptyText="No price history for this symbol." />
        )}
      </div>
      {trade && <TradeCard t={trade} hide={hide} onClose={() => setTradeId(null)} />}
      {!trade && trades.length > 0 && points?.length > 1 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
          <span style={{ color: '#30D158', fontWeight: 700 }}>B</span> buys · <span style={{ color: '#FF9F0A', fontWeight: 700 }}>S</span> sells — tap one for details · two fingers to compare dates
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <Chips small options={RANGES} value={range} onChange={v => { setRange(v); setScrub(null); }} />
      </div>
    </div>
  );
}

// Details for one tapped buy or sell
function TradeCard({ t, hide, onClose }) {
  const buy = t.type === 'buy';
  const row = (label, value, color = T.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${buy ? '#30D158' : '#FF9F0A'}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: buy ? '#30D158' : '#FF9F0A' }}>
          {buy ? (t.fromCash === false ? 'Added (already owned)' : 'Bought') : t.closedOut ? 'Sold (all)' : 'Sold'}
        </span>
        <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{formatDateYear(t.date)}</span>
        <button onClick={onClose} aria-label="Close" style={{ fontSize: 16, color: T.muted, padding: '0 2px' }}>×</button>
      </div>
      {row('Shares', `${qtyFmt(t.quantity)} @ ${money(t.price, hide)}`)}
      {t.fee ? row('Fee', money(t.fee, hide)) : null}
      {buy ? (
        <>
          {row('Total paid', money(t.total, hide))}
          {t.valueNow !== null && row('Worth today', money(t.valueNow, hide))}
          {t.gain !== null && row('Gain since', `${signedMoney(t.gain, hide)} (${pct(t.gainPct)})`, gainColor(t.gain))}
        </>
      ) : (
        <>
          {row('Received', money(t.proceeds, hide))}
          {row('Cost of those shares', `${money(t.basis, hide)} (avg ${money(t.avgCost, hide)})`)}
          {row(t.realized >= 0 ? 'Gain' : 'Loss', `${signedMoney(t.realized, hide)} (${pct(t.realizedPct)})`, gainColor(t.realized))}
          {t.sinceSell !== null && row('Price since', pct(t.sinceSell), gainColor(t.sinceSell))}
        </>
      )}
    </div>
  );
}
