import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { todayStr, DAYS_SHORT } from '../../utils/dateUtils';
import { useLongPress } from '../../hooks/useLongPress';
import { commitmentStats, streakLabel } from '../../utils/commitments';
import CommitmentCalendarModal from './CommitmentCalendarModal';
import { SlipSheet, ConfirmSheet } from './CommitmentSheets';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon first

function NameSheet({ initial = '', initialDays = null, title, onSave, onClose, showLastFailed = false }) {
  const [name, setName]             = useState(initial);
  const [lastFailed, setLastFailed] = useState('');
  const [days, setDays]             = useState(initialDays || ALL_DAYS);
  const ready = name.trim() && days.length > 0;
  const save = () => {
    if (!ready) return;
    onSave(name.trim(), lastFailed || null, days.length === 7 ? null : [...days].sort());
    onClose();
  };
  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
    background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
    color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
  };
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, margin: '0 auto', boxSizing: 'border-box', background: '#1C1C1E', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16 }}>{title}</div>

        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          placeholder='e.g. "No smoking"'
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Applies on</div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
          {WEEK_ORDER.map(d => {
            const on = days.includes(d);
            return (
              <button key={d} onClick={() => setDays(ds => on ? ds.filter(x => x !== d) : [...ds, d])} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: on ? '#1A3A1A' : T.subtle, color: on ? T.green : T.muted,
              }}>{DAYS_SHORT[d]}</button>
            );
          })}
        </div>

        {showLastFailed && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
              Last time you failed <span style={{ color: T.subtle }}>(optional — sets your starting streak)</span>
            </div>
            <input
              type="date"
              value={lastFailed}
              max={todayStr()}
              onChange={e => setLastFailed(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        <button
          onClick={save}
          disabled={!ready}
          style={{
            width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: ready ? '#1A3A1A' : T.subtle,
            color: ready ? T.green : T.muted,
          }}
        >
          {initial ? 'Save' : 'Add'}
        </button>
      </div>
    </div>,
    document.body
  );
}

// Tap the card for history; "I slipped" (with a confirm) is the only way to mark a failure
function CommitmentItem({ commitment, today, onSlip, onUndo, onEdit, onDelete, onShowCalendar }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPress(() => setShowMenu(true));
  const s = commitmentStats(commitment, today);
  const failed = s.failedToday;
  const todayNote = commitment.failureNotes?.[today];

  let status;
  if (failed) status = todayNote ? `Slipped today · ${todayNote}` : 'Slipped today';
  else if (!s.scheduledToday) status = 'Rest day';
  else status = 'Today in progress';

  return (
    <>
      <div
        ref={longPressRef}
        onClick={() => !showMenu && onShowCalendar(commitment)}
        style={{
          borderRadius: 14, padding: '14px 16px',
          background: failed ? '#1F0D0D' : '#0D1A0D',
          border: `1px solid ${failed ? '#4A2020' : '#1A3A1A'}`,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {commitment.name}
            </div>
            <div style={{ fontSize: 12, marginTop: 3, color: failed ? T.red : T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: failed ? T.red : T.green, lineHeight: 1 }}>{s.current}</div>
            <div style={{ fontSize: 9, color: failed ? T.red : T.green, opacity: 0.7, marginTop: 2, letterSpacing: 0.5 }}>
              DAYS · BEST {s.best}
            </div>
          </div>
        </div>

        {s.newBadge && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: '#1E2A12', color: T.khaki, fontSize: 13, fontWeight: 600 }}>
            🎉 New badge: {s.newBadge.icon} {s.newBadge.label} clean!
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, fontSize: 12, color: T.muted }}>
            {s.next && !failed ? `${s.toNext} day${s.toNext === 1 ? '' : 's'} to ${s.next.icon} ${s.next.label}` : ''}
          </div>
          {failed ? (
            <button onClick={e => { e.stopPropagation(); onUndo(commitment.id); }} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: T.subtle, color: T.text,
            }}>Undo slip</button>
          ) : s.scheduledToday && (
            <button onClick={e => { e.stopPropagation(); onSlip(commitment, s.current); }} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'transparent', border: `1px solid ${T.red}66`, color: T.red,
            }}>I slipped</button>
          )}
        </div>
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
            onClick={() => { onDelete(commitment, s); setShowMenu(false); }}
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
  const { commitments, addCommitment, updateCommitment, deleteCommitment, markSlip, clearSlip } = hook;
  const [showAdd, setShowAdd]               = useState(false);
  const [editing, setEditing]               = useState(null);
  const [slipping, setSlipping]             = useState(null); // { commitment, streak }
  const [deleting, setDeleting]             = useState(null); // { commitment, stats }
  const [calendarItemId, setCalendarItemId] = useState(null);
  const calendarItem = commitments.find(c => c.id === calendarItemId) ?? null;
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
          Track things you commit to — every day counts as clean unless you mark a slip
        </div>
      )}

      {sorted.map(c => (
        <CommitmentItem
          key={c.id}
          commitment={c}
          today={today}
          onSlip={(commitment, streak) => setSlipping({ commitment, streak })}
          onUndo={id => clearSlip(id, today)}
          onEdit={setEditing}
          onDelete={(commitment, stats) => setDeleting({ commitment, stats })}
          onShowCalendar={c => setCalendarItemId(c.id)}
        />
      ))}

      {showAdd && (
        <NameSheet
          title="New Commitment"
          onSave={(name, lastFailed, days) => addCommitment(name, lastFailed, days)}
          onClose={() => setShowAdd(false)}
          showLastFailed
        />
      )}
      {editing && (
        <NameSheet
          title="Edit Commitment"
          initial={editing.name}
          initialDays={editing.days}
          onSave={(name, _lastFailed, days) => updateCommitment(editing.id, name, days)}
          onClose={() => setEditing(null)}
        />
      )}
      {slipping && (
        <SlipSheet
          name={slipping.commitment.name}
          dateLabel="Today"
          streak={slipping.streak}
          onConfirm={note => markSlip(slipping.commitment.id, today, note)}
          onClose={() => setSlipping(null)}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title={`Delete “${deleting.commitment.name}”?`}
          message={`This removes it with all its history: your ${streakLabel(deleting.stats.current)} streak, best streak of ${deleting.stats.best} and ${deleting.stats.slips.length} recorded slip${deleting.stats.slips.length === 1 ? '' : 's'}. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => deleteCommitment(deleting.commitment.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      {calendarItem && (
        <CommitmentCalendarModal
          commitment={calendarItem}
          onMarkSlip={markSlip}
          onClearSlip={clearSlip}
          onClose={() => setCalendarItemId(null)}
        />
      )}
    </div>
  );
}
