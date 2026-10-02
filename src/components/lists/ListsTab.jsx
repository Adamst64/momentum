import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { formatShortDate } from '../../utils/dateUtils';
import { useBackHandler } from '../../hooks/useBackHandler';

const KINDS = {
  try:       { label: 'To-try',    hint: 'Movies, books, restaurants, places — check off when done' },
  checklist: { label: 'Checklist', hint: 'Reusable list, like packing — reset it for next time' },
};

const LIST_COLORS = ['#B79CF0', '#5EC4A8', '#E5A44B', '#E88AA6', '#7FA9FF', '#A9BB6C'];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 10,
  background: T.bg, border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

export default function ListsTab({ hook }) {
  const { lists, createList, renameList, deleteList, addItem, toggleItem, deleteItem, resetList } = hook;
  const [activeId, setActiveId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  useBackHandler(!!activeId, () => setActiveId(null));

  // Back to the overview if the open list gets deleted
  useEffect(() => {
    if (activeId && lists.length && !lists.find(l => l.id === activeId)) setActiveId(null);
  }, [lists, activeId]);

  const active = lists.find(l => l.id === activeId);
  const items  = active?.items || [];
  const open   = items.filter(i => !i.done);
  const done   = items.filter(i => i.done)
    .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  const run = async (fn) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong. Try again.'); }
  };

  const handleAdd = () => {
    if (!draft.trim() || !active) return;
    const text = draft;
    setDraft('');
    run(() => addItem(active.id, text));
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview: every list with its progress */}
      {!active && lists.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          {lists.map((l, i) => {
            const all = l.items || [];
            const doneCount = all.filter(x => x.done).length;
            const color = LIST_COLORS[i % LIST_COLORS.length];
            const pct = all.length ? doneCount / all.length : 0;
            return (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', minHeight: 64,
                  borderTop: i ? `1px solid ${T.cardBorder}` : 'none', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: color + '26', color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800,
                }}>
                  {(l.name.trim()[0] || '?').toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2 }}>
                    {all.length === 0 ? 'Empty' : `${doneCount} of ${all.length} ${l.kind === 'checklist' ? 'checked' : 'done'}`}
                  </span>
                  {all.length > 0 && (
                    <span style={{ display: 'block', height: 4, borderRadius: 2, background: T.cardBorder, marginTop: 6, maxWidth: 140 }}>
                      <span style={{ display: 'block', height: 4, borderRadius: 2, background: color, width: `${pct * 100}%` }} />
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 20, color: T.subtle, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {!active && (
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: 14, borderRadius: 14, border: `1.5px dashed ${T.cardBorder}`, color: T.muted, fontSize: 15, textAlign: 'center' }}
        >
          + New list
        </button>
      )}

      {lists.length === 0 && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '40px 20px', lineHeight: 1.5 }}>
          No lists yet.<br />Make a to-try list for movies or places,<br />or a reusable packing checklist.
        </div>
      )}

      {active && (
        <>
          <button
            onClick={() => setActiveId(null)}
            style={{ alignSelf: 'flex-start', fontSize: 14, color: T.khaki, padding: '4px 0', marginBottom: -6 }}
          >
            ‹ All lists
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{active.name}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                {active.kind === 'checklist'
                  ? `${done.length}/${items.length} checked`
                  : `${open.length} to try · ${done.length} done`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {active.kind === 'checklist' && done.length > 0 && (
                <button
                  onClick={() => run(() => resetList(active.id))}
                  style={{ padding: '7px 12px', borderRadius: 10, background: T.subtle, color: T.text, fontSize: 13 }}
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => setShowManage(true)}
                style={{ padding: '7px 12px', borderRadius: 10, background: T.subtle, color: T.muted, fontSize: 13 }}
              >
                Edit
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={active.kind === 'checklist' ? 'Add item…' : 'Add something to try…'}
              style={{ ...inputStyle, flex: 1, background: T.card }}
            />
            <button
              onClick={handleAdd}
              disabled={!draft.trim()}
              style={{
                padding: '0 18px', borderRadius: 10,
                background: draft.trim() ? T.olive : T.subtle, color: '#fff', fontSize: 20,
              }}
            >
              +
            </button>
          </div>

          {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

          {items.length === 0 && (
            <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: 20 }}>
              This list is empty.
            </div>
          )}

          {/* Checklists keep their order so the list reads the same every trip */}
          {active.kind === 'checklist' ? (
            <ItemGroup items={items} onToggle={id => run(() => toggleItem(active.id, id))} onDelete={id => run(() => deleteItem(active.id, id))} />
          ) : (
            <>
              <ItemGroup items={open} onToggle={id => run(() => toggleItem(active.id, id))} onDelete={id => run(() => deleteItem(active.id, id))} />
              {done.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Done
                  </div>
                  <ItemGroup items={done} showDate onToggle={id => run(() => toggleItem(active.id, id))} onDelete={id => run(() => deleteItem(active.id, id))} />
                </>
              )}
            </>
          )}
        </>
      )}

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onCreate={async (name, kind) => {
            const id = await createList(name, kind);
            if (id) setActiveId(id);
          }}
        />
      )}

      {showManage && active && (
        <ManageListModal
          list={active}
          onClose={() => setShowManage(false)}
          onRename={name => renameList(active.id, name)}
          onDelete={() => deleteList(active.id)}
        />
      )}
    </div>
  );
}

