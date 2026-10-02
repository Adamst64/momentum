import React, { useState } from 'react';
import { T } from '../../theme';
import { getMondayId, formatWeekRange, parsePayEntry, dayEntries } from '../../utils/workUtils';

const NO_LEAD = '#E8875A'; // orange tag for days worked without being crew lead

function fmt(n) {
  if (!n) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function WeekCrewRow({ mondayId, crewId, stats, rawEntry, crews, onSetPayment, isCurrentWeek }) {
  const { paid, amount: savedAmount } = parsePayEntry(rawEntry);
  const crew = crews.find(c => c.id === crewId);
  const [localAmt, setLocalAmt] = useState(savedAmount > 0 ? String(savedAmount) : '');
  const [editing, setEditing]   = useState(false);

  const showInput = isCurrentWeek || editing;

  const save = (newPaid = paid) => {
    onSetPayment(mondayId, crewId, newPaid, parseFloat(localAmt) || 0);
    if (editing) setEditing(false);
  };

  const dc = stats.days.length;
  const leadDays = stats.days.filter(d => d.isCrewLead).length;

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {crew?.color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: crew.color, flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{crew?.name || 'No crew'}</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {dc} day{dc !== 1 ? 's' : ''}
            {' · '}<span style={{ color: T.green }}>{leadDays} lead</span>
            {' · '}<span style={{ color: NO_LEAD }}>{dc - leadDays} no lead</span>
            {' · '}{stats.windows} win · {stats.doors} doors
          </div>
          {[...stats.days].sort((a, b) => a.id.localeCompare(b.id)).map(d => (
            <div key={d.id} style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              <span style={{ color: T.text }}>{new Date(d.id + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}</span>
              {(() => {
                const c = d.isCrewLead ? T.green : NO_LEAD;
                return (
                  <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + '22', border: `1px solid ${c}44`, borderRadius: 6, padding: '0 5px', marginLeft: 5 }}>
                    {d.isCrewLead ? 'LEAD' : 'NO LEAD'}
                  </span>
                );
              })()}
              {' · '}{d.windows || 0}w · {d.doors || 0}dr
              {d.comment ? <span> · {d.comment}</span> : null}
            </div>
          ))}
        </div>
        <button
          onClick={() => { if (!paid || editing) save(!paid); }}
          style={{
            padding: '6px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, flexShrink: 0,
            background: paid ? T.green + '22' : T.subtle,
            color: paid ? T.green : T.muted,
            border: `1px solid ${paid ? T.green + '44' : T.cardBorder}`,
            cursor: paid && !editing ? 'default' : 'pointer',
            opacity: paid && !editing ? 0.85 : 1,
          }}
        >{paid ? 'Paid ✓' : 'Mark Paid'}</button>
      </div>

      {showInput ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: T.muted }}>$</span>
          <input
            value={localAmt}
            onChange={e => setLocalAmt(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={() => { if (isCurrentWeek) save(); }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Amount…"
            inputMode="decimal"
            autoFocus={editing}
            style={{
              flex: 1, background: T.bg, border: `1px solid ${T.cardBorder}`,
              borderRadius: 8, padding: '8px 12px', color: T.text, fontSize: 15,
              outline: 'none', colorScheme: 'dark',
            }}
          />
          {editing && (
            <button
              onClick={() => save()}
              style={{ padding: '8px 14px', borderRadius: 8, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}
            >✓</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: savedAmount > 0 ? T.khaki : T.muted }}>
            {savedAmount > 0 ? `$${savedAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'}
          </span>
          <button
            onClick={() => setEditing(true)}
            style={{ fontSize: 16, color: T.muted, padding: '4px 8px' }}
          >✎</button>
        </div>
      )}
    </div>
  );
}

export default function WorkPaySection({ days, weeks, crews, onSetPayment }) {
  const currentYear    = String(new Date().getFullYear());
  const currentMondayId = getMondayId((() => { const d = new Date(); const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; })());
  const [summaryYear, setSummaryYear] = useState(currentYear);
  // Expanded weeks in the list; the current week starts open so its pay is easy to enter
  const [openWeeks, setOpenWeeks] = useState(() => new Set([currentMondayId]));
  const toggleWeek = id => setOpenWeeks(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const weeksMap = {};
  weeks.forEach(w => { weeksMap[w.id] = w; });

  // Group work days (exclude off) by week → crew
  const grouped = {};
  // (a day split between two crews counts for each crew)
  days.flatMap(dayEntries).forEach(day => {
    const wk  = getMondayId(day.id);
    const cid = day.crewId || '__none__';
    if (!grouped[wk]) grouped[wk] = {};
    if (!grouped[wk][cid]) grouped[wk][cid] = { days: [], windows: 0, doors: 0 };
    grouped[wk][cid].days.push(day);
    grouped[wk][cid].windows += day.windows || 0;
    grouped[wk][cid].doors   += day.doors   || 0;
  });

  // Earnings per year → crewId → sum of paid amounts
  const earnings = {};
  weeks.forEach(w => {
    const yr = w.id.slice(0, 4);
    Object.entries(w).forEach(([key, val]) => {
      if (key === 'id') return;
      const { paid, amount } = parsePayEntry(val);
      if (paid && amount > 0) {
        if (!earnings[yr]) earnings[yr] = {};
        earnings[yr][key] = (earnings[yr][key] || 0) + amount;
      }
    });
  });

  // Available years: only years that have actual (non-off) work days
  const yearSet = new Set(days.filter(d => !d.isOff).map(d => d.id.slice(0, 4)));
  const availableYears = [...yearSet].sort((a, b) => b.localeCompare(a));
  // If selected year no longer has data, snap to most recent
  const effectiveSummaryYear = availableYears.includes(summaryYear)
    ? summaryYear
    : (availableYears[0] || currentYear);

  const sortedWeekIds = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const yearData  = earnings[effectiveSummaryYear] || {};
  const yearTotal = Object.values(yearData).reduce((s, v) => s + v, 0);

  // Days worked per crew for the selected year
  const yearDaysMap = {};
  days.filter(d => d.id.slice(0, 4) === effectiveSummaryYear).flatMap(dayEntries).filter(e => e.crewId)
    .forEach(e => { yearDaysMap[e.crewId] = (yearDaysMap[e.crewId] || 0) + 1; });
  // Calendar days worked (a split day is still one day)
  const totalYearDays = days.filter(d => !d.isOff && d.crewId && d.id.slice(0, 4) === effectiveSummaryYear).length;
  const uniqueDays = crewMap => new Set(Object.values(crewMap).flatMap(st => st.days.map(d => d.id))).size;

  // All crews that have days or earnings in selected year, sorted by days desc
  const allYearCrewIds = [...new Set([...Object.keys(yearDaysMap), ...Object.keys(yearData)])]
    .sort((a, b) => (yearDaysMap[b] || 0) - (yearDaysMap[a] || 0));

  // Avg days/week for the year (exclude current week)
  const yearCompletedWeeks = Object.entries(grouped)
    .filter(([wk]) => wk.slice(0, 4) === effectiveSummaryYear && wk !== currentMondayId);
  const avgDaysPerWeek = yearCompletedWeeks.length > 0
    ? (yearCompletedWeeks.reduce((s, [, cm]) => s + uniqueDays(cm), 0) / yearCompletedWeeks.length)
    : null;

  // Avg $/week — only weeks where every crew entry is paid (exclude current week)
  const fullyPaidWeeks = yearCompletedWeeks.filter(([wk, crewMap]) => {
    const wd = weeksMap[wk] || {};
    return Object.keys(crewMap).every(cid => parsePayEntry(wd[cid]).paid);
  });
  const avgAmtPerWeek = fullyPaidWeeks.length > 0
    ? fullyPaidWeeks.reduce((s, [wk]) => {
        const wd = weeksMap[wk] || {};
        return s + Object.entries(wd).filter(([k]) => k !== 'id').reduce((a, [, v]) => {
          const { paid, amount } = parsePayEntry(v);
          return a + (paid ? amount : 0);
        }, 0);
      }, 0) / fullyPaidWeeks.length
    : null;

  // Days off / weekend work for the year. A day off is any elapsed day with no work
  // logged (marked off or left empty), counted from the first logged day onward.
  // Today only counts once it has an entry.
  const ymdStr = d => { const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const todayStr  = ymdStr(new Date());
  const dayById   = {};
  days.forEach(d => { dayById[d.id] = d; });
  const firstLogged = days.map(d => d.id).sort()[0];
  let offTotal = 0, offWeekdays = 0, weekendWorked = 0;
  if (firstLogged) {
    const from = [`${effectiveSummaryYear}-01-01`, firstLogged].sort()[1];
    const to   = [`${effectiveSummaryYear}-12-31`, todayStr].sort()[0];
    for (const d = new Date(from + 'T12:00:00'); ymdStr(d) <= to; d.setDate(d.getDate() + 1)) {
      const id = ymdStr(d);
      const entry = dayById[id];
      if (id === todayStr && !entry) continue;
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const worked  = entry && !entry.isOff;
      if (!worked) { offTotal++; if (!weekend) offWeekdays++; }
      else if (weekend) weekendWorked++;
    }
  }

  const hasAnyData = days.filter(d => !d.isOff).length > 0 || weeks.length > 0;
  if (!hasAnyData) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: T.muted, fontSize: 13 }}>
        No work days logged yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Yearly earnings summary ── */}
      {availableYears.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Year tabs */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', gap: 6, overflowX: 'auto' }}>
            {availableYears.map(y => (
              <button
                key={y}
                onClick={() => setSummaryYear(y)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, flexShrink: 0,
                  background: effectiveSummaryYear === y ? T.olive : T.subtle,
                  color: effectiveSummaryYear === y ? '#fff' : T.muted,
                  transition: 'background 0.15s',
                }}
              >{y}</button>
            ))}
          </div>

          {/* Crew breakdown */}
          {allYearCrewIds.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: T.muted }}>
              No work days logged for {effectiveSummaryYear} yet.
            </div>
          ) : (
            allYearCrewIds.map(crewId => {
              const crew   = crews.find(c => c.id === crewId);
              const amount = yearData[crewId] || 0;
              const dc     = yearDaysMap[crewId] || 0;
              return (
                <div key={crewId} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {crew?.color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: crew.color }} />}
                    <span style={{ fontSize: 14, color: T.text }}>{crew?.name || 'No crew'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{dc} day{dc !== 1 ? 's' : ''}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: amount > 0 ? T.khaki : T.muted, minWidth: 40, textAlign: 'right' }}>{fmt(amount)}</span>
                  </div>
                </div>
              );
            })
          )}

          {/* Total row */}
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.subtle + '55' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Total {effectiveSummaryYear}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{totalYearDays} days</span>
            </div>
            <span style={{ fontSize: 19, fontWeight: 800, color: T.khaki }}>{fmt(yearTotal)}</span>
          </div>

          {/* Averages row */}
          {(avgDaysPerWeek !== null || avgAmtPerWeek !== null) && (
            <div style={{ padding: '10px 16px', display: 'flex', gap: 10, borderTop: `1px solid ${T.cardBorder}` }}>
              {avgDaysPerWeek !== null && (
                <div style={{ flex: 1, background: T.subtle, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Avg days / week</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{avgDaysPerWeek.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{yearCompletedWeeks.length} wk{yearCompletedWeeks.length !== 1 ? 's' : ''}</div>
                </div>
              )}
              {avgAmtPerWeek !== null && (
                <div style={{ flex: 1, background: T.subtle, borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Avg $ / week</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.khaki }}>{fmt(avgAmtPerWeek)}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{fullyPaidWeeks.length} paid wk{fullyPaidWeeks.length !== 1 ? 's' : ''}</div>
                </div>
              )}
            </div>
          )}

          {/* Days off / weekend work row */}
          {firstLogged && (
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 10, borderTop: avgDaysPerWeek !== null || avgAmtPerWeek !== null ? 'none' : `1px solid ${T.cardBorder}`, paddingTop: avgDaysPerWeek !== null || avgAmtPerWeek !== null ? 0 : 10 }}>
              <div style={{ flex: 1, background: T.subtle, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Days off</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{offTotal}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{offWeekdays} on weekdays</div>
              </div>
              <div style={{ flex: 1, background: T.subtle, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>Weekend work</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{weekendWorked}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>day{weekendWorked !== 1 ? 's' : ''} on Sat/Sun</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Weekly rows: compact list, tap a week for details ── */}
      {sortedWeekIds.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
          {sortedWeekIds.map((mondayId, i) => {
            const crewEntries = grouped[mondayId];
            const weekDoc     = weeksMap[mondayId] || {};
            const isOpen      = openWeeks.has(mondayId);

            let totalW = 0, totalD = 0, totalDays = 0, paidAmt = 0, paidCount = 0;
            const crewIds = Object.keys(crewEntries);
            Object.values(crewEntries).forEach(st => { totalW += st.windows; totalD += st.doors; });
            totalDays = uniqueDays(crewEntries);
            crewIds.forEach(cid => {
              const { paid, amount } = parsePayEntry(weekDoc[cid]);
              if (paid) { paidCount++; paidAmt += amount; }
            });
            const status = paidCount === crewIds.length ? 'paid' : paidCount > 0 ? 'partial' : 'unpaid';
            const statusColor = status === 'paid' ? T.green : status === 'partial' ? T.khaki : '#C9625B'; // muted red

            return (
              <div key={mondayId} style={{ borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
                <button
                  onClick={() => toggleWeek(mondayId)}
                  aria-expanded={isOpen}
                  style={{ width: '100%', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: isOpen ? T.subtle + '55' : 'transparent' }}
                >
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {crewIds.map(cid => {
                      const c = crews.find(x => x.id === cid);
                      return <div key={cid} style={{ width: 7, height: 7, borderRadius: '50%', background: c?.color || T.muted }} />;
                    })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                      {formatWeekRange(mondayId)}
                      {mondayId === currentMondayId && <span style={{ fontSize: 11, color: T.khaki, fontWeight: 500, marginLeft: 6 }}>this week</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>{totalDays}d · {totalW}w · {totalD}dr</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: paidAmt > 0 ? T.khaki : T.muted }}>{fmt(paidAmt)}</div>
                    <div style={{ fontSize: 11, color: statusColor, marginTop: 1 }}>
                      {status === 'paid' ? 'Paid ✓' : status === 'partial' ? 'Partially paid' : 'Unpaid'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: T.muted, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>›</span>
                </button>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${T.cardBorder}`, background: T.bg + '55' }}>
                    {Object.entries(crewEntries).map(([crewId, stats]) => (
                      <WeekCrewRow
                        key={crewId}
                        mondayId={mondayId}
                        crewId={crewId}
                        stats={stats}
                        rawEntry={weekDoc[crewId]}
                        crews={crews}
                        onSetPayment={onSetPayment}
                        isCurrentWeek={mondayId === currentMondayId}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
