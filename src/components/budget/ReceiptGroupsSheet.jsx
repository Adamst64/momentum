import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { allGroups } from '../../utils/budget';
import { useReceiptGroups, addReceiptGroup, updateReceiptGroup, deleteReceiptGroup, resetReceiptGroup } from '../../utils/receiptGroups';

const field = { background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.text, fontSize: 15, padding: '8px 10px', outline: 'none', minWidth: 0 };

// Groceries by type → Manage types: every grocery type; tap one to rename it or change
// its emoji. Your own types can be deleted (their items count as Other); built-in
// ones can go back to their own name.
export default function ReceiptGroupsSheet({ onClose }) {
  const docs = useReceiptGroups();
  const [open, setOpen] = useState(null); // group id, or 'new'
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = g => { setOpen(g ? g.id : 'new'); setName(g?.label || ''); setEmoji(g?.emoji || ''); setAskDelete(false); };
  const close = () => { setOpen(null); setAskDelete(false); };
  const run = async fn => { setBusy(true); try { await fn(); close(); } finally { setBusy(false); } };
  const learned = id => docs.find(d => d.id === id)?.examples?.length || 0;

  const editor = g => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 12px' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🌷" aria-label="Emoji" style={{ ...field, width: 52, textAlign: 'center' }} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name, e.g. Flowers" aria-label="Name" style={{ ...field, flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && name.trim() && run(() => (g ? updateReceiptGroup(g.id, name, emoji) : addReceiptGroup(name, emoji)))} />
      </div>
      {askDelete ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: T.text, lineHeight: 1.45 }}>Delete "{g.label}"? Items already in it count as Other, and the next scans won't use it.</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => run(() => deleteReceiptGroup(g.id))} disabled={busy} style={{ fontSize: 14, fontWeight: 600, padding: '8px 14px', borderRadius: 10, background: T.red, color: '#fff' }}>{busy ? 'Deleting…' : 'Delete'}</button>
            <button onClick={() => setAskDelete(false)} style={{ fontSize: 14, color: T.muted }}>Keep it</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => run(() => (g ? updateReceiptGroup(g.id, name, emoji) : addReceiptGroup(name, emoji)))} disabled={!name.trim() || busy}
            style={{ fontSize: 14, fontWeight: 600, padding: '8px 14px', borderRadius: 10, background: name.trim() ? T.olive : T.subtle, color: '#fff' }}>
            {busy ? 'Saving…' : g ? 'Save' : 'Add type'}
          </button>
          <button onClick={close} style={{ fontSize: 14, color: T.muted }}>Cancel</button>
          <span style={{ flex: 1 }} />
          {g?.custom && <button onClick={() => setAskDelete(true)} style={{ fontSize: 14, color: T.red }}>Delete</button>}
          {g && !g.custom && g.renamed && <button onClick={() => run(() => resetReceiptGroup(g.id))} style={{ fontSize: 13, color: T.muted }}>Reset name</button>}
        </div>
      )}
    </div>
  );

  return (
    <Modal title="Grocery types" onClose={onClose}>
      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45, marginBottom: 10 }}>
        Tap a type to rename it or change its emoji. Your own types can be deleted. Receipt scans use these types and learn from the items you move between them.
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '0 14px' }}>
        {allGroups().map((g, i) => (
          <div key={g.id} style={{ borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
            <button onClick={() => (open === g.id ? close() : start(g))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', textAlign: 'left' }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{g.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, color: T.text }}>{g.label}</span>
                {(g.custom || learned(g.id) > 0) && (
                  <span style={{ display: 'block', fontSize: 11, color: T.muted }}>
                    {g.custom ? 'Your type' : 'Built-in'}{learned(g.id) ? ` · learned ${learned(g.id)} item${learned(g.id) === 1 ? '' : 's'}` : ''}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 13, color: T.khaki, fontWeight: 600 }}>{open === g.id ? 'Close' : 'Edit'}</span>
            </button>
            {open === g.id && editor(g)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {open === 'new'
          ? <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '10px 14px 0' }}>{editor(null)}</div>
          : <button onClick={() => start(null)} style={{ fontSize: 15, fontWeight: 600, color: T.khaki, padding: '8px 0' }}>＋ New type</button>}
      </div>
    </Modal>
  );
}
