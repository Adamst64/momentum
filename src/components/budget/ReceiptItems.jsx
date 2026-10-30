import React, { useState } from 'react';
import { T } from '../../theme';
import { allGroups, lookupGroup, parseAmount, money } from '../../utils/budget';
import { useReceiptGroups, addReceiptGroup } from '../../utils/receiptGroups';

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
  // "+ New group…" in a row's menu: a name (and emoji) box for that row
  const [newFor, setNewFor] = useState(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const createGroup = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const id = await addReceiptGroup(newName, newEmoji);
      set(newFor, { group: id });
      setNewFor(null); setNewName(''); setNewEmoji('');
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
              <select value={r.group} onChange={e => (e.target.value === '__new' ? setNewFor(i) : set(i, { group: e.target.value }))} aria-label="Group"
                style={{ ...small, fontSize: 13, color: g.color, padding: '4px 6px' }}>
                {allGroups().map(x => <option key={x.id} value={x.id}>{x.emoji} {x.label}</option>)}
                <option value="__new">＋ New group…</option>
              </select>
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
            {newFor === i && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🌷" aria-label="Emoji" style={{ ...small, width: 44, textAlign: 'center' }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} placeholder="New group, e.g. Flowers" aria-label="Group name" style={{ ...small, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={createGroup} disabled={!newName.trim() || busy}
                    style={{ fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8, background: newName.trim() ? T.olive : T.subtle, color: '#fff' }}>
                    {busy ? 'Adding…' : 'Add group'}
                  </button>
                  <button type="button" onClick={() => setNewFor(null)} style={{ fontSize: 13, color: T.muted }}>Cancel</button>
                  <span style={{ fontSize: 11, color: T.muted, flex: 1, textAlign: 'right' }}>Next scans use it too</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => onChange([...rows, { name: '', price: '', group: 'other', ...(taxShares ? { taxed: false } : {}) }])} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki }}>+ Add item</button>
    </div>
  );
}
