import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { todayStr, formatShortDate } from '../../utils/dateUtils';

function RescheduleSheet({ task, onReschedule, onClose }) {
  const [date, setDate] = useState(todayStr());
  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: '#1C1C1E', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16 }}>Reschedule "{task.name}"</div>
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={e => setDate(e.target.value)}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 16, outline: 'none', colorScheme: 'dark', marginBottom: 16,
          }}
        />
        <button
          onClick={() => { onReschedule(task.id, date); onClose(); }}
          style={{ width: '100%', padding: 14, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          Set Date
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function TaskItem({ task, onComplete, onDelete, onReschedule, onEdit, section, missed }) {
  const [showMenu, setShowMenu]             = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const isDone    = section === 'done';
  const isBacklog = section === 'backlog';

  const subtitle = (() => {
    if (task.type === 'recurring-monthly') return `Every ${task.dayOfMonth}${ord(task.dayOfMonth)} of the month`;
    if (missed && task.date) return `Missed · ${formatShortDate(task.date)}`;
    if (task.type === 'one-time' && task.date) return formatShortDate(task.date);
    if (task.missedLabel) return `Missed: ${task.missedLabel}`;
    return null;
  })();

  const showMissedDot = missed || task.missedDot;

  return (
    <>
      <div style={{
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: isDone ? 0.6 : 1,
      }}>
        {/* Checkbox / dot */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28 }}>
          {isDone ? (
            <div style={{ width: 22, height: 22, borderRadius: 6, background: T.olive, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <button
              onClick={() => !isDone && onComplete(task.id)}
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${T.muted}`, background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {showMissedDot && (
                <div style={{
                  position: 'absolute', top: -3, right: -3,
                  width: 8, height: 8, borderRadius: '50%',
                  background: T.red, border: `1px solid ${T.card}`,
                }} />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, color: T.text, fontWeight: 500,
            textDecoration: isDone ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {task.name}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>

        {/* Type badge */}
        {task.type === 'recurring-monthly' && !isDone && (
          <div style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: '#2A3A1A', color: T.oliveLight, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
          }}>
            Monthly
          </div>
        )}

        {/* Actions menu */}
        {!isDone && (
          <button
            onClick={() => setShowMenu(m => !m)}
            style={{ color: T.muted, fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0 }}
          >
            ···
          </button>
        )}
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button
            onClick={() => { onEdit(task); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >
            Edit
          </button>
          {isBacklog && (
            <button
              onClick={() => { setShowReschedule(true); setShowMenu(false); }}
              style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.khaki, borderBottom: `1px solid ${T.cardBorder}` }}
            >
              Reschedule
            </button>
          )}
          <button
            onClick={() => { onComplete(task.id); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.green, borderBottom: `1px solid ${T.cardBorder}` }}
          >
            Mark done
          </button>
          <button
            onClick={() => { onDelete(task.id); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red }}
          >
            Delete
          </button>
        </div>
      )}

      {showReschedule && (
        <RescheduleSheet
          task={task}
          onReschedule={onReschedule}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </>
  );
}

function ord(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}
