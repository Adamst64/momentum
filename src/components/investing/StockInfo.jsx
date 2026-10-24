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

const bigNum = n => {
  if (n == null) return null;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
};
const fix = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : v.toFixed(d));
const pctOf = (v, d = 2) => (fix(v, d) == null ? null : `${fix(v, d)}%`);

// What the company (or fund) is: description, then a few facts
function About({ about, profile, name }) {
  const [more, setMore] = useState(false);
  const a = about || {};
  const facts = [
    ['CEO', a.ceo],
    ['Employees', a.employees ? a.employees.toLocaleString('en-US') : null],
    ['Headquarters', a.hq],
    [a.fund ? 'Launched' : 'Founded', a.founded],
    ['Sector', a.sector],
    ['Industry', a.industry || profile.industry],
    ['Fund family', a.fundFamily],
    ['Category', a.category],
    ['Type', a.fund?.legalType],
  ].filter(([, v]) => v != null && v !== '');
  const website = [a.website, profile.weburl].find(u => /^https?:\/\//.test(u || ''));
  if (!a.description && !facts.length && !website) return null;
  const long = (a.description || '').length > 280;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/^https:\/\//.test(profile.logo || '') && (
          <img src={profile.logo} alt="" width={28} height={28} style={{ borderRadius: 6, background: '#fff' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}><SectionTitle>About{name ? ` ${name}` : ''}</SectionTitle></div>
      </div>
      {a.description && (
        <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>
          <div style={more || !long ? {} : { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {a.description}
          </div>
          {long && (
            <button onClick={() => setMore(m => !m)} style={{ color: T.khaki, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              {more ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginTop: 14 }}>
          {facts.map(([label, value]) => (
            <div key={label} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginTop: 2, overflowWrap: 'anywhere' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12 }}>
        {website && <a href={website} target="_blank" rel="noopener noreferrer" style={{ color: T.khaki }}>Website ↗</a>}
        {a.wikiUrl && <a href={a.wikiUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.khaki }}>Wikipedia ↗</a>}
        {a.descriptionSource && <span style={{ color: T.muted, marginLeft: 'auto' }}>From {a.descriptionSource}</span>}
      </div>
    </div>
  );
}

// Fund look-through: top holdings, sectors and stock/bond/cash mix
const pct1 = v => `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)}%`;
function Bars({ rows, color }) {
  const max = Math.max(...rows.map(r => r.pct));
  return rows.map(r => (
    <div key={r.key || r.name} style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
        {r.symbol && <span style={{ fontWeight: 700, color: T.text, minWidth: 44 }}>{r.symbol}</span>}
        <span style={{ flex: 1, minWidth: 0, color: r.symbol ? T.muted : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
        <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pct1(r.pct)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: T.subtle, marginTop: 4 }}>
        <div style={{ width: `${Math.max(2, (r.pct / max) * 100)}%`, height: '100%', borderRadius: 2, background: color }} />
      </div>
    </div>
  ));
}

const MIX_COLORS = { Stocks: '#7BC96F', Bonds: '#5AC8FA', Cash: '#FFD60A', Other: '#8E8E93' };

function FundInside({ fund, symbol }) {
  const [allSectors, setAllSectors] = useState(false);
  if (!fund || (!fund.holdings.length && !fund.sectors.length && !fund.mix.length)) return null;
  const sectors = allSectors ? fund.sectors : fund.sectors.slice(0, 5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fund.mix.length > 0 && (
        <div>
          <SectionTitle>What {symbol} holds</SectionTitle>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
            {fund.mix.map(m => <div key={m.name} style={{ flex: m.pct, background: MIX_COLORS[m.name] }} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: T.muted, marginTop: 6 }}>
            {fund.mix.map(m => (
              <span key={m.name}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: MIX_COLORS[m.name], marginRight: 5 }} />{m.name} <b style={{ color: T.text }}>{pct1(m.pct)}</b></span>
            ))}
          </div>
        </div>
      )}
      {fund.holdings.length > 0 && (
        <div>
          <SectionTitle>Top {fund.holdings.length} holdings</SectionTitle>
          {fund.topTenPct != null && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: -4, marginBottom: 4 }}>
              Together {pct1(fund.topTenPct)} of the fund
            </div>
          )}
          <Bars rows={fund.holdings.map(h => ({ ...h, key: h.symbol || h.name }))} color={T.khaki} />
        </div>
      )}
      {fund.sectors.length > 0 && (
        <div>
          <SectionTitle>Sectors</SectionTitle>
          <Bars rows={sectors} color="#5AC8FA" />
          {fund.sectors.length > 5 && (
            <button onClick={() => setAllSectors(v => !v)} style={{ fontSize: 13, color: T.khaki, fontWeight: 600, marginTop: 4 }}>
              {allSectors ? 'Show fewer' : `All ${fund.sectors.length} sectors`}
            </button>
          )}
        </div>
      )}
    </div>
  );
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

// Low/High under the ends of the purple range (where they actually sit on the
// bar), or one combined label when the range is too narrow for two
function RangeLabels({ lowPos, highPos, low, high }) {
  const style = pos => ({
    position: 'absolute', whiteSpace: 'nowrap',
    ...(pos < 12 ? { left: `${pos}%` } : pos > 88 ? { right: `${100 - pos}%` } : { left: `${pos}%`, transform: 'translateX(-50%)' }),
  });
  const narrow = highPos - lowPos < 34;
  return (
    <div style={{ position: 'relative', height: 16, fontSize: 11, color: T.muted, marginTop: 6 }}>
      {narrow ? (
        <span style={style((lowPos + highPos) / 2)}>Low {low} – High {high}</span>
      ) : (
        <>
          <span style={style(lowPos)}>Low {low}</span>
          <span style={style(highPos)}>High {high}</span>
        </>
      )}
    </div>
  );
}

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
              <RangeLabels lowPos={at(a.targetLow)} highPos={at(a.targetHigh)} low={money(a.targetLow, hide)} high={money(a.targetHigh, hide)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.muted, marginTop: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.text, flexShrink: 0 }} />
                <span>
                  Today <b style={{ color: T.text }}>{money(price, hide)}</b> · {
                    price < a.targetLow ? `${((1 - price / a.targetLow) * 100).toFixed(0)}% below the lowest target`
                    : price > a.targetHigh ? `${((price / a.targetHigh - 1) * 100).toFixed(0)}% above the highest target`
                    : price < a.targetMean ? 'between the low and the average target'
                    : 'between the average and the high target'
                  }
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.muted }}>
          No price target available — ratings only.
          {a.tried?.length > 0 && <div style={{ fontSize: 10, marginTop: 4 }}>Tried {a.tried.join(' · ')}</div>}
        </div>
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
  const a = data.about || {};
  const d = data.day || {};
  const f = a.fund || {};
  const range = m.high52 && m.low52 && price ? Math.min(1, Math.max(0, (price - m.low52) / (m.high52 - m.low52))) : null;
  const usd = v => (v == null ? null : money(v, hide));
  const stats = [
    ['Market cap', m.marketCap != null ? bigMoney(m.marketCap) : null],
    ['P/E ratio', fix(m.pe)],
    ['Forward P/E', fix(a.forwardPE)],
    ['Div. yield', pctOf(m.dividendYield)],
    ['Div. / share', usd(m.dividendPerShare)],
    ['EPS (TTM)', usd(m.eps)],
    ['Open', usd(d.open)],
    ['High today', usd(d.high)],
    ['Low today', usd(d.low)],
    ['Volume', bigNum(d.volume)],
    ['Avg. volume', bigNum(d.avgVolume ?? (m.avgVolume10d != null ? m.avgVolume10d * 1e6 : null))],
    ['52-wk high', usd(m.high52)],
    ['52-wk low', usd(m.low52)],
    ['1-yr return', pctOf(m.return52w, 1)],
    ['Beta', fix(m.beta)],
    ['P/B ratio', fix(m.pb)],
    ['P/S ratio', fix(m.ps)],
    ['Revenue growth', pctOf(m.revenueGrowth, 1)],
    ['Net margin', pctOf(m.netMargin, 1)],
    ['ROE', pctOf(m.roe, 1)],
    ['Shares out.', bigNum(a.sharesOutstanding)],
    ['Short % float', a.shortPercentFloat != null ? `${(a.shortPercentFloat * 100).toFixed(2)}%` : null],
    // Funds
    ['Expense ratio', a.expenseRatio != null ? `${(a.expenseRatio * 100).toFixed(2)}%` : null],
    ['Net assets', a.netAssets ? `$${bigNum(a.netAssets)}` : null],
    ['Yield', f.yield != null ? pctOf(f.yield * 100) : null],
    ['YTD return', f.ytdReturn != null ? pctOf(f.ytdReturn * 100, 1) : null],
    ['3-yr avg return', f.return3y != null ? pctOf(f.return3y * 100, 1) : null],
    ['5-yr avg return', f.return5y != null ? pctOf(f.return5y * 100, 1) : null],
    ['P/E of holdings', fix(f.pe)],
    ['Turnover', f.turnover != null ? pctOf(f.turnover * 100, 0) : null],
    ['Beta (3 yr)', fix(f.beta3y)],
  ].filter(([, v]) => v != null);
  const stat = (label, value) => (
    <div key={label} style={{ background: T.bg, borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <About about={data.about} profile={data.profile} name={data.profile.name || data.about?.name} />
      <FundInside fund={a.fund} symbol={symbol} />

      {(stats.length > 0 || range !== null) && (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {stats.map(([label, value]) => stat(label, value))}
          </div>
        </div>
      )}

      {data.analyst && <AnalystTargets a={data.analyst} price={price} hide={hide} />}

      {!(a.fund && !data.nextEarnings && !data.earningsHistory.length) && <div>
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
      </div>}

    </div>
  );
}
