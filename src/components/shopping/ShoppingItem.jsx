import React, { useState, useRef, useEffect } from 'react';
import { T } from '../../theme';
import TagBadge from './TagBadge';

export default function ShoppingItem({ item, tags, onToggle, onDelete, onEditTags, onRename }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(item.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveEdit = () => {
    if (editVal.trim()) onRename(item.id, editVal.trim());
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditVal(item.name);
    setEditing(false);
  };

  const itemTags = tags.filter(t => item.tagIds?.includes(t.id));

  if (editing) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.olive}`, borderRadius: 12, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 8,
              background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
              fontSize: 15, outline: 'none',
            }}
          />
          <button onClick={saveEdit} style={{
            padding: '7px 14px', borderRadius: 8,
            background: T.olive, color: T.text, fontSize: 13, fontWeight: 600,
          }}>Save</button>
          <button onClick={cancelEdit} style={{ color: T.muted, fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`,
      borderRadius: 12, padding: '11px 12px',
      opacity: item.checked ? 0.55 : 1, transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => onToggle(item.id)}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: item.checked ? 'none' : `2px solid ${T.muted}`,
            background: item.checked ? T.olive : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {item.checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <span style={{
          flex: 1, fontSize: 15, color: T.text, fontWeight: 500,
          textDecoration: item.checked ? 'line-through' : 'none',
        }}>
          {item.name}
        </span>

        {!item.checked && (
          <button onClick={() => { setEditVal(item.name); setEditing(true); }} style={{
            color: T.muted, fontSize: 13, padding: '2px 7px', borderRadius: 6,
            background: T.subtle, border: 'none', lineHeight: 1, flexShrink: 0,
          }}>✎</button>
        )}

        {!item.checked && (
          <button onClick={() => onEditTags(item)} style={{
            padding: '2px 7px', borderRadius: 6, background: T.subtle, border: 'none',
            color: T.muted, flexShrink: 0, display: 'flex', alignItems: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
                stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="7" y1="7" x2="7.01" y2="7" stroke={T.muted} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <button onClick={() => onDelete(item.id)} style={{
          color: T.red, fontSize: 18, padding: '2px 4px', lineHeight: 1, flexShrink: 0,
          background: 'none', border: 'none',
        }}>×</button>
      </div>

      {itemTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 32 }}>
          {itemTags.map(t => <TagBadge key={t.id} tag={t} />)}
        </div>
      )}
    </div>
  );
}
