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

const ago = (unix) => {
  const h = Math.round((Date.now() / 1000 - unix) / 3600);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export function earningsLabel(next) {
  if (!next) return null;
  const d = new Date(next.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${d}${HOUR_LABEL[next.hour] ? ` · ${HOUR_LABEL[next.hour]}` : ''}`;
}

// Stats, earnings and news for one stock, loaded when the holding screen opens
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

      <div>
        <SectionTitle>News</SectionTitle>
        {data.news.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>No news in the last two weeks.</div>}
        {data.news.map((n, i) => (
          <a
            key={n.id || n.url}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', padding: '10px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none', textDecoration: 'none' }}
          >
            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.35 }}>{n.headline}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{n.source} · {ago(n.datetime)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
