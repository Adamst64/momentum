import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { formatShortDate } from '../../utils/dateUtils';
import { money, signedMoney, pct } from '../../utils/investing';
import { Chips, gainColor } from './ui';
import { ValueChart } from './Charts';

const RANGES = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y',  label: '1Y' },
  { value: '5y',  label: '5Y' },
];

// Price chart for one stock (trading days only), with optional reference lines
// (avg cost, sell price, your target) and markers (when you sold).
// livePrice replaces the last close so the chart ends at the current quote.
export default function StockChart({ symbol, priceHistory, livePrice, refs, markers, hide, initialRange = '6mo' }) {
  const [range, setRange]   = useState(initialRange);
  const [points, setPoints] = useState(null);
  const [error, setError]   = useState(null);
  const [scrub, setScrub]   = useState(null);

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
    <div>
      <div style={{ minHeight: 38 }}>
        {shown && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{money(shown.value, hide)}</div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {scrub ? formatShortDate(scrub.date) : 'Now'}
              {change !== null && shown !== first && (
                <span style={{ color: gainColor(change) }}> · {signedMoney(change, hide)} ({pct(change / first.value)}) since {formatShortDate(first.date)}</span>
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
          <ValueChart points={pts} hide={hide} onScrub={setScrub} refs={refs} markers={markers} emptyText="No price history for this symbol." />
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <Chips small options={RANGES} value={range} onChange={v => { setRange(v); setScrub(null); }} />
      </div>
    </div>
  );
}
