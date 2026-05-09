import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { registerPushToken, getNotificationPermission } from '../../utils/pushNotifications';

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysUntil(month, day) {
  const today     = new Date();
  const todayFlat = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let   next      = new Date(today.getFullYear(), month - 1, day);
  if (next < todayFlat) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next - todayFlat) / 864e5);
}

function turningAge(birthYear, month, day) {
  if (!birthYear) return null;
  const today     = new Date();
  const todayFlat = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let   next      = new Date(today.getFullYear(), month - 1, day);
  if (next < todayFlat) next = new Date(today.getFullYear() + 1, month - 1, day);
  return next.getFullYear() - birthYear;
}

export default function BirthdaysTab({ hook, userId }) {
  const { birthdays, addBirthday, updateBirthday, deleteBirthday } = hook;
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [permission, setPermission] = useState(getNotificationPermission());

  const sorted = [...birthdays].sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day));

  const handleEnableNotifications = async () => {
    await registerPushToken(userId);
    setPermission(getNotificationPermission());
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Notification permission banner */}
      {permission !== 'granted' && (
        <div style={{
          background: '#1A2010', border: `1px solid ${T.olive}44`,
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {permission === 'denied' ? (
            <div style={{ fontSize: 13, color: T.muted }}>
              Notifications are blocked. To get birthday reminders, enable them in your device Settings → Notifications → Momentum.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>Get birthday reminders</div>
              <div style={{ fontSize: 13, color: T.muted }}>
                You'll be notified the day before and on the day of each birthday.
              </div>
              <button
                onClick={handleEnableNotifications}
                style={{
                  alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 10,
                  background: T.olive, color: '#fff', fontSize: 13, fontWeight: 600,
                }}
              >
                Enable Notifications
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {birthdays.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
        }}>
          No birthdays added yet
        </div>
      )}

      {/* Birthday list */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(b => (
            <BirthdayRow
              key={b.id}
              birthday={b}
              days={daysUntil(b.month, b.day)}
              age={turningAge(b.year, b.month, b.day)}
              onEdit={() => { setEditing(b); setShowForm(true); }}
              onDelete={() => deleteBirthday(b.id)}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => { setEditing(null); setShowForm(true); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 14, borderRadius: 14,
          border: `1.5px dashed ${T.cardBorder}`,
          color: T.muted, fontSize: 15, background: 'transparent',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Birthday
      </button>

      {showForm && (
        <BirthdayForm
          initial={editing}
          onSave={(name, month, day, year) => {
            if (editing) updateBirthday(editing.id, name, month, day, year);
            else addBirthday(name, month, day, year);
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function BirthdayRow({ birthday, days, age, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  const isToday  = days === 0;
  const isSoon   = days <= 7;
  const accent   = isToday ? T.khaki : isSoon ? T.oliveLight : T.muted;
  const dayLabel = isToday ? 'Today 🎂' : days === 1 ? 'Tomorrow' : `In ${days} days`;

  return (
    <>
      <div style={{
        background: isToday ? '#2A2010' : T.card,
        border: `1px solid ${isToday ? T.khaki + '55' : T.cardBorder}`,
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* Date badge */}
        <div style={{
          width: 42, flexShrink: 0, textAlign: 'center',
          background: isToday ? T.khaki + '22' : T.bg,
          borderRadius: 8, padding: '5px 2px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {MONTHS[birthday.month - 1]}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: isToday ? T.khaki : T.text, lineHeight: 1.1 }}>
            {birthday.day}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {birthday.name}
          </div>
          <div style={{ fontSize: 12, color: accent, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{dayLabel}</span>
            {age && <span style={{ color: T.subtle }}>·</span>}
            {age && <span style={{ color: T.muted }}>turning {age}</span>}
          </div>
        </div>

        <button
          onClick={() => setShowMenu(m => !m)}
          style={{ color: T.muted, fontSize: 18, padding: '4px 6px', lineHeight: 1, flexShrink: 0 }}
        >···</button>
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button
            onClick={() => { onEdit(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >Edit</button>
          <button
            onClick={() => { onDelete(); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red }}
          >Delete</button>
        </div>
      )}
    </>
  );
}

function BirthdayForm({ initial, onSave, onClose }) {
  const [name,  setName]  = useState(initial?.name  || '');
  const [month, setMonth] = useState(initial?.month || 1);
  const [day,   setDay]   = useState(initial?.day   || 1);
  const [year,  setYear]  = useState(initial?.year  ? String(initial.year) : '');

  const maxDay = MONTH_DAYS[month - 1];
  const clampedDay = Math.min(day, maxDay);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), Number(month), clampedDay, year ? Number(year) : null);
    onClose();
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
            {initial ? 'Edit Birthday' : 'Add Birthday'}
          </span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 22, padding: '2px 6px' }}>×</button>
        </div>

        <input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none',
          }}
        />

        {/* Month + Day */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{
              flex: 2, padding: '12px 10px', borderRadius: 10,
              background: T.bg, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
            }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>

          <select
            value={clampedDay}
            onChange={e => setDay(Number(e.target.value))}
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 10,
              background: T.bg, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
            }}
          >
            {Array.from({ length: maxDay }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>

        {/* Optional year */}
        <input
          placeholder="Birth year (optional — shows age)"
          value={year}
          onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: 10,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 15, outline: 'none',
          }}
        />

        <button
          onClick={handleSave}
          disabled={!name.trim()}
          style={{
            padding: 14, borderRadius: 12, marginTop: 2,
            background: name.trim() ? T.olive : T.subtle,
            color: '#fff', fontSize: 15, fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          {initial ? 'Save Changes' : 'Add Birthday'}
        </button>
      </div>
    </div>,
    document.body
  );
}
