import React, { useMemo, useState } from 'react';
import { T } from '../../theme';
import { parseDate, todayStr } from '../../utils/dateUtils';
import { money, monthTitle, shiftMonth, lookupCategory, BALANCE_CATEGORY } from '../../utils/budget';
import { Card } from '../investing/ui';
import { SubBar } from '../TabBar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// "$1.2k" for the small calendar cells, whole dollars below that
const short = cents => {
  const d = Math.abs(cents) / 100;
  return '$' + (d >= 10000 ? `${Math.round(d / 1000)}k` : d >= 1000 ? `${(d / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(d));
};

// Spent and earned per day ('YYYY-MM-DD') and per month ('YYYY-MM'). Transfers and
// existing balances move money but aren't spending or earning.
function tally(txs) {
  const day = {}, mon = {};
  const add = (map, k, field, v) => { (map[k] || (map[k] = { spent: 0, earned: 0, count: 0 }))[field] += v; };
  for (const t of txs) {
    let field = null;
    if (t.type === 'expense') field = 'spent';
    if (t.type === 'income' && t.category !== BALANCE_CATEGORY.id) field = 'earned';
    if (!field) continue;
    add(day, t.date, field, t.amount); day[t.date].count++;
    add(mon, t.date.slice(0, 7), field, t.amount); mon[t.date.slice(0, 7)].count++;
  }
  return { day, mon };
}

function Totals({ spent, earned, extra }) {
  const net = earned - spent;
  const cell = (label, value, color) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || T.text, marginTop: 2, whiteSpace: 'nowrap', letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
  return (
    <Card>
      <div style={{ display: 'flex', gap: 10 }}>
        {cell('Spent', money(spent))}
        {cell('Earned', money(earned), earned ? T.green : T.text)}
        {cell('Net', (net > 0 ? '+' : '') + money(net), net < 0 ? T.red : net > 0 ? T.green : T.text)}
      </div>
      {extra}
    </Card>
  );
}

function Nav({ title, onPrev, onNext, nextDisabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onPrev} aria-label="Previous" style={{ color: T.khaki, fontSize: 22, padding: '2px 12px' }}>‹</button>
      <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{title}</span>
      <button onClick={onNext} disabled={nextDisabled} aria-label="Next" style={{ color: nextDisabled ? T.subtle : T.khaki, fontSize: 22, padding: '2px 12px' }}>›</button>
    </div>
  );
}

// Year: 12 month cards with spent / earned / net. Month: a day grid with each day's
// spending, the month's preview, and a tapped day's entries. txs are already narrowed
// to the open account, if any.
export default function BudgetCalendar({ txs, categories, startYM, startView, onOpenTx }) {
  const nowYM = todayStr().slice(0, 7);
  const [view, setView] = useState(startView || 'year'); // 'year' | 'month'
  const [ym, setYm] = useState(startYM || nowYM);
  const [day, setDay] = useState(null);
  const year = ym.slice(0, 4);
  const { day: byDay, mon: byMon } = useMemo(() => tally(txs), [txs]);

  const openMonth = m => { setYm(m); setDay(null); setView('month'); };
  const bar = <SubBar items={[{ value: 'year', label: 'Year' }, { value: 'month', label: 'Month' }]} value={view} onChange={v => { setView(v); setDay(null); }} />;

  if (view === 'year') {
    const months = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const rows = months.map(m => ({ m, ...(byMon[m] || { spent: 0, earned: 0, count: 0 }) }));
    const spent = rows.reduce((s, r) => s + r.spent, 0), earned = rows.reduce((s, r) => s + r.earned, 0);
    const max = Math.max(1, ...rows.map(r => Math.max(r.spent, r.earned)));
    // Averages over the months that are over and had something logged
    const done = rows.filter(r => r.m < nowYM && r.count);
    const avgSpent = done.length ? Math.round(done.reduce((s, r) => s + r.spent, 0) / done.length) : null;
    const avgEarned = done.length ? Math.round(done.reduce((s, r) => s + r.earned, 0) / done.length) : null;
    return (
      <>
        {bar}
        <Nav title={year} onPrev={() => setYm(`${Number(year) - 1}-${ym.slice(5)}`)}
          onNext={() => setYm(`${Number(year) + 1}-${ym.slice(5)}`)} nextDisabled={year >= nowYM.slice(0, 4)} />
        <Totals spent={spent} earned={earned} extra={avgSpent !== null && (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
            A month on average: {money(avgSpent)} spent · {money(avgEarned)} earned
          </div>
        )} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {rows.map(r => {
            const future = r.m > nowYM, now = r.m === nowYM, net = r.earned - r.spent;
            return (
              <button key={r.m} onClick={() => openMonth(r.m)} disabled={future}
                style={{
                  textAlign: 'left', padding: '9px 9px 8px', borderRadius: 12, minWidth: 0, opacity: future ? 0.35 : 1,
                  background: now ? '#2A3A1A' : T.card, border: `1px solid ${now ? T.olive : T.cardBorder}`,
                }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: now ? T.khaki : T.text }}>{MONTHS[Number(r.m.slice(5)) - 1]}</div>
                {r.count ? (
                  <>
                    <div style={{ fontSize: 12, color: T.text, marginTop: 4, whiteSpace: 'nowrap' }}>−{short(r.spent)}</div>
                    <div style={{ fontSize: 12, color: r.earned ? T.green : T.muted, whiteSpace: 'nowrap' }}>+{short(r.earned)}</div>
                    {/* Spent vs earned, side by side, against the year's biggest month */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18, marginTop: 5 }}>
                      <span style={{ flex: 1, height: `${Math.max(r.spent ? 8 : 0, (r.spent / max) * 100)}%`, background: T.red, opacity: 0.75, borderRadius: 2 }} />
                      <span style={{ flex: 1, height: `${Math.max(r.earned ? 8 : 0, (r.earned / max) * 100)}%`, background: T.green, opacity: 0.75, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: net < 0 ? T.red : net > 0 ? T.green : T.muted, whiteSpace: 'nowrap' }}>
                      {net > 0 ? '+' : net < 0 ? '−' : ''}{short(net)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{future ? '' : 'Nothing'}</div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: -6 }}>Each month: spent, earned, and net at the bottom. Tap one to see it day by day.</div>
      </>
    );
  }

  // ── Month, day by day ──
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const lead = new Date(y, m - 1, 1).getDay();
  const today = todayStr();
  const monthTxs = txs.filter(t => t.date.startsWith(ym));
  const tot = byMon[ym] || { spent: 0, earned: 0 };
  const dayKeys = Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
  const maxDay = Math.max(1, ...dayKeys.map(d => byDay[d]?.spent || 0));
  // Preview: top categories, the biggest day, a day's average so far
  const cats = {};
  for (const t of monthTxs) if (t.type === 'expense') cats[t.category] = (cats[t.category] || 0) + t.amount;
  const top = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const biggest = dayKeys.reduce((b, d) => ((byDay[d]?.spent || 0) > (b ? byDay[b].spent : 0) ? d : b), null);
  const daysSoFar = ym < today.slice(0, 7) ? days : ym === today.slice(0, 7) ? Number(today.slice(8)) : 0;
  const perDay = daysSoFar ? Math.round(tot.spent / daysSoFar) : null;
  const picked = day ? monthTxs.filter(t => t.date === day) : [];
  const fmtDay = d => parseDate(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <>
      {bar}
      <Nav title={monthTitle(ym)} onPrev={() => { setYm(shiftMonth(ym, -1)); setDay(null); }}
        onNext={() => { setYm(shiftMonth(ym, 1)); setDay(null); }} nextDisabled={ym >= nowYM} />
      <Totals spent={tot.spent} earned={tot.earned} extra={(top.length > 0 || perDay !== null) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}`, fontSize: 13 }}>
          {top.map(([id, v]) => {
            const c = lookupCategory(categories, id);
            return (
              <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span aria-hidden="true">{c.emoji}</span>
                <span style={{ flex: 1, color: T.text }}>{c.label}</span>
                <span style={{ color: T.muted, fontSize: 12 }}>{Math.round((v / tot.spent) * 100)}%</span>
                <span style={{ color: T.text, fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{money(v)}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {perDay !== null && <>About {money(perDay)} a day</>}
            {biggest && <> · biggest day {parseDate(biggest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({money(byDay[biggest].spent)})</>}
          </div>
        </div>
      )} />

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
          {DOW.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, color: T.muted, fontWeight: 700 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {Array.from({ length: lead }, (_, i) => <div key={'x' + i} />)}
          {dayKeys.map((d, i) => {
            const v = byDay[d], future = d > today, on = day === d;
            // The more spent that day, the stronger the tint
            const heat = v?.spent ? 0.12 + 0.5 * (v.spent / maxDay) : 0;
            return (
              <button key={d} onClick={() => setDay(on ? null : d)} disabled={future}
                style={{
                  minWidth: 0, height: 52, padding: '4px 2px', borderRadius: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  background: heat ? `rgba(255,69,58,${heat})` : T.card, opacity: future ? 0.35 : 1,
                  border: `1.5px solid ${on ? T.khaki : d === today ? T.olive : 'transparent'}`,
                }}>
                <span style={{ fontSize: 12, fontWeight: d === today ? 800 : 600, color: d === today ? T.khaki : T.text }}>{i + 1}</span>
                <span style={{ fontSize: 10, color: T.text, whiteSpace: 'nowrap', lineHeight: 1.1 }}>{v?.spent ? short(v.spent) : ''}</span>
                <span style={{ fontSize: 10, color: T.green, whiteSpace: 'nowrap', lineHeight: 1.1 }}>{v?.earned ? '+' + short(v.earned) : ''}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>Darker red = more spent that day. Tap a day for its entries.</div>
      </div>

      {day && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: T.text }}>{fmtDay(day)}</span>
            {byDay[day]?.spent > 0 && <span style={{ fontSize: 13, color: T.text }}>−{money(byDay[day].spent)}</span>}
            {byDay[day]?.earned > 0 && <span style={{ fontSize: 13, color: T.green }}>+{money(byDay[day].earned)}</span>}
          </div>
          {picked.length === 0 && <div style={{ fontSize: 13, color: T.muted, padding: '6px 0' }}>Nothing logged that day.</div>}
          {picked.map(t => {
            const c = t.type === 'transfer' ? { emoji: '⇄', label: 'Transfer' } : lookupCategory(categories, t.category);
            const income = t.type === 'income';
            return (
              <button key={t.id} onClick={() => onOpenTx(t)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 0', borderTop: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 17, width: 24, textAlign: 'center' }} aria-hidden="true">{c.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || c.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: income ? T.green : t.type === 'transfer' ? T.muted : T.text }}>
                  {income ? '+' : t.type === 'expense' ? '−' : ''}{money(t.amount)}
                </span>
              </button>
            );
          })}
        </Card>
      )}
    </>
  );
}
