import React from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { formatLongDate, todayStr } from '../../utils/dateUtils';
import { getCompletionCount, getRequiredForDate } from '../../hooks/useRoutines';

export default function DayDetailModal({ dateStr, forDate, incrementDay, onClose }) {
  const today = todayStr();
  const isFuture = dateStr > today;
  const routinesForDay = forDate(dateStr);

  return (
    <Modal title={formatLongDate(dateStr)} onClose={onClose}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {isFuture ? 'Planned' : dateStr === today ? "Today's progress" : 'Progress'}
      </div>

      {routinesForDay.length === 0 ? (
        <div style={{ color: T.muted, fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
          Nothing scheduled
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {routinesForDay.map(r => {
            const required = getRequiredForDate(r, dateStr);
            const count    = getCompletionCount(r, dateStr);
            const done     = count >= required;
            const partial  = count > 0 && !done;
            return (
              <div
                key={r.id}
                onClick={isFuture ? undefined : () => incrementDay(r.id, dateStr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: T.bg,
                  borderRadius: 12,
                  border: `1px solid ${isFuture ? T.cardBorder : done ? T.olive + '50' : partial ? '#FF9F0A40' : T.cardBorder}`,
                  cursor: isFuture ? 'default' : 'pointer',
                  opacity: isFuture ? 0.65 : 1,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${done ? T.oliveLight : partial ? '#FF9F0A' : T.subtle}`,
                  background: done ? T.olive + '25' : partial ? '#FF9F0A20' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {!isFuture && done && (
                    <span style={{ fontSize: 12, color: T.oliveLight }}>✓</span>
                  )}
                </div>
                <span style={{ fontSize: 15, color: T.text, flex: 1 }}>{r.name}</span>
                {!isFuture && (
                  <span style={{ fontSize: 12, color: done ? T.oliveLight : partial ? '#FF9F0A' : T.muted }}>
                    {required > 1 ? `${count}/${required}` : done ? 'Done' : 'Missed'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isFuture && routinesForDay.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: T.muted, textAlign: 'center' }}>
          Tap a routine to increment
        </div>
      )}
    </Modal>
  );
}
