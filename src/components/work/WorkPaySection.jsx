import React from 'react';
import { T } from '../../theme';
import { getMondayId, formatWeekRange } from '../../utils/workUtils';

export default function WorkPaySection({ days, weeks, crews, onSetPaid }) {
  if (days.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: T.muted, fontSize: 13 }}>
        No work days logged yet
      </div>
    );
  }

  // Group: weekId → crewId → { days[], windows, doors }
  const grouped = {};
  days.forEach(day => {
    const wk  = getMondayId(day.id);
    const cid = day.crewId || '__none__';
    if (!grouped[wk]) grouped[wk] = {};
    if (!grouped[wk][cid]) grouped[wk][cid] = { days: [], windows: 0, doors: 0 };
    grouped[wk][cid].days.push(day);
    grouped[wk][cid].windows += day.windows || 0;
    grouped[wk][cid].doors   += day.doors   || 0;
  });

  const weeksMap = {};
  weeks.forEach(w => { weeksMap[w.id] = w; });

  const sortedWeekIds = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sortedWeekIds.map(mondayId => {
        const crewEntries = grouped[mondayId];
        const weekDoc     = weeksMap[mondayId] || {};

        // Week totals
        let totalW = 0, totalD = 0, totalDays = 0;
        Object.values(crewEntries).forEach(s => { totalW += s.windows; totalD += s.doors; totalDays += s.days.length; });

        return (
          <div key={mondayId} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Week header */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{formatWeekRange(mondayId)}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{totalDays}d · {totalW}w · {totalD}dr</span>
            </div>

            {/* Crew rows */}
            {Object.entries(crewEntries).map(([crewId, stats]) => {
              const crew     = crews.find(c => c.id === crewId);
              const crewName = crew ? crew.name : 'No crew';
              const paid     = weekDoc[crewId] === true;
              const dc       = stats.days.length;

              return (
                <div key={crewId} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.cardBorder}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{crewName}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                      {dc} day{dc !== 1 ? 's' : ''} · {stats.windows} win · {stats.doors} doors
                    </div>
                  </div>
                  <button
                    onClick={() => onSetPaid(mondayId, crewId, !paid)}
                    style={{
                      padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: paid ? T.green + '22' : T.subtle,
                      color: paid ? T.green : T.muted,
                      border: `1px solid ${paid ? T.green + '44' : T.cardBorder}`,
                      flexShrink: 0,
                    }}
                  >{paid ? 'Paid ✓' : 'Mark Paid'}</button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
