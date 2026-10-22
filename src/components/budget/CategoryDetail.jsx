import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { money, monthTitle, shiftMonth } from '../../utils/budget';
import { Chips, inputStyle } from '../investing/ui';

const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const SEASONS = [
  { label: 'Winter', months: ['12', '01', '02'] },
  { label: 'Spring', months: ['03', '04', '05'] },
  { label: 'Summer', months: ['06', '07', '08'] },
  { label: 'Fall',   months: ['09', '10', '11'] },
];

// One category: the average per month for a period you pick (last 3/6/12 months,
// this year, any past year, all time or your own months), the months as bars with
// the average line, and averages by season. The current month is shown but not
// averaged in, since it's still adding up.
export default function CategoryDetail({ category: c, stats, scopeLabel, currentYM, onShowTransactions, onEdit, renderExtra, onClose }) {
  const income = stats.kind === 'income';
  const first = stats.months[0];
  const lastFull = shiftMonth(currentYM, -1);
  const thisYear = currentYM.slice(0, 4);
  const pastYears = [...new Set(stats.months.map(m => m.slice(0, 4)))].filter(y => y < thisYear).reverse();
  const [pick, setPick] = useState('all');
  const [from, setFrom] = useState(shiftMonth(currentYM, -3));
  const [to, setTo] = useState(lastFull);

  // The chosen months, as [startYM, endYM] (end inclusive)
  const [start, end] = useMemo(() => {
    // The last N finished months, plus this month so far (shown, not averaged)
    if (pick === 'l3') return [shiftMonth(lastFull, -2), currentYM];
    if (pick === 'l6') return [shiftMonth(lastFull, -5), currentYM];
    if (pick === 'l12') return [shiftMonth(lastFull, -11), currentYM];
    if (pick === 'ytd') return [`${thisYear}-01`, currentYM];
    if (pick === 'all') return [first, currentYM];
    if (pick === 'custom') return from <= to ? [from, to] : [to, from];
    return [`${pick}-01`, `${pick}-12`]; // a past year
  }, [pick, from, to, first, lastFull, currentYM, thisYear]);

  const months = [];
  for (let m = start; m <= end && months.length < 600; m = shiftMonth(m, 1)) months.push(m);
  const val = m => stats.byMonth[m] || 0;
  // Averaged: finished months you were tracking (not before this category's first entry)
  const counted = months.filter(m => m < currentYM && m >= first);
  const total = months.reduce((s, m) => s + val(m), 0);
  const avg = counted.length ? Math.round(counted.reduce((s, m) => s + val(m), 0) / counted.length) : null;
  const inProgress = months.includes(currentYM);

  const seasons = SEASONS.map(s => {
    const ms = stats.months.filter(m => m < currentYM && s.months.includes(m.slice(5)));
    return { ...s, n: ms.length, avg: ms.length ? Math.round(ms.reduce((t, m) => t + val(m), 0) / ms.length) : null };
  });
  const seasonMax = Math.max(...seasons.map(s => s.avg || 0));

  const options = [
    { value: 'all', label: 'All time' },
    { value: 'l3', label: '3 mo' }, { value: 'l6', label: '6 mo' }, { value: 'l12', label: '12 mo' },
    { value: 'ytd', label: thisYear }, ...pastYears.map(y => ({ value: y, label: y })),
    { value: 'custom', label: 'Custom' },
  ];
  const periodText = pick === 'l3' ? 'last 3 months' : pick === 'l6' ? 'last 6 months' : pick === 'l12' ? 'last 12 months'
    : pick === 'ytd' ? `${thisYear} so far` : pick === 'all' ? 'all time' : pick === 'custom' ? `${monthTitle(start)} – ${monthTitle(end)}` : pick;

  return (
    <Modal title={`${c.emoji} ${c.label}`} onClose={onClose} full>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Chips small options={options} value={pick} onChange={setPick} />
        {pick === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: -8 }}>
            <input type="month" value={from} max={currentYM} onChange={e => e.target.value && setFrom(e.target.value)} style={{ ...inputStyle, flex: 1 }} aria-label="From month" />
            <span style={{ color: T.muted }}>–</span>
            <input type="month" value={to} max={currentYM} onChange={e => e.target.value && setTo(e.target.value)} style={{ ...inputStyle, flex: 1 }} aria-label="To month" />
          </div>
        )}

        {/* The headline: average per month for the period */}
        <div style={{ padding: '16px 16px 14px', borderRadius: 16, background: c.color + '22', border: `1px solid ${c.color}66` }}>
          <div style={{ fontSize: 13, color: T.muted }}>Average {income ? 'received' : 'spent'} per month · {periodText}{scopeLabel ? ` · ${scopeLabel}` : ''}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: T.text, letterSpacing: -0.8, marginTop: 2 }}>{avg !== null ? money(avg) : '—'}</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
            {money(total)} total{counted.length ? ` · averaged over ${counted.length} month${counted.length === 1 ? '' : 's'}` : ''}
            {inProgress && <> · {monthTitle(currentYM)} so far {money(val(currentYM))} (not averaged yet)</>}
          </div>
          {!counted.length && <div style={{ fontSize: 12, color: T.khaki, marginTop: 4 }}>No finished months in this period yet.</div>}
        </div>

        <PeriodBars months={months} val={val} avg={avg} color={c.color} currentYM={currentYM} />

        {seasons.some(s => s.avg !== null) && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Average month by season · all time</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {seasons.map(s => {
                const top = s.avg !== null && s.avg === seasonMax && seasons.filter(x => x.avg !== null).length > 1;
                return (
                  <div key={s.label} style={{ padding: '9px 8px', borderRadius: 12, background: T.card, border: `1px solid ${top ? c.color : T.cardBorder}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: top ? T.text : T.muted, fontWeight: top ? 700 : 400 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: s.avg !== null ? T.text : T.muted, marginTop: 2 }}>{s.avg !== null ? money(s.avg) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {renderExtra && renderExtra(start, end)}

        <button onClick={() => onShowTransactions(start, end)}
          style={{ padding: 14, borderRadius: 14, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 700 }}>
          🧾 Transactions in {c.label} ›
        </button>
        {onEdit && (
          <button onClick={onEdit} style={{ padding: 10, fontSize: 13, color: T.muted }}>Edit category (name, emoji, color)</button>
        )}
      </div>
    </Modal>
  );
}

// The period's months as bars, with the average as a dashed line. Tap a bar for its amount.
function PeriodBars({ months, val, avg, color, currentYM }) {
  const [picked, setPicked] = useState(null);
  const scroller = useRef(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [months.length]);
  if (!months.length) return null;
  const max = Math.max(...months.map(val), avg || 0, 1);
  const H = 110;
  const wide = months.length > 12;
  return (
    <div>
      <div style={{ minHeight: 22, fontSize: 13, color: T.muted, marginBottom: 4 }}>
        {picked ? <><b style={{ color: T.text }}>{monthTitle(picked)}</b> · {money(val(picked))}{picked === currentYM ? ' so far' : ''}{avg ? ` · ${val(picked) >= avg ? 'above' : 'below'} average` : ''}</> : 'Tap a bar for that month.'}
      </div>
      <div ref={scroller} style={{ overflowX: wide ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
        <div style={{ position: 'relative', width: wide ? months.length * 24 : '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: H }}>
            {months.map(m => {
              const v = val(m), on = picked === m;
              return (
                <button key={m} onClick={() => setPicked(on ? null : m)} aria-label={`${monthTitle(m)}: ${money(v)}`}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', padding: 0 }}>
                  <span style={{ width: '100%', height: v ? Math.max(3, (v / max) * H) : 1, borderRadius: '4px 4px 0 0',
                    background: v ? color : T.subtle, opacity: picked && !on ? 0.4 : m === currentYM ? 0.55 : 1 }} />
                </button>
              );
            })}
          </div>
          {avg > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18 + (avg / max) * H, borderTop: `2px dashed ${T.khaki}`, pointerEvents: 'none' }} />}
          <div style={{ display: 'flex', gap: 3, marginTop: 4, height: 14 }}>
            {months.map(m => (
              <span key={m} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: T.muted }}>
                {wide && !m.endsWith('-01') ? '' : m.endsWith('-01') && months.length > 12 ? `’${m.slice(2, 4)}` : MON[Number(m.slice(5)) - 1]}
              </span>
            ))}
          </div>
        </div>
      </div>
      {avg > 0 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, borderTop: `2px dashed ${T.khaki}` }} /> Average {money(avg)} a month
        </div>
      )}
    </div>
  );
}
