import React, { useState } from 'react';
import { T } from '../../theme';
import { getMondayId, formatWeekRange, parsePayEntry } from '../../utils/workUtils';

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

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {crew?.color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: crew.color, flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{crew?.name || 'No crew'}</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {dc} day{dc !== 1 ? 's' : ''} · {stats.windows} win · {stats.doors} doors
          </div>
        </div>
        <button
          onClick={() => save(!paid)}
          style={{
            padding: '6px 13px', borderRadius: 10, fontSize: 13, fontWeight: 600, flexShrink: 0,
            background: paid ? T.green + '22' : T.subtle,
            color: paid ? T.green : T.muted,
            border: `1px solid ${paid ? T.green + '44' : T.cardBorder}`,
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

  const weeksMap = {};
  weeks.forEach(w => { weeksMap[w.id] = w; });

  // Group work days (exclude off) by week → crew
  const grouped = {};
  days.filter(d => !d.isOff).forEach(day => {
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
  days.filter(d => !d.isOff && d.crewId && d.id.slice(0, 4) === effectiveSummaryYear)
    .forEach(d => { yearDaysMap[d.crewId] = (yearDaysMap[d.crewId] || 0) + 1; });
  const totalYearDays = Object.values(yearDaysMap).reduce((s, v) => s + v, 0);

  // All crews that have days or earnings in selected year, sorted by days desc
  const allYearCrewIds = [...new Set([...Object.keys(yearDaysMap), ...Object.keys(yearData)])]
    .sort((a, b) => (yearDaysMap[b] || 0) - (yearDaysMap[a] || 0));

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
        </div>
      )}

      {/* ── Weekly rows ── */}
      {sortedWeekIds.map(mondayId => {
        const crewEntries = grouped[mondayId];
        const weekDoc     = weeksMap[mondayId] || {};

        let totalW = 0, totalD = 0, totalDays = 0;
        Object.values(crewEntries).forEach(s => { totalW += s.windows; totalD += s.doors; totalDays += s.days.length; });

        return (
          <div key={mondayId} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{formatWeekRange(mondayId)}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{totalDays}d · {totalW}w · {totalD}dr</span>
            </div>
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
        );
      })}
    </div>
  );
}
