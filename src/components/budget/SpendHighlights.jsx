import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../theme';
import { money, shiftMonth, monthTitle, BALANCE_CATEGORY } from '../../utils/budget';
import { Card, SectionTitle } from '../investing/ui';

const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// Spending month by month for a year or all time: average, priciest and cheapest
// month (finished months only — the current one is still adding up), and a bar
// per month. Tap a bar for its numbers and a link to that month.
export default function SpendHighlights({ txs, range, year, currentYM, onOpenMonth }) {
  const [picked, setPicked] = useState(null);
  const scroller = useRef(null);
  // All time opens on the latest months
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, []);

  // Months shown: Jan–Dec of the year, or the first month with an entry up to now
  let months = [];
  if (range === 'year') {
    months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  } else {
    const first = txs.reduce((m, t) => (t.date < m ? t.date : m), currentYM + '-99').slice(0, 7);
    for (let ym = first; ym <= currentYM && months.length < 240; ym = shiftMonth(ym, 1)) months.push(ym);
  }
  const by = Object.fromEntries(months.map(m => [m, { spent: 0, income: 0 }]));
  for (const t of txs) {
    const row = by[t.date.slice(0, 7)];
    if (!row) continue;
    if (t.type === 'expense') row.spent += t.amount;
    if (t.type === 'income' && t.category !== BALANCE_CATEGORY.id) row.income += t.amount;
  }
  const done = months.filter(m => m < currentYM && by[m].spent > 0);
  if (!done.length && !months.some(m => by[m].spent > 0)) return null;
  const high = done.reduce((b, m) => (!b || by[m].spent > by[b].spent ? m : b), null);
  const low = done.reduce((b, m) => (!b || by[m].spent < by[b].spent ? m : b), null);
  const avg = done.length ? done.reduce((s, m) => s + by[m].spent, 0) / done.length : null;
  const max = Math.max(...months.map(m => by[m].spent), 1);
  const sel = picked && by[picked] ? picked : null;
  const wide = months.length > 12;

  const tile = (label, ym, value, color) => (
    <button onClick={() => ym && setPicked(ym)} style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '8px 10px', borderRadius: 10, background: T.bg, border: `1px solid ${T.cardBorder}` }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || T.text, marginTop: 2 }}>{value}</div>
      {ym && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{monthTitle(ym)}</div>}
    </button>
  );

  return (
    <Card>
      <SectionTitle>Month by month</SectionTitle>
      <div style={{ display: 'flex', gap: 6 }}>
        {tile('Most spent', high, high ? money(by[high].spent) : '—', T.red)}
        {tile('Least spent', low, low ? money(by[low].spent) : '—', T.green)}
        {tile('Average', null, avg !== null ? money(Math.round(avg)) : '—')}
      </div>

      <div style={{ minHeight: 36, marginTop: 12, fontSize: 13, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
        {sel ? (
          <>
            <span style={{ flex: 1 }}>
              <b style={{ color: T.text }}>{monthTitle(sel)}</b> · {money(by[sel].spent)} spent
              {by[sel].income ? <span style={{ color: T.green }}> · +{money(by[sel].income)}</span> : null}
            </span>
            <button onClick={() => onOpenMonth(sel)} style={{ fontSize: 12, fontWeight: 600, color: T.khaki }}>Open ›</button>
          </>
        ) : <span>Tap a bar to see that month.</span>}
      </div>

      <div ref={scroller} style={{ overflowX: wide ? 'auto' : 'visible', margin: wide ? '0 -16px' : 0, padding: wide ? '0 16px' : 0, scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, minWidth: wide ? months.length * 20 : 0 }}>
          {months.map(m => {
            const v = by[m].spent;
            const on = sel === m;
            const mark = m === high ? 'High' : m === low ? 'Low' : null;
            return (
              <button key={m} onClick={() => setPicked(on ? null : m)} aria-label={`${monthTitle(m)}: ${money(v)}`}
                style={{ flex: wide ? '0 0 18px' : 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: 0 }}>
                {mark && <span style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{mark}</span>}
                <span style={{
                  width: '100%', maxWidth: 22, height: v ? Math.max(3, (v / max) * 86) : 1,
                  borderRadius: '4px 4px 0 0', background: v ? (on ? T.khaki : T.olive) : T.subtle,
                  opacity: m > currentYM ? 0.3 : 1,
                }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4, minWidth: wide ? months.length * 20 : 0 }}>
          {months.map(m => (
            <span key={m} style={{ flex: wide ? '0 0 18px' : 1, textAlign: 'center', fontSize: 10, color: T.muted }}>
              {wide ? (m.endsWith('-01') ? m.slice(2, 4) : '') : MON[Number(m.slice(5)) - 1]}
            </span>
          ))}
        </div>
      </div>
      {wide && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Labels mark January of each year (’25, ’26…).</div>}
    </Card>
  );
}
