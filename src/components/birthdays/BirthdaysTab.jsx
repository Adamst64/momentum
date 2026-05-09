import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { T } from '../../theme';
import { registerPushToken, getNotificationPermission } from '../../utils/pushNotifications';

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [view, setView]               = useState('list');
  const [permission, setPermission]   = useState(getNotificationPermission());
  const [tokenSaved, setTokenSaved]   = useState(null);
  const [pushError, setPushError]     = useState(null);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      const tokens = snap.data()?.fcmTokens;
      setTokenSaved(Array.isArray(tokens) && tokens.length > 0);
    });
  }, [userId]);

  const sorted = [...birthdays].sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day));

  const handleEnableNotifications = async () => {
    setPushError(null);
    setPushLoading(true);
    try {
      const ok = await registerPushToken(userId);
      setPermission(getNotificationPermission());
      if (ok) {
        setTokenSaved(true);
      } else {
        setPushError('Setup failed. Make sure the app is added to your home screen and notifications are allowed in iPhone Settings → Notifications → Momentum.');
      }
    } catch (e) {
      setPushError(e.message || 'Unknown error.');
    } finally {
      setPushLoading(false);
    }
  };

  const openEdit = (b) => { setEditing(b); setShowForm(true); };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Notification banner */}
      {(permission !== 'granted' || tokenSaved === false) && tokenSaved !== null && (
        <div style={{
          background: '#1A2010', border: `1px solid ${T.olive}44`,
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {permission === 'denied' ? (
            <div style={{ fontSize: 13, color: T.muted }}>
              Notifications are blocked. Enable them in iPhone Settings → Notifications → Momentum, then tap the button below.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>
                {tokenSaved === false && permission === 'granted' ? 'Finish notification setup' : 'Get birthday reminders'}
              </div>
              <div style={{ fontSize: 13, color: T.muted }}>
                You'll be notified at 9:30 PM the day before and at 7 AM on the day of each birthday.
              </div>
              <button
                onClick={handleEnableNotifications}
                disabled={pushLoading}
                style={{
                  alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 10,
                  background: T.olive, color: '#fff', fontSize: 13, fontWeight: 600,
                }}
              >
                {pushLoading ? 'Setting up…' : tokenSaved === false && permission === 'granted' ? 'Complete Setup' : 'Enable Notifications'}
              </button>
              {pushError && (
                <div style={{ fontSize: 12, color: T.red }}>{pushError}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* View toggle */}
      <div style={{
        display: 'flex', background: T.subtle, borderRadius: 10, padding: 3, gap: 2,
      }}>
        {['list', 'calendar'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8,
              background: view === v ? T.card : 'transparent',
              color: view === v ? T.text : T.muted,
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {v === 'list' ? 'Upcoming' : 'Calendar'}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <>
          {birthdays.length === 0 && (
            <div style={{
              background: T.card, border: `1px solid ${T.cardBorder}`,
              borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
            }}>
              No birthdays added yet
            </div>
          )}

          {sorted.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(b => (
                <BirthdayRow
                  key={b.id}
                  birthday={b}
                  days={daysUntil(b.month, b.day)}
                  age={turningAge(b.year, b.month, b.day)}
                  onEdit={() => openEdit(b)}
                  onDelete={() => deleteBirthday(b.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <CalendarView
          birthdays={birthdays}
          onEdit={openEdit}
          onDelete={deleteBirthday}
        />
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

function CalendarView({ birthdays, onEdit, onDelete }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const firstDow   = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay   = today.getMonth() + 1 === month && today.getFullYear() === year ? today.getDate() : null;

  // Map day → birthdays for this month
  const bdMap = {};
  birthdays.forEach(b => {
    if (b.month === month) {
      if (!bdMap[b.day]) bdMap[b.day] = [];
      bdMap[b.day].push(b);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const thisMonthBirthdays = Object.entries(bdMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([, bds]) => bds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
          {MONTH_FULL[month - 1]} {year}
        </span>
        <button onClick={nextMonth} style={{ color: T.muted, fontSize: 24, padding: '4px 10px', lineHeight: 1 }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: T.muted, fontWeight: 600, paddingBottom: 6 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const bds     = bdMap[day] || [];
          const isToday = day === todayDay;
          const hasBd   = bds.length > 0;
          return (
            <div
              key={i}
              style={{
                minHeight: 46, padding: '5px 3px 4px',
                borderRadius: 8, textAlign: 'center',
                background: isToday ? T.khaki + '22' : hasBd ? T.olive + '18' : 'transparent',
                border: `1px solid ${isToday ? T.khaki + '55' : hasBd ? T.olive + '44' : 'transparent'}`,
              }}
            >
              <div style={{
                fontSize: 13, lineHeight: 1,
                color: isToday ? T.khaki : hasBd ? T.oliveLight : T.text,
                fontWeight: isToday || hasBd ? 700 : 400,
              }}>
                {day}
              </div>
              {bds.slice(0, 2).map(b => (
                <div key={b.id} style={{
                  fontSize: 8, color: T.oliveLight, marginTop: 3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}>
                  {b.name.split(' ')[0]}
                </div>
              ))}
              {bds.length > 2 && (
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>+{bds.length - 2}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* This month's birthdays list */}
      {thisMonthBirthdays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            This month
          </div>
          {thisMonthBirthdays.map(b => (
            <BirthdayRow
              key={b.id}
              birthday={b}
              days={daysUntil(b.month, b.day)}
              age={turningAge(b.year, b.month, b.day)}
              onEdit={() => onEdit(b)}
              onDelete={() => onDelete(b.id)}
            />
          ))}
        </div>
      )}

      {thisMonthBirthdays.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 12, padding: '20px 16px', textAlign: 'center',
          color: T.muted, fontSize: 13,
        }}>
          No birthdays in {MONTH_FULL[month - 1]}
        </div>
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
