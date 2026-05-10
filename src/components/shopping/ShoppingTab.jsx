import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';
import { TAG_COLORS } from '../../hooks/useShoppingLists';

// ── TagPickerSheet ─────────────────────────────────────────────────────────────
function TagPickerSheet({ tags, selectedIds, onAddTag, onUpdateTag, onDeleteTag, onConfirm, onClose }) {
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [editingTagId, setEditingTagId] = useState(null); // tag being renamed/recolored
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
          <button onClick={() => onConfirm([...selected])}
            style={{ background: T.olive, color: T.text, fontSize: 14, fontWeight: 600, padding: '6px 18px', borderRadius: 8 }}>
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
                        outline: editColor === c ? `2px solid ${T.olive}` : 'none',
                        outlineOffset: 1,
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

// ── ShareSheet ─────────────────────────────────────────────────────────────────
function ShareSheet({ list, userId, onClose, onJoin, onLeaveOrDelete, onRegenerate, onRename }) {
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(list?.name || '');

  const isOwner = list?.ownerId === userId;

  const copyCode = () => {
    navigator.clipboard.writeText(list.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const result = await onJoin(joinCode.trim());
      if (result?.alreadyMember) setJoinError('You are already a member of this list');
      else onClose();
    } catch (err) {
      setJoinError(err.message || 'Invalid invite code');
    } finally {
      setJoining(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.card, borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Manage List</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 24, padding: '0 4px', background: 'none', border: 'none', lineHeight: 1 }}>×</button>
        </div>

        {renaming ? (
          <div style={{ marginBottom: 14 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onRename(newName); setRenaming(false); } }}
              autoFocus
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
                background: T.bg, border: `1px solid ${T.olive}`, color: T.text,
                fontSize: 15, outline: 'none', marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenaming(false)} style={{
                flex: 1, padding: '9px', borderRadius: 8, background: 'transparent',
                border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 14,
              }}>Cancel</button>
              <button onClick={() => { onRename(newName); setRenaming(false); }} disabled={!newName.trim()} style={{
                flex: 1, padding: '9px', borderRadius: 8,
                background: newName.trim() ? T.olive : T.subtle, color: T.text, fontSize: 14, fontWeight: 600,
              }}>Save</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRenaming(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', borderRadius: 10, marginBottom: 14,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
          }}>
            <span style={{ fontSize: 15, color: T.text }}>{list?.name}</span>
            <span style={{ color: T.muted, fontSize: 13 }}>Rename ✎</span>
          </button>
        )}

        <div style={{
          background: T.bg, border: `1px solid ${T.cardBorder}`,
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Invite Code
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 5, color: T.khaki, flex: 1 }}>
              {list?.inviteCode}
            </span>
            <button onClick={copyCode} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: copied ? '#1A2410' : T.subtle, color: copied ? T.oliveLight : T.text,
              border: `1px solid ${copied ? T.olive + '44' : 'transparent'}`,
            }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {isOwner && (
              <button onClick={onRegenerate} title="Generate new code" style={{
                padding: '7px 10px', borderRadius: 8, fontSize: 16,
                background: T.subtle, color: T.muted, border: 'none',
              }}>↻</button>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            Share this code with family or friends to let them join this list.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Join Another List
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter code"
              maxLength={6}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 10,
                background: T.bg, border: `1px solid ${T.cardBorder}`,
                color: T.text, fontSize: 15, outline: 'none', letterSpacing: 3, fontWeight: 700,
              }}
            />
            <button onClick={handleJoin} disabled={joining || !joinCode.trim()} style={{
              padding: '11px 18px', borderRadius: 10,
              background: joinCode.trim() ? T.olive : T.subtle,
              color: T.text, fontSize: 14, fontWeight: 600,
            }}>
              {joining ? '...' : 'Join'}
            </button>
          </div>
          {joinError && <p style={{ color: T.red, fontSize: 13, margin: '6px 0 0' }}>{joinError}</p>}
        </div>

        <button onClick={onLeaveOrDelete} style={{
          width: '100%', padding: '12px', borderRadius: 12,
          border: `1px solid ${T.red}44`, color: T.red,
          fontSize: 14, fontWeight: 500, background: 'transparent',
        }}>
          {isOwner && list?.members?.length <= 1 ? 'Delete list' : 'Leave list'}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── TagBadge ───────────────────────────────────────────────────────────────────
