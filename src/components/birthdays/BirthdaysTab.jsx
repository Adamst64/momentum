import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { T } from '../../theme';
import { registerPushToken, getNotificationPermission } from '../../utils/pushNotifications';
import BirthdayRow from './BirthdayRow';
import BirthdayForm from './BirthdayForm';
import BirthdayCalendar from './BirthdayCalendar';

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
              {pushError && <div style={{ fontSize: 12, color: T.red }}>{pushError}</div>}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', background: T.subtle, borderRadius: 10, padding: 3, gap: 2 }}>
        {['list', 'calendar'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8,
            background: view === v ? T.card : 'transparent',
            color: view === v ? T.text : T.muted,
            fontSize: 13, fontWeight: 600, transition: 'background 0.15s, color 0.15s',
          }}>
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
                  key={b.id} birthday={b}
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
        <BirthdayCalendar birthdays={birthdays} onEdit={openEdit} onDelete={deleteBirthday} />
      )}

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
