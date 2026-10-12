import React, { useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { parseDate } from '../../utils/dateUtils';
import { money, monthTitle } from '../../utils/budget';
import { SectionTitle } from '../investing/ui';

const MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const shortDate = ds => parseDate(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Tile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '9px 10px', borderRadius: 10, background: T.bg, border: `1px solid ${T.cardBorder}` }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Line({ left, sub, right, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 0', borderTop: `1px solid ${T.cardBorder}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, flexShrink: 0 }}>{right}</div>
    </Tag>
  );
}

// Month by month for this category, with the monthly average as a dashed line.
// Tap a bar for its amount.
function MonthBars({ stats, color, currentYM, onOpenMonth }) {
  const { months, byMonth, avgMonth, highMonth, lowMonth } = stats;
  const [picked, setPicked] = useState(null);
  const scroller = useRef(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, []);
  // At least a year of slots so a new category doesn't draw one giant bar
  const shown = months.length >= 12 ? months : [...Array.from({ length: 12 - months.length }, () => null), ...months];
  const max = Math.max(...months.map(m => byMonth[m]), avgMonth || 0, 1);
  const H = 96;
  const wide = shown.length > 12;
  const width = wide ? shown.length * 22 : '100%';

  return (
    <div>
      <div style={{ minHeight: 34, fontSize: 13, color: T.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
        {picked ? (
          <>
            <span style={{ flex: 1 }}><b style={{ color: T.text }}>{monthTitle(picked)}</b> · {money(byMonth[picked])}{picked === currentYM ? ' so far' : ''}</span>
            <button onClick={() => onOpenMonth(picked)} style={{ fontSize: 12, fontWeight: 600, color: T.khaki }}>Open month ›</button>
          </>
        ) : <span>Tap a bar to see that month.</span>}
      </div>
      <div ref={scroller} style={{ overflowX: wide ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
        <div style={{ position: 'relative', width }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: H + 14 }}>
            {shown.map((m, i) => {
              if (!m) return <span key={'pad' + i} style={{ flex: 1, height: 1, alignSelf: 'flex-end', background: T.subtle }} />;
              const v = byMonth[m];
              const on = picked === m;
              const mark = m === highMonth && highMonth !== lowMonth ? 'High' : m === lowMonth && highMonth !== lowMonth ? 'Low' : null;
              return (
                <button key={m} onClick={() => setPicked(on ? null : m)} aria-label={`${monthTitle(m)}: ${money(v)}`}
                  style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: 0 }}>
                  {mark && <span style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{mark}</span>}
                  <span style={{
                    width: '100%', maxWidth: 22, height: v ? Math.max(3, (v / max) * H) : 1,
                    borderRadius: '4px 4px 0 0', background: v ? color : T.subtle,
                    opacity: picked && !on ? 0.45 : m === currentYM ? 0.6 : 1,
                  }} />
                </button>
              );
            })}
          </div>
          {avgMonth !== null && avgMonth > 0 && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: (avgMonth / max) * H, borderTop: `1.5px dashed ${T.khaki}`,
              pointerEvents: 'none', opacity: 0.8,
            }} />
          )}
          <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
            {shown.map((m, i) => (
              <span key={m || 'l' + i} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 10, color: T.muted }}>
                {m ? (wide && !m.endsWith('-01') ? '' : wide ? `’${m.slice(2, 4)}` : MON[Number(m.slice(5)) - 1]) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      {avgMonth !== null && avgMonth > 0 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, borderTop: `1.5px dashed ${T.khaki}` }} /> Monthly average · this month is paler while it's still adding up
        </div>
      )}
    </div>
  );
}

