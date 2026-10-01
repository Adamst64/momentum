import React, { useState } from 'react';
import Modal from './Modal';
import { T } from '../theme';

const OPTIONS = [
  { key: 'task',     label: 'Task',             hint: 'One-time, monthly or backlog' },
  { key: 'shopping', label: 'Shopping item',    hint: 'Add to a shopping list' },
  { key: 'list',     label: 'List item',        hint: 'To-try or checklist' },
  { key: 'note',     label: 'Journal entry',    hint: 'A thought or how the day went' },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 10,
  background: T.bg, border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

// Task and journal entry open their full editors (handled by the parent);
// shopping and list items are quick one-line adds right here.
export default function QuickAddSheet({ initialMode = null, shoppingHook, listsHook, onPick, onClose }) {
  const [mode, setMode] = useState(initialMode);

  const pick = (key) => {
    if (key === 'task' || key === 'note') { onPick(key); return; }
    setMode(key);
  };

  return (
    <Modal title={mode === 'shopping' ? 'Add to Shopping' : mode === 'list' ? 'Add to a List' : 'Quick Add'} onClose={onClose}>
      {!mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                background: T.bg, border: `1px solid ${T.cardBorder}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{o.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{o.hint}</div>
            </button>
          ))}
        </div>
      )}

      {mode === 'shopping' && (
        <OneLineAdd
          targets={shoppingHook.lists.map(l => ({ id: l.id, name: l.name }))}
          initialTarget={shoppingHook.activeListId}
          // addItem writes to the active list, so picking a list makes it active right away
          onTargetChange={shoppingHook.setActiveListId}
          emptyText="You don't have a shopping list yet. Open the Shopping tab to create one."
          placeholder="Item name"
          onAdd={(_, text) => shoppingHook.addItem(text)}
          onDone={onClose}
        />
      )}

      {mode === 'list' && (
        <OneLineAdd
          targets={listsHook.lists.map(l => ({ id: l.id, name: l.name }))}
          initialTarget={listsHook.lists[0]?.id}
          emptyText="You don't have any lists yet. Open the Lists tab to create one."
          placeholder="Item"
          onAdd={(listId, text) => listsHook.addItem(listId, text)}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function OneLineAdd({ targets, initialTarget, onTargetChange, emptyText, placeholder, onAdd, onDone }) {
  const [target, setTarget] = useState(initialTarget || targets[0]?.id || null);
  const [text, setText]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);

  if (!targets.length) {
    return <div style={{ fontSize: 14, color: T.muted, textAlign: 'center', padding: '20px 0' }}>{emptyText}</div>;
  }

  const handleAdd = async () => {
    if (!text.trim() || !target || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(target, text);
      onDone();
    } catch (e) {
      setError(e.message || 'Could not add. Try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {targets.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {targets.map(t => {
            const on = t.id === target;
            return (
              <button
                key={t.id}
                onClick={() => { setTarget(t.id); onTargetChange?.(t.id); }}
                style={{
                  padding: '7px 12px', borderRadius: 18,
                  background: on ? '#2A3A1A' : T.bg,
                  border: `1px solid ${on ? T.olive : T.cardBorder}`,
                  color: on ? T.khaki : T.muted, fontSize: 13,
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder}
        autoFocus
        style={inputStyle}
      />
      {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
      <button
        onClick={handleAdd}
        disabled={!text.trim() || busy}
        style={{ padding: 13, borderRadius: 12, background: text.trim() ? T.olive : T.subtle, color: '#fff', fontSize: 15, fontWeight: 600 }}
      >
        {busy ? 'Adding…' : 'Add'}
      </button>
    </div>
  );
}
