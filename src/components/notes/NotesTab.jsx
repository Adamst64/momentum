import React, { useState } from 'react';
import { T } from '../../theme';
import { parseDate } from '../../utils/dateUtils';
import NoteEditor, { MOODS } from './NoteEditor';

const moodEmoji = (v) => MOODS.find(m => m.value === v)?.emoji;

// Light tint per mood so the grid reads at a glance
const MOOD_TINT = { 1: '#D0675F', 2: '#E5A44B', 3: null, 4: '#A9BB6C', 5: '#4FCB66' };

function editedLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Edited today, ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Edited yesterday, ${time}`;
  return `Edited ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}, ${time}`;
}

function NoteCard({ note: n, onOpen }) {
  const tint = MOOD_TINT[n.mood];
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', padding: '12px 13px', borderRadius: 16,
        background: tint ? tint + '14' : T.card, border: `1px solid ${tint ? tint + '40' : T.cardBorder}`,
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: T.khaki, fontWeight: 700 }}>
          {parseDate(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        {n.mood && <span style={{ fontSize: 16 }}>{moodEmoji(n.mood)}</span>}
      </div>
      <div style={{
        fontSize: 14, color: T.text, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {n.text}
      </div>
      {(n.updatedAt || n.createdAt) && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{editedLabel(n.updatedAt || n.createdAt)}</div>
      )}
    </button>
  );
}

function monthLabel(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function NotesTab({ hook }) {
  const { notes, addNote, updateNote, deleteNote } = hook;
  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [query, setQuery]     = useState('');

  const q = query.trim().toLowerCase();
  const visible = q ? notes.filter(n => n.text.toLowerCase().includes(q)) : notes;

  // Group by month, preserving newest-first order
  const groups = [];
  for (const n of visible) {
    const label = monthLabel(n.date);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, notes: [] });
    groups[groups.length - 1].notes.push(n);
  }

  // Average mood over the last 30 entries that have one
  const moods = notes.filter(n => n.mood).slice(0, 30).map(n => n.mood);
  const avgMood = moods.length ? Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) : null;

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        onClick={() => setEditing('new')}
        style={{
          padding: 14, borderRadius: 14, background: T.olive,
          color: '#fff', fontSize: 15, fontWeight: 600,
        }}
      >
        + New entry
      </button>

      {notes.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entries…"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              background: T.card, border: `1px solid ${T.cardBorder}`,
              color: T.text, fontSize: 15, outline: 'none',
            }}
          />
          {avgMood && (
            <div title="Average mood, last 30 entries" style={{
              padding: '8px 12px', borderRadius: 10, background: T.card,
              border: `1px solid ${T.cardBorder}`, fontSize: 13, color: T.muted,
            }}>
              avg {moodEmoji(avgMood)}
            </div>
          )}
        </div>
      )}

      {notes.length === 0 && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '40px 20px', lineHeight: 1.5 }}>
          No entries yet.<br />Jot down a thought, or how today went.
        </div>
      )}

      {notes.length > 0 && visible.length === 0 && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: 20 }}>
          Nothing matches “{query.trim()}”.
        </div>
      )}

      {groups.map(g => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {g.label}
          </div>
          {/* Two columns, filled alternately so newest stay at the top of both */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {[0, 1].map(col => (
              <div key={col} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.notes.filter((_, i) => i % 2 === col).map(n => (
                  <NoteCard key={n.id} note={n} onOpen={() => setEditing(n)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <NoteEditor
          initial={editing === 'new' ? null : editing}
          onSave={data => editing === 'new' ? addNote(data) : updateNote(editing.id, data)}
          onDelete={editing === 'new' ? null : () => deleteNote(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
