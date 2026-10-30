import React, { useState } from 'react';
import { T } from '../../theme';
import { allGroups, lookupGroup, parseAmount, money } from '../../utils/budget';
import { useReceiptGroups, addReceiptGroup, updateReceiptGroup, deleteReceiptGroup } from '../../utils/receiptGroups';

const small = { background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.text, fontSize: 14, padding: '6px 8px', outline: 'none', colorScheme: 'dark', minWidth: 0 };

// Editable receipt lines: [{ name, price (text, dollars), group, taxed? }]. Saved items'
// amounts include their share of the receipt's tax (item.tax says how much).
export const itemsToRows = items => (items || []).map(i => ({
  name: i.name, price: (i.amount / 100).toFixed(2), group: lookupGroup(i.group).id, orig: lookupGroup(i.group).id,
  ...(i.taxed !== undefined ? { taxed: i.taxed } : {}), ...(i.tax ? { tax: i.tax } : {}),
}));
// shares: cents of tax to add to each row (a new receipt); without it, prices already include tax
export const rowsToItems = (rows, shares) => rows
  .map((r, k) => {
    const tax = shares ? shares[k] : r.tax || 0;
    return {
      name: r.name.trim() || 'Item', amount: parseSigned(r.price) + (shares ? tax : 0), group: r.group,
      ...(r.taxed !== undefined ? { taxed: !!r.taxed } : {}), ...(tax ? { tax } : {}),
    };
  })
  .filter(i => i.amount);
// Like parseAmount, but discounts and returns can be negative
export function parseSigned(str) {
  const s = String(str || '').trim();
  const neg = s.startsWith('-') || s.startsWith('−');
  const c = parseAmount(neg ? s.slice(1) : s) || 0;
  return neg ? -c : c;
}

// taxShares: on a new receipt, each row's share of the tax (cents); shows a Taxed toggle per row
export default function ReceiptItems({ rows, onChange, taxShares }) {
  useReceiptGroups(); // redraw when your groups change
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // "+ New group…" in a row's menu, or Edit next to one of your own groups:
  // a name and emoji box under that row. form: { row, id? (editing) }
  const [form, setForm] = useState(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const openForm = (row, g) => { setForm({ row, id: g?.id || null }); setNewName(g?.label || ''); setNewEmoji(g?.emoji || ''); setAskDelete(false); };
  const closeForm = () => { setForm(null); setNewName(''); setNewEmoji(''); setAskDelete(false); };
  const saveGroup = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      if (form.id) await updateReceiptGroup(form.id, newName, newEmoji);
      else set(form.row, { group: await addReceiptGroup(newName, newEmoji) });
      closeForm();
    } finally { setBusy(false); }
  };
  const removeGroup = async () => {
    const id = form.id;
    setBusy(true);
    try {
      // Rows on this receipt in that group go back to Other
      onChange(rows.map(r => (r.group === id ? { ...r, group: 'other' } : r)));
      await deleteReceiptGroup(id);
      closeForm();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => {
        const g = lookupGroup(r.group);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 8, borderBottom: `1px solid ${T.cardBorder}` }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={r.name} onChange={e => set(i, { name: e.target.value })} aria-label="Item" style={{ ...small, flex: 1 }} />
              <input value={r.price} onChange={e => set(i, { price: e.target.value })} inputMode="decimal" aria-label="Price" style={{ ...small, width: 74, textAlign: 'right' }} />
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove item" style={{ color: T.muted, fontSize: 18, padding: '0 4px' }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={r.group} onChange={e => (e.target.value === '__new' ? openForm(i) : set(i, { group: e.target.value }))} aria-label="Group"
                style={{ ...small, fontSize: 13, color: g.color, padding: '4px 6px' }}>
                {allGroups().map(x => <option key={x.id} value={x.id}>{x.emoji} {x.label}</option>)}
                <option value="__new">＋ New group…</option>
              </select>
              {g.custom && (
                <button type="button" onClick={() => openForm(i, g)} style={{ fontSize: 12, fontWeight: 600, color: T.khaki, padding: '2px 4px' }}>Edit</button>
              )}
              {taxShares && (
                <>
                  <button type="button" onClick={() => set(i, { taxed: !r.taxed })} aria-pressed={!!r.taxed}
                    style={{ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 12,
                      background: r.taxed ? '#2A3A1A' : T.bg, border: `1px solid ${r.taxed ? T.olive : T.cardBorder}`, color: r.taxed ? T.khaki : T.muted }}>
                    {r.taxed ? 'Taxed' : 'No tax'}
                  </button>
                  {taxShares[i] ? <span style={{ fontSize: 12, color: T.muted }}>{taxShares[i] > 0 ? '+' : '−'}{money(Math.abs(taxShares[i]))}</span> : null}
                </>
              )}
              {!taxShares && r.tax ? <span style={{ fontSize: 12, color: T.muted }}>incl. {money(r.tax)} tax</span> : null}
            </div>
            {form?.row === i && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🌷" aria-label="Emoji" style={{ ...small, width: 44, textAlign: 'center' }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveGroup()} placeholder="Group name, e.g. Flowers" aria-label="Group name" style={{ ...small, flex: 1 }} />
                </div>
                {askDelete ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.text, lineHeight: 1.4 }}>Delete "{newName || 'this group'}"? Items already in it (here and on saved receipts) count as Other.</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={removeGroup} disabled={busy} style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8, background: T.red, color: '#fff' }}>{busy ? 'Deleting…' : 'Delete'}</button>
                      <button type="button" onClick={() => setAskDelete(false)} style={{ fontSize: 13, color: T.muted }}>Keep it</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" onClick={saveGroup} disabled={!newName.trim() || busy}
                      style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8, background: newName.trim() ? T.olive : T.subtle, color: '#fff' }}>
                      {busy ? 'Saving…' : form.id ? 'Save' : 'Add group'}
                    </button>
                    <button type="button" onClick={closeForm} style={{ fontSize: 13, color: T.muted }}>Cancel</button>
                    <span style={{ flex: 1 }} />
                    {form.id
                      ? <button type="button" onClick={() => setAskDelete(true)} style={{ fontSize: 13, color: T.red }}>Delete group</button>
                      : <span style={{ fontSize: 11, color: T.muted }}>Next scans use it too</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => onChange([...rows, { name: '', price: '', group: 'other', ...(taxShares ? { taxed: false } : {}) }])} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki }}>+ Add item</button>
    </div>
  );
}
