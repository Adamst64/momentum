import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { formatShortDate } from '../../utils/dateUtils';
import { money } from '../../utils/investing';
import { SectionTitle } from './ui';

const HOUR_LABEL = { bmo: 'before market open', amc: 'after market close', dmh: 'during market hours' };

function bigMoney(millions) {
  if (millions == null) return '—';
  const n = millions * 1e6;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

export function earningsLabel(next) {
  if (!next) return null;
  const d = new Date(next.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${d}${HOUR_LABEL[next.hour] ? ` · ${HOUR_LABEL[next.hour]}` : ''}`;
}

export const ANALYST_COLOR = '#BF5AF2';

const RATING_LABEL = { strong_buy: 'Strong buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell', strongbuy: 'Strong buy' };
const COUNT_ROWS = [
  ['strongBuy', 'Strong buy', '#30D158'],
  ['buy', 'Buy', '#7BC96F'],
  ['hold', 'Hold', '#8E8E93'],
  ['sell', 'Sell', '#FF9F0A'],
  ['strongSell', 'Strong sell', '#FF453A'],
];

// Wall Street consensus: average target with its low–high range, and the rating mix
function AnalystTargets({ a, price, hide }) {
  const upside = a.targetMean && price ? a.targetMean / price - 1 : null;
  const lo = Math.min(a.targetLow ?? a.targetMean ?? price, price ?? Infinity);
  const hi = Math.max(a.targetHigh ?? a.targetMean ?? price, price ?? -Infinity);
  const at = v => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50);
  const c = a.counts;
  const total = c ? COUNT_ROWS.reduce((t, [k]) => t + (c[k] || 0), 0) : 0;
  return (
    <div>
      <SectionTitle>Analyst targets</SectionTitle>
      {a.targetMean ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: ANALYST_COLOR }}>{money(a.targetMean, hide)}</span>
            {upside !== null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: upside >= 0 ? T.green : T.red }}>
                {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            Average target{a.analysts ? ` from ${a.analysts} analyst${a.analysts !== 1 ? 's' : ''}` : ''}
            {a.rating && <> · consensus <b style={{ color: T.text }}>{RATING_LABEL[a.rating] || a.rating}</b></>}
          </div>
          {a.targetLow && a.targetHigh && price && (
            <div style={{ marginTop: 14 }}>
              <div style={{ position: 'relative', height: 6, borderRadius: 3, background: T.subtle }}>
                <div style={{ position: 'absolute', left: `${at(a.targetLow)}%`, right: `${100 - at(a.targetHigh)}%`, top: 0, bottom: 0, borderRadius: 3, background: ANALYST_COLOR, opacity: 0.35 }} />
                <div title="Average target" style={{ position: 'absolute', left: `calc(${at(a.targetMean)}% - 1.5px)`, top: -4, width: 3, height: 14, borderRadius: 2, background: ANALYST_COLOR }} />
                <div title="Today" style={{ position: 'absolute', left: `calc(${at(price)}% - 6px)`, top: -3, width: 12, height: 12, borderRadius: '50%', background: T.text, border: `2px solid ${T.card}` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginTop: 6 }}>
                <span>Low {money(a.targetLow, hide)}</span>
                <span>Today {money(price, hide)}</span>
                <span>High {money(a.targetHigh, hide)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.muted }}>No price target available — ratings only.</div>
      )}
      {total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
            {COUNT_ROWS.filter(([k]) => c[k] > 0).map(([k, , color]) => (
              <div key={k} style={{ flex: c[k], background: color }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: T.muted, marginTop: 6 }}>
            {COUNT_ROWS.filter(([k]) => c[k] > 0).map(([k, label, color]) => (
              <span key={k}><span style={{ color, fontWeight: 700 }}>{c[k]}</span> {label}</span>
            ))}
          </div>
        </div>
      )}
      {a.source && <div style={{ fontSize: 10, color: T.muted, marginTop: 8 }}>Source: {a.source}. Updated daily; not advice.</div>}
    </div>
  );
}

// Stats and earnings for one stock, loaded when the holding screen opens
export default function StockInfo({ symbol, price, stockInfo, hide }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    stockInfo(symbol)
      .then(d => live && setData(d))
      .catch(e => live && setError(e.message || 'Could not load details'));
    return () => { live = false; };
  }, [symbol, stockInfo]);

  if (error) return <div style={{ fontSize: 13, color: T.muted }}>Details unavailable: {error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: T.muted }}>Loading details…</div>;

  const m = data.metrics || {};
  const range = m.high52 && m.low52 && price ? Math.min(1, Math.max(0, (price - m.low52) / (m.high52 - m.low52))) : null;
  const stat = (label, value) => (
    <div style={{ background: T.bg, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(data.profile.industry || data.profile.weburl) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/^https:\/\//.test(data.profile.logo || '') && (
            <img src={data.profile.logo} alt="" width={28} height={28} style={{ borderRadius: 6, background: '#fff' }} />
          )}
          <div style={{ fontSize: 13, color: T.muted, flex: 1 }}>{data.profile.industry}</div>
          {/^https?:\/\//.test(data.profile.weburl || '') && (
            <a href={data.profile.weburl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.khaki }}>Website ↗</a>
          )}
        </div>
      )}

      {data.metrics && (
        <div>
          <SectionTitle>Key stats</SectionTitle>
          {range !== null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginBottom: 5 }}>
                <span>52-week low {money(m.low52, hide)}</span><span>high {money(m.high52, hide)}</span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 3, background: T.subtle }}>
                <div style={{
                  position: 'absolute', top: -3, left: `calc(${range * 100}% - 6px)`, width: 12, height: 12,
                  borderRadius: '50%', background: T.khaki, border: `2px solid ${T.card}`,
                }} />
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {stat('P/E', m.pe != null ? m.pe.toFixed(1) : '—')}
            {stat('Market cap', bigMoney(m.marketCap))}
            {stat('Div. yield', m.dividendYield != null ? `${m.dividendYield.toFixed(2)}%` : '—')}
            {stat('Beta', m.beta != null ? m.beta.toFixed(2) : '—')}
          </div>
        </div>
      )}

      {data.analyst && <AnalystTargets a={data.analyst} price={price} hide={hide} />}

      <div>
        <SectionTitle>Earnings</SectionTitle>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>
          {data.nextEarnings
            ? <>Next report: <b>{earningsLabel(data.nextEarnings)}</b>{data.nextEarnings.epsEstimate != null ? <span style={{ color: T.muted }}> · est. EPS ${data.nextEarnings.epsEstimate.toFixed(2)}</span> : null}</>
            : <span style={{ color: T.muted }}>No report scheduled in the next 5 weeks.</span>}
        </div>
        {data.earningsHistory.map(e => {
          const beat = e.actual != null && e.estimate != null ? e.actual >= e.estimate : null;
          return (
            <div key={e.period} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: T.muted, width: 84, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatShortDate(e.period)} ’{e.period.slice(2, 4)}</span>
              <span style={{ color: T.text, flex: 1 }}>
                EPS ${e.actual?.toFixed(2) ?? '—'} <span style={{ color: T.muted }}>vs ${e.estimate?.toFixed(2) ?? '—'} est.</span>
              </span>
              {beat !== null && (
                <span style={{ fontSize: 11, fontWeight: 700, color: beat ? T.green : T.red }}>
                  {beat ? '▲ Beat' : '▼ Miss'}{e.surprisePercent != null ? ` ${Math.abs(e.surprisePercent).toFixed(1)}%` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
