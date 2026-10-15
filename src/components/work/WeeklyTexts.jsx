import React, { useState } from 'react';
import { T } from '../../theme';
import { formatWeekRange, parsePayEntry } from '../../utils/workUtils';
import { previousMondayId, crewWeekEntries, crewWeekTrips, buildWeekText, smsHref } from '../../utils/workText';

// Summaries for finished weeks, for each crew that has a text number. A week shows
// from the Monday after it ends until that crew is marked paid for it (the last
// two finished weeks are checked, so a late payment doesn't hide it). "Text it"
// opens Messages with the number and summary filled in; you tap send.
export default function WeeklyTexts({ days, crews, members, weeks, today, onTexted }) {
  const [preview, setPreview] = useState(null);
  const lastWeek   = previousMondayId(today);
  const weekBefore = previousMondayId(lastWeek);
  const weekDoc = id => weeks.find(w => w.id === id) || {};

  // A crew-week stays until its work is marked paid and every trip-only day in it
  // is settled (paid or not paid)
  const rows = [lastWeek, weekBefore].flatMap(mondayId => crews
    .filter(c => c.phone)
    .map(c => ({ crew: c, mondayId, entries: crewWeekEntries(days, c.id, mondayId), trips: crewWeekTrips(days, c.id, mondayId) }))
    .filter(r => (r.entries.length > 0 && !parsePayEntry(weekDoc(r.mondayId)[r.crew.id]).paid)
              || r.trips.some(t => !t.status)));
  if (!rows.length) return null;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.khaki, textTransform: 'uppercase', letterSpacing: 0.6 }}>Weekly texts</span>
        <span style={{ fontSize: 11, color: T.muted }}>Hides once the week is paid and trips settled</span>
      </div>

      {rows.map(({ crew, mondayId, entries, trips }, i) => {
        const key = crew.id + mondayId;
        const text = buildWeekText(crew, entries, mondayId, members, trips);
        const sent = crew.lastTextedWeek === mondayId;
        const open = preview === key;
        return (
          <div key={key} style={{ borderTop: i ? `1px solid ${T.cardBorder}` : 'none', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: crew.color || T.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{crew.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {formatWeekRange(mondayId)} · {entries.length} day{entries.length === 1 ? '' : 's'}
                  {trips.length > 0 && ` · ${trips.length} trip only`}
                </div>
                {sent && <div style={{ fontSize: 11, color: T.green }}>Opened in Messages ✓</div>}
              </div>
              <button onClick={() => setPreview(open ? null : key)} style={{ fontSize: 12, color: T.muted, padding: '6px 8px' }}>
                {open ? 'Hide' : 'Preview'}
              </button>
              <a
                href={smsHref(crew.phone, text)}
                onClick={() => onTexted(crew.id, mondayId)}
                style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
                  background: T.olive, color: '#fff',
                }}
              >Text it</a>
            </div>
            {open && (
              <pre style={{
                margin: '8px 0 0', padding: '10px 12px', borderRadius: 10, background: T.bg, border: `1px solid ${T.cardBorder}`,
                color: T.text, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', fontFamily: 'inherit',
              }}>{text}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