export default function CategoryDetail({
  category: c, stats, share, accountsById, scopeLabel, currentYM, onOpenTx, onOpenMonth, onShowAll, onEdit, onClose,
}) {
  const income = stats.kind === 'income';
  const verb = income ? 'received' : 'spent';
  const often = stats.perMonthCount;

  return (
    <Modal title={`${c.emoji} ${c.label}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ marginTop: -8 }}>
          <div style={{ fontSize: 12, color: T.muted }}>Total {verb}{scopeLabel ? ` · ${scopeLabel}` : ''} since {monthTitle(stats.months[0])}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>{money(stats.total)}</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            {stats.count} entr{stats.count === 1 ? 'y' : 'ies'}
            {share !== null && !income && <> · {Math.round(share * 100)}% of all your spending</>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* The month isn't over, so no % change against a full month; just last month's total beside it */}
          <Tile label="This month" value={money(stats.thisMonth)}
            sub={stats.lastMonth !== null ? `so far · last month ${money(stats.lastMonth)}` : 'so far'} />
          <Tile label="Monthly average" value={stats.avgMonth !== null ? money(stats.avgMonth) : '—'}
            sub={stats.done.length ? `over ${stats.done.length} month${stats.done.length === 1 ? '' : 's'}` : 'after this month'} />
          <Tile label="Per year" value={stats.yearly ? money(stats.yearly.value) : '—'}
            sub={!stats.yearly ? 'needs a full month' : stats.yearly.estimate ? 'estimate' : 'last 12 months'} />
        </div>

        <div>
          <SectionTitle>Month by month</SectionTitle>
          <MonthBars stats={stats} color={c.color} currentYM={currentYM} onOpenMonth={onOpenMonth} />
          {stats.highMonth && stats.highMonth !== stats.lowMonth && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <Tile label={income ? 'Best month' : 'Most spent'} value={money(stats.byMonth[stats.highMonth])} sub={monthTitle(stats.highMonth)} />
              <Tile label={income ? 'Lowest month' : 'Least spent'} value={money(stats.byMonth[stats.lowMonth])} sub={monthTitle(stats.lowMonth)} />
            </div>
          )}
        </div>

        <div>
          <SectionTitle>By year</SectionTitle>
          {stats.years.map(y => (
            <Line key={y.year} left={y.year}
              sub={y.perMonth !== null ? `${money(y.perMonth)} a month${y.partial ? ' · so far' : y.months < 12 ? ` · ${y.months} month${y.months === 1 ? '' : 's'} tracked` : ''}` : 'this month so far'}
              right={money(y.total)} />
          ))}
        </div>

        <div>
          <SectionTitle>Habits</SectionTitle>
          <Line left={income ? 'Average payment' : 'Average purchase'} right={money(stats.perPurchase)} />
          {often !== null && (
            <Line left="How often" right={often >= 1 ? `about ${Math.round(often)}× a month` : `about once every ${Math.max(2, Math.round(1 / often))} months`} />
          )}
        </div>

        {stats.places.length > 0 && (
          <div>
            <SectionTitle>Top places</SectionTitle>
            {stats.places.map(p => (
              <Line key={p.name} left={p.name} sub={`${p.count} time${p.count === 1 ? '' : 's'}`} right={money(p.total)} />
            ))}
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>From the note on each entry.</div>
          </div>
        )}

        <div>
          <SectionTitle>{income ? 'Biggest payments' : 'Biggest purchases'}</SectionTitle>
          {stats.biggest.map(t => (
            <Line key={t.id} left={t.note || c.label} sub={`${shortDate(t.date)} · ${accountsById[t.accountId]?.name || 'Deleted account'}`}
              right={money(t.amount)} onClick={() => onOpenTx(t)} />
          ))}
        </div>

        {stats.byAccount.length > 1 && (
          <div>
            <SectionTitle>By account</SectionTitle>
            {stats.byAccount.map(a => (
              <Line key={a.id} left={accountsById[a.id]?.name || 'Deleted account'}
                sub={`${Math.round((a.total / stats.total) * 100)}%`} right={money(a.total)} />
            ))}
          </div>
        )}

        <div>
          <SectionTitle right={<button onClick={onShowAll} style={{ fontSize: 12, fontWeight: 600, color: T.khaki }}>Show in list ›</button>}>
            Latest
          </SectionTitle>
          {stats.recent.map(t => (
            <Line key={t.id} left={t.note || c.label} sub={shortDate(t.date)} right={money(t.amount)} onClick={() => onOpenTx(t)} />
          ))}
        </div>

        {onEdit && (
          <button onClick={onEdit} style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 14, fontWeight: 600 }}>
            Edit category (name, emoji, color)
          </button>
        )}
      </div>
    </Modal>
  );
}
