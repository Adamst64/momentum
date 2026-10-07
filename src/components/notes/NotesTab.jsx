import React, { useState } from 'react';
import { T } from '../../theme';
import { parseDate } from '../../utils/dateUtils';
import NoteEditor from './NoteEditor';
import NoteViewer from './NoteViewer';


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
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', padding: '12px 13px', borderRadius: 16,
        background: n.color ? n.color + '1F' : T.card, border: `1px solid ${n.color ? n.color + '66' : T.cardBorder}`,
        display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minHeight: 104,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: n.color || T.khaki, fontWeight: 700 }}>
          {parseDate(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: n.title ? T.text : T.muted, lineHeight: 1.3, overflowWrap: 'anywhere',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {n.title || 'Untitled'}
      </div>
      {(n.updatedAt || n.createdAt) && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 'auto' }}>{editedLabel(n.updatedAt || n.createdAt)}</div>
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
  const [viewingId, setViewingId] = useState(null);
  const viewing = viewingId ? notes.find(n => n.id === viewingId) : null; // live copy, so edits show right away
  const [query, setQuery]     = useState('');

  const q = query.trim().toLowerCase();
  const visible = q ? notes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q)) : notes;

  // Group by month, preserving newest-first order
  const groups = [];
  for (const n of visible) {
    const label = monthLabel(n.date);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, notes: [] });
    groups[groups.length - 1].notes.push(n);
  }

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {g.notes.map(n => (
              <NoteCard key={n.id} note={n} onOpen={() => setViewingId(n.id)} />
            ))}
          </div>
        </div>
      ))}

      {viewing && (
        <NoteViewer note={viewing} onEdit={() => setEditing(viewing)} onClose={() => setViewingId(null)} />
      )}

      {editing && (
        <NoteEditor
          initial={editing === 'new' ? null : editing}
          onSave={data => editing === 'new' ? addNote(data) : updateNote(editing.id, data)}
          onDelete={editing === 'new' ? null : async () => { await deleteNote(editing.id); setViewingId(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
