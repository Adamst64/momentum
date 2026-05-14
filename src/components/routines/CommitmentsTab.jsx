import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';
import { useLongPress } from '../../hooks/useLongPress';
import CommitmentCalendarModal from './CommitmentCalendarModal';

function getStreak(commitment, today) {
  let streak = 0;
  let d = today;
  const created = commitment.createdAt || '2000-01-01';
  while (d >= created) {
    if (commitment.failures?.[d]) break;
    streak++;
    const dt = new Date(d + 'T12:00:00');
    dt.setDate(dt.getDate() - 1);
    d = dt.toISOString().slice(0, 10);
  }
  return streak;
}

function NameSheet({ initial = '', title, onSave, onClose }) {
  const [name, setName] = useState(initial);
  const canSave = name.trim() && name.trim() !== initial;
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1C1C1E', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16 }}>{title}</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); onClose(); } }}
          placeholder='e.g. "No smoking"'
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
            background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
            color: T.text, fontSize: 16, outline: 'none', marginBottom: 16,
          }}
        />
        <button
          onClick={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }}
          disabled={!name.trim()}
          style={{
            width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: name.trim() ? '#1A3A1A' : T.subtle,
            color: name.trim() ? T.green : T.muted,
          }}
        >
          {initial ? 'Save' : 'Add'}
        </button>
      </div>
    </div>,
    document.body
  );
}

function CommitmentItem({ commitment, today, onToggleFailed, onEdit, onDelete, onShowCalendar }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const failedToday = !!commitment.failures?.[today];
  const streak = getStreak(commitment, today);

  return (
    <>
      <div
        ref={longPressRef}
        onClick={() => !showMenu && onToggleFailed(commitment.id, today)}
        style={{
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          background: failedToday ? '#1F0D0D' : '#0D1A0D',
          border: `1px solid ${failedToday ? '#4A2020' : '#1A3A1A'}`,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: failedToday ? T.red + '22' : T.green + '22',
          border: `2px solid ${failedToday ? T.red : T.green}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, color: failedToday ? T.red : T.green,
          fontWeight: 700,
        }}>
          {failedToday ? '✕' : '✓'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {commitment.name}
          </div>
          <div style={{ fontSize: 12, marginTop: 2, color: failedToday ? T.red : T.green, opacity: 0.85 }}>
            {failedToday
              ? 'Failed today · tap to undo'
              : streak <= 1 ? '1 day clean' : `${streak} days clean`}
          </div>
        </div>

        {!failedToday && (
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.green, lineHeight: 1 }}>{streak}</div>
            <div style={{ fontSize: 9, color: T.green, opacity: 0.6, marginTop: 1, letterSpacing: 0.5 }}>DAYS</div>
          </div>
        )}
      </div>

      {showMenu && (
        <div style={{
          background: '#252527', border: `1px solid ${T.cardBorder}`,
          borderRadius: 10, overflow: 'hidden', marginTop: -6,
        }}>
          <button
            onClick={() => { onShowCalendar(commitment); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >View History</button>
          <button
            onClick={() => { onEdit(commitment); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.text, borderBottom: `1px solid ${T.cardBorder}` }}
          >Edit</button>
          <button
            onClick={() => { onDelete(commitment.id); setShowMenu(false); }}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.red, borderBottom: `1px solid ${T.cardBorder}` }}
          >Delete</button>
          <button
            onClick={() => setShowMenu(false)}
            style={{ width: '100%', padding: '11px 14px', textAlign: 'left', fontSize: 14, color: T.muted }}
          >Cancel</button>
        </div>
      )}
    </>
  );
}

export default function CommitmentsTab({ hook }) {
  const { commitments, addCommitment, updateCommitment, deleteCommitment, toggleFailed } = hook;
  const [showAdd, setShowAdd]           = useState(false);
  const [editing, setEditing]           = useState(null);
  const [calendarItem, setCalendarItem] = useState(null);
  const today = todayStr();

  const sorted = [...commitments].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" onClick={() => setShowAdd(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 14, borderRadius: 14,
        border: `1.5px dashed ${T.cardBorder}`,
        color: T.muted, fontSize: 15, background: 'transparent',
      }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Commitment
      </button>

      {sorted.length === 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: '28px 16px', textAlign: 'center',
          color: T.muted, fontSize: 14,
        }}>
          Track things you commit to doing every day — green by default, tap to mark a failure
        </div>
      )}

      {sorted.map(c => (
        <CommitmentItem
          key={c.id}
          commitment={c}
          today={today}
          onToggleFailed={toggleFailed}
          onEdit={setEditing}
          onDelete={deleteCommitment}
          onShowCalendar={setCalendarItem}
        />
      ))}

      {showAdd && (
        <NameSheet title="New Commitment" onSave={addCommitment} onClose={() => setShowAdd(false)} />
      )}
      {editing && (
        <NameSheet
          title="Edit Commitment"
          initial={editing.name}
          onSave={name => updateCommitment(editing.id, name)}
          onClose={() => setEditing(null)}
        />
      )}

      {calendarItem && (
        <CommitmentCalendarModal
          commitment={calendarItem}
          onClose={() => setCalendarItem(null)}
        />
      )}
    </div>
  );
}