function TagBadge({ tag }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: tag.color + '22', border: `1px solid ${tag.color}55`,
      fontSize: 11, color: tag.color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {tag.name}
    </span>
  );
}

// ── ShoppingItem ───────────────────────────────────────────────────────────────
function ShoppingItem({ item, tags, onToggle, onDelete, onEditTags, onRename }) {
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
      <div style={{
        background: T.card, border: `1px solid ${T.olive}`,
        borderRadius: 12, padding: '10px 12px',
      }}>
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

// ── ShoppingTab ────────────────────────────────────────────────────────────────
export default function ShoppingTab({ hook, userId }) {
  const {
    lists, activeList, activeListId, setActiveListId,
    items, tags,
    addItem, toggleItem, updateItemTags, renameItem, deleteItem, clearFinished, clearAll,
    addTag, updateTag, deleteTag,
    createList, renameList, leaveOrDeleteList, regenerateCode, joinList,
  } = hook;

  const [input, setInput] = useState('');
  const [pendingTagIds, setPendingTagIds] = useState([]);
  const [filterTagId, setFilterTagId] = useState(null);
  const [tagPickerItem, setTagPickerItem] = useState(null); // item | 'new' | null
  const [showShare, setShowShare] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const inputRef = useRef(null);

  const handleAdd = () => {
    if (!input.trim()) return;
    addItem(input, pendingTagIds);
    setInput('');
    setPendingTagIds([]);
    inputRef.current?.focus();
  };

  const handleTagPickerConfirm = async (selectedIds) => {
    if (tagPickerItem === 'new') {
      setPendingTagIds(selectedIds);
    } else if (tagPickerItem) {
      await updateItemTags(tagPickerItem.id, selectedIds);
    }
    setTagPickerItem(null);
  };

  const filteredItems = filterTagId ? items.filter(i => i.tagIds?.includes(filterTagId)) : items;
  const unchecked = filteredItems.filter(i => !i.checked);
  const checked   = filteredItems.filter(i => i.checked);
  const pendingTags = pendingTagIds.map(id => tags.find(t => t.id === id)).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* List tabs */}
      {lists.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 12px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto', paddingBottom: 2 }}>
            {lists.map(list => (
              <button key={list.id} onClick={() => setActiveListId(list.id)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0,
                background: list.id === activeListId ? T.olive : T.card,
                color: list.id === activeListId ? T.text : T.muted,
                border: `1px solid ${list.id === activeListId ? T.olive : T.cardBorder}`,
              }}>
                {list.name}
              </button>
            ))}
            <button onClick={() => setShowNewList(true)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 16, fontWeight: 700,
              flexShrink: 0, background: 'transparent', color: T.muted,
              border: `1px dashed ${T.cardBorder}`,
            }}>+</button>
          </div>
          <button onClick={() => setShowShare(true)} style={{ flexShrink: 0, padding: 6, background: 'none', border: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke={T.olive} strokeWidth="1.8" />
              <circle cx="6" cy="12" r="3" stroke={T.olive} strokeWidth="1.8" />
              <circle cx="18" cy="19" r="3" stroke={T.olive} strokeWidth="1.8" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Tag filter chips */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setFilterTagId(null)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0,
              background: !filterTagId ? T.olive : T.card,
              color: !filterTagId ? T.text : T.muted,
              border: `1px solid ${!filterTagId ? T.olive : T.cardBorder}`,
            }}>All</button>
            {tags.map(tag => (
              <button key={tag.id} onClick={() => setFilterTagId(prev => prev === tag.id ? null : tag.id)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                background: filterTagId === tag.id ? tag.color + '22' : T.card,
                color: filterTagId === tag.id ? tag.color : T.muted,
                border: `1px solid ${filterTagId === tag.id ? tag.color + '88' : T.cardBorder}`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color, display: 'inline-block', flexShrink: 0 }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Add item row */}
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTagPickerItem('new')} style={{
              padding: '12px 10px', borderRadius: 12, flexShrink: 0,
              background: pendingTagIds.length > 0 ? T.olive + '33' : T.card,
              border: `1px solid ${pendingTagIds.length > 0 ? T.olive + '88' : T.cardBorder}`,
              color: pendingTagIds.length > 0 ? T.oliveLight : T.muted,
              fontSize: 12, fontWeight: 600, minWidth: 44,
            }}>
              {pendingTagIds.length > 0 ? `${pendingTagIds.length}` : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
                    stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="7" y1="7" x2="7.01" y2="7" stroke={T.muted} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add item…"
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 12,
                background: T.card, border: `1px solid ${T.cardBorder}`,
                color: T.text, fontSize: 15, outline: 'none',
              }}
            />
            <button onClick={handleAdd} disabled={!input.trim()} style={{
              padding: '12px 18px', borderRadius: 12,
              background: input.trim() ? T.olive : T.subtle,
              color: T.text, fontSize: 15, fontWeight: 600, transition: 'background 0.15s',
            }}>Add</button>
          </div>
          {pendingTags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingLeft: 2 }}>
              {pendingTags.map(t => <TagBadge key={t.id} tag={t} />)}
            </div>
          )}
        </div>

        {/* Empty state */}
        {filteredItems.length === 0 && (
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 14,
          }}>
            {filterTagId ? 'No items with this tag' : 'Your shopping list is empty'}
          </div>
        )}

        {/* Unchecked items */}
        {unchecked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unchecked.map(item => (
              <ShoppingItem key={item.id} item={item} tags={tags}
                onToggle={toggleItem} onDelete={deleteItem}
                onEditTags={setTagPickerItem} onRename={renameItem} />
            ))}
          </div>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              In cart ({checked.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checked.map(item => (
                <ShoppingItem key={item.id} item={item} tags={tags}
                  onToggle={toggleItem} onDelete={deleteItem}
                  onEditTags={setTagPickerItem} onRename={renameItem} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {checked.length > 0 && (
              <button onClick={clearFinished} style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                border: `1px solid ${T.cardBorder}`,
                color: T.muted, fontSize: 13, fontWeight: 500, background: 'transparent',
              }}>
                Clear done ({checked.length})
              </button>
            )}
            <button onClick={clearAll} style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              border: `1px solid ${T.red}33`,
              color: T.red, fontSize: 13, fontWeight: 500, background: 'transparent',
            }}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Tag picker sheet */}
      {tagPickerItem !== null && (
        <TagPickerSheet
          tags={tags}
          selectedIds={tagPickerItem === 'new' ? pendingTagIds : (tagPickerItem?.tagIds || [])}
          onAddTag={addTag}
          onUpdateTag={updateTag}
          onDeleteTag={deleteTag}
          onConfirm={handleTagPickerConfirm}
          onClose={() => setTagPickerItem(null)}
        />
      )}

      {/* Share / manage sheet */}
      {showShare && activeList && (
        <ShareSheet
          list={activeList}
          userId={userId}
          onClose={() => setShowShare(false)}
          onJoin={joinList}
          onLeaveOrDelete={() => { leaveOrDeleteList(); setShowShare(false); }}
          onRegenerate={regenerateCode}
          onRename={renameList}
        />
      )}

      {/* New list sheet */}
      {showNewList && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => { setShowNewList(false); setNewListName(''); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: T.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>New List</div>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newListName.trim()) {
                  createList(newListName); setShowNewList(false); setNewListName('');
                }
              }}
              placeholder="List name"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10, marginBottom: 12,
                background: T.bg, border: `1px solid ${T.cardBorder}`, color: T.text,
                fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowNewList(false); setNewListName(''); }} style={{
                flex: 1, padding: '12px', borderRadius: 10, background: 'transparent',
                border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 15,
              }}>Cancel</button>
              <button onClick={() => { createList(newListName); setShowNewList(false); setNewListName(''); }}
                disabled={!newListName.trim()} style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: newListName.trim() ? T.olive : T.subtle,
                  color: T.text, fontSize: 15, fontWeight: 600,
                }}>Create</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