function ItemGroup({ items, showDate, onToggle, onDelete }) {
  if (!items.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderTop: i ? `1px solid ${T.cardBorder}` : 'none',
          }}
        >
          <button
            onClick={() => onToggle(item.id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: `1.5px solid ${item.done ? T.oliveLight : T.subtle}`,
              background: item.done ? '#2A3A1A' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.oliveLight, fontSize: 14,
            }}>
              {item.done ? '✓' : ''}
            </span>
            <span style={{
              fontSize: 15, color: item.done ? T.muted : T.text,
              textDecoration: item.done ? 'line-through' : 'none',
            }}>
              {item.text}
            </span>
          </button>
          {showDate && item.doneAt && (
            <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{formatShortDate(item.doneAt)}</span>
          )}
          <button
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${item.text}`}
            style={{ color: T.subtle, fontSize: 18, padding: '0 2px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function CreateListModal({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('try');
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await onCreate(name, kind);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not create the list.');
    }
  };

  return (
    <Modal title="New List" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder={kind === 'try' ? 'e.g. Movies to watch' : 'e.g. Weekend trip packing'}
          autoFocus
          style={inputStyle}
        />
        {Object.entries(KINDS).map(([key, k]) => {
          const on = kind === key;
          return (
            <button
              key={key}
              onClick={() => setKind(key)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                background: on ? '#2A3A1A' : T.bg,
                border: `1px solid ${on ? T.olive : T.cardBorder}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: on ? T.khaki : T.text }}>{k.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{k.hint}</div>
            </button>
          );
        })}
        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          style={{ padding: 13, borderRadius: 12, background: name.trim() ? T.olive : T.subtle, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          Create
        </button>
      </div>
    </Modal>
  );
}

function ManageListModal({ list, onRename, onDelete, onClose }) {
  const [name, setName] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  const act = async (fn) => {
    try { await fn(); onClose(); } catch (e) { setError(e.message || 'Something went wrong.'); }
  };

  return (
    <Modal title="Edit List" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <button
          onClick={() => act(() => onRename(name))}
          disabled={!name.trim() || name.trim() === list.name}
          style={{
            padding: 13, borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600,
            background: name.trim() && name.trim() !== list.name ? T.olive : T.subtle,
          }}
        >
          Rename
        </button>
        <button
          onClick={() => confirmDelete ? act(onDelete) : setConfirmDelete(true)}
          style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}
        >
          {confirmDelete ? `Tap again to delete “${list.name}”` : 'Delete list'}
        </button>
        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
      </div>
    </Modal>
  );
}
