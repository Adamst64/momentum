import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { TAG_COLORS } from '../../hooks/useShoppingLists';

export default function TagPickerSheet({ tags, selectedIds, onAddTag, onUpdateTag, onDeleteTag, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [editingTagId, setEditingTagId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const toggle = (id) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const startEdit = (tag, e) => {
    e.stopPropagation();
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveTagEdit = async (e) => {
    e?.stopPropagation();
    if (!editName.trim()) return;
    await onUpdateTag(editingTagId, { name: editName.trim(), color: editColor });
    setEditingTagId(null);
  };

  const handleDelete = async (tagId, e) => {
    e.stopPropagation();
    await onDeleteTag(tagId);
    setSelected(prev => { const s = new Set(prev); s.delete(tagId); return s; });
  };

  const handleCreate = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    const id = await onAddTag(newName.trim(), newColor);
    if (id) setSelected(prev => new Set([...prev, id]));
    setCreating(false);
    setNewName('');
    setNewColor(TAG_COLORS[0]);
    setSaving(false);
  };

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.card, borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px', maxHeight: '75vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Tags</span>
          <button
            onClick={() => onConfirm([...selected])}
            style={{ background: T.olive, color: T.text, fontSize: 14, fontWeight: 600, padding: '6px 18px', borderRadius: 8 }}
          >
            Done
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {tags.map(tag => (
            <div key={tag.id}>
              {editingTagId === tag.id ? (
                <div style={{ background: T.bg, borderRadius: 10, padding: 12, border: `1px solid ${T.olive}` }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTagEdit(); if (e.key === 'Escape') setEditingTagId(null); }}
                    autoFocus
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7, marginBottom: 10,
                      background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text,
                      fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {TAG_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)} style={{
                        width: 26, height: 26, borderRadius: '50%', background: c,
                        border: editColor === c ? `3px solid ${T.text}` : '3px solid transparent',
                        outline: editColor === c ? `2px solid ${T.olive}` : 'none', outlineOffset: 1,
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingTagId(null)} style={{
                      flex: 1, padding: '8px', borderRadius: 7, background: 'transparent',
                      border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 13,
                    }}>Cancel</button>
                    <button onClick={saveTagEdit} disabled={!editName.trim()} style={{
                      flex: 1, padding: '8px', borderRadius: 7,
                      background: editName.trim() ? T.olive : T.subtle, color: T.text, fontSize: 13, fontWeight: 600,
                    }}>Save</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => toggle(tag.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: selected.has(tag.id) ? '#1A2410' : T.bg,
                  border: `1px solid ${selected.has(tag.id) ? T.olive : T.cardBorder}`,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, color: T.text, textAlign: 'left' }}>{tag.name}</span>
                  {selected.has(tag.id) && (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l4 4 6-6" stroke={T.oliveLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <button onClick={(e) => startEdit(tag, e)} style={{
                    padding: '2px 6px', borderRadius: 5, background: T.subtle,
                    color: T.muted, fontSize: 12, lineHeight: 1, flexShrink: 0,
                  }}>✎</button>
                  <button onClick={(e) => handleDelete(tag.id, e)} style={{
                    padding: '2px 6px', borderRadius: 5, background: 'transparent',
                    color: T.red, fontSize: 15, lineHeight: 1, flexShrink: 0,
                  }}>×</button>
                </button>
              )}
            </div>
          ))}
        </div>

        {creating ? (
          <div style={{ background: T.bg, borderRadius: 12, padding: 14, border: `1px solid ${T.cardBorder}` }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Tag name"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text,
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: newColor === c ? `3px solid ${T.text}` : '3px solid transparent',
                  outline: newColor === c ? `2px solid ${T.olive}` : 'none', outlineOffset: 1,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setCreating(false); setNewName(''); }} style={{
                flex: 1, padding: '9px', borderRadius: 8, background: 'transparent',
                border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 14,
              }}>Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim() || saving} style={{
                flex: 1, padding: '9px', borderRadius: 8,
                background: newName.trim() ? T.olive : T.subtle, color: T.text, fontSize: 14, fontWeight: 600,
              }}>
                {saving ? '...' : 'Create'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, textAlign: 'left',
            background: 'transparent', border: `1px dashed ${T.cardBorder}`, color: T.muted, fontSize: 14,
          }}>
            + New tag
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
