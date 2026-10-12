import React, { useState } from 'react';
import { T } from '../../theme';
import { formatWeekRange } from '../../utils/workUtils';
import { previousMondayId, crewWeekEntries, buildWeekText, smsHref } from '../../utils/workText';

// Last week's summary for each crew that has a text number (Friday to Sunday). "Text it" opens
// Messages with the number and summary filled in; you tap send.
export default function WeeklyTexts({ days, crews, today, onTexted }) {
  const [preview, setPreview] = useState(null);
  const mondayId = previousMondayId(today);
  // Shown Friday through Sunday, when last week's summary goes out
  const dow = new Date(today + 'T12:00:00').getDay();
  const sendingDays = dow === 5 || dow === 6 || dow === 0;

  const rows = crews
    .filter(c => c.phone)
    .map(c => ({ crew: c, entries: crewWeekEntries(days, c.id, mondayId) }))
    .filter(r => r.entries.length > 0);
  if (!sendingDays || !rows.length) return null;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.khaki, textTransform: 'uppercase', letterSpacing: 0.6 }}>Weekly texts</span>
        <span style={{ fontSize: 12, color: T.muted }}>Last week · {formatWeekRange(mondayId)}</span>
      </div>

      {rows.map(({ crew, entries }, i) => {
        const text = buildWeekText(crew, entries, mondayId);
        const sent = crew.lastTextedWeek === mondayId;
        const open = preview === crew.id;
        return (
          <div key={crew.id} style={{ borderTop: i ? `1px solid ${T.cardBorder}` : 'none', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: crew.color || T.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{crew.name}</div>
                <div style={{ fontSize: 11, color: sent ? T.green : T.muted }}>
                  {entries.length} day{entries.length === 1 ? '' : 's'} · {sent ? 'Opened in Messages ✓' : crew.phone}
                </div>
              </div>
              <button onClick={() => setPreview(open ? null : crew.id)} style={{ fontSize: 12, color: T.muted, padding: '6px 8px' }}>
                {open ? 'Hide' : 'Preview'}
              </button>
              <a
                href={smsHref(crew.phone, text)}
                onClick={() => onTexted(crew.id, mondayId)}
                style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  background: sent ? T.subtle : T.olive, color: sent ? T.text : '#fff',
                }}
              >{sent ? 'Text again' : 'Text it'}</a>
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
