import React from 'react';
import { T } from '../../theme';
import { GROCERY_GROUPS, lookupGroup, parseAmount } from '../../utils/budget';

const small = { background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.text, fontSize: 14, padding: '6px 8px', outline: 'none', colorScheme: 'dark', minWidth: 0 };

// Editable receipt lines: [{ name, price (text, dollars), group }]
export const itemsToRows = items => (items || []).map(i => ({ name: i.name, price: (i.amount / 100).toFixed(2), group: lookupGroup(i.group).id }));
export const rowsToItems = rows => rows
  .map(r => ({ name: r.name.trim() || 'Item', amount: parseSigned(r.price), group: r.group }))
  .filter(i => i.amount);
// Like parseAmount, but discounts and returns can be negative
export function parseSigned(str) {
  const s = String(str || '').trim();
  const neg = s.startsWith('-') || s.startsWith('−');
  const c = parseAmount(neg ? s.slice(1) : s) || 0;
  return neg ? -c : c;
}

export default function ReceiptItems({ rows, onChange }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
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
            <select value={r.group} onChange={e => set(i, { group: e.target.value })} aria-label="Group"
              style={{ ...small, fontSize: 13, color: g.color, alignSelf: 'flex-start', padding: '4px 6px' }}>
              {GROCERY_GROUPS.map(x => <option key={x.id} value={x.id}>{x.emoji} {x.label}</option>)}
            </select>
          </div>
        );
      })}
      <button onClick={() => onChange([...rows, { name: '', price: '', group: 'other' }])} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: T.khaki }}>+ Add item</button>
    </div>
  );
}
