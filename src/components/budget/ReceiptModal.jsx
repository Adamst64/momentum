import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr } from '../../utils/dateUtils';
import { money, parseAmount, centsToInput, TOBACCO, shareTax } from '../../utils/budget';
import { inputStyle, Field, Chips, PrimaryButton } from '../investing/ui';
import ReceiptItems, { rowsToItems, parseSigned } from './ReceiptItems';

// Shrinks a camera photo so it uploads fast but the print stays readable → base64 JPEG
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Tobacco lines go to their own entry in the Tobacco category. `items` already carry
// their share of the tax, so each entry is just the sum of its items.
// → { tobacco: { amount, items } | null, rest: { amount, items } | null } (cents)
export function splitTobacco(items, total, category) {
  const tob = items.filter(i => i.group === TOBACCO);
  const other = items.filter(i => i.group !== TOBACCO);
  const tobacco = tob.reduce((s, i) => s + i.amount, 0);
  // Nothing to split: no tobacco, the whole receipt filed as Tobacco, or odd totals
  if (!tob.length || category === TOBACCO || tobacco <= 0 || tobacco > total) return { tobacco: null, rest: { amount: total, items } };
  if (!other.length) return { tobacco: { amount: total, items }, rest: null };
  return { tobacco: { amount: tobacco, items: tob }, rest: { amount: total - tobacco, items: other } };
}

// Photo → items sorted into food groups → review → one expense with the items attached
// (tobacco lines become a second expense in the Tobacco category; see splitTobacco)
export default function ReceiptModal({ file, accounts, categories, defaultAccountId, scanReceipt, onSave, onClose }) {
  const [state, setState] = useState('reading'); // reading | review | error
  const [error, setError] = useState(null);
  const [store, setStore] = useState('');
  const [date, setDate] = useState(todayStr());
  const [total, setTotal] = useState('');
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState('groceries');
  const [accountId, setAccountId] = useState(defaultAccountId || null);
  const [saving, setSaving] = useState(false);
  const [noNames, setNoNames] = useState(false); // the receipt had no item names

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await scanReceipt(await prepareImage(file), 'image/jpeg');
        if (!live) return;
        // No item names (some stores print only codes) but a total: one row for the
        // whole purchase, to assign to a group or split by hand
        if (!r.items?.length && !(r.total > 0)) throw new Error("Couldn't read this receipt. Try a flatter, sharper photo with the whole receipt in view.");
        setStore(r.store || '');
        if (r.date && r.date <= todayStr()) setDate(r.date);
        const itemsSum = (r.items || []).reduce((s, i) => s + i.price, 0);
        setTotal(centsToInput(Math.round((r.total || itemsSum + (r.tax || 0)) * 100)));
        if (r.items?.length) {
          setRows(r.items.map(i => ({ name: i.name, price: i.price.toFixed(2), group: i.group, taxed: !!i.taxed })));
        } else {
          setNoNames(true);
          setRows([{ name: r.store || 'Groceries', price: (r.total - (r.tax || 0)).toFixed(2), group: 'other', taxed: (r.tax || 0) > 0 }]);
        }
        setState('review');
      } catch (e) {
        if (!live) return;
        setError(e.message || 'Could not read the receipt.');
        setState('error');
      }
    })();
    return () => { live = false; };
  }, [file, scanReceipt]);

  const cents = parseAmount(total);
  const itemsCents = rows.reduce((s, r) => s + parseSigned(r.price), 0);
  const rest = (cents || 0) - itemsCents;
  const cats = categories.filter(c => c.kind === 'expense' && !c.hidden);
  const canSave = !!cents && !!accountId && cats.some(c => c.id === category) && !saving;
  // Tax and fees (the total minus the items) go onto the taxed items by price, so the
  // saved items add up to exactly what was paid
  const shares = shareTax(rows.map(r => parseSigned(r.price)), rows.map(r => !!r.taxed), rest);
  const taxedCount = rows.filter(r => r.taxed && parseSigned(r.price) > 0).length;
  const split = splitTobacco(rowsToItems(rows, shares), cents || 0, category);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const base = { type: 'expense', accountId, date, note: store };
      if (split.tobacco) await onSave({ ...base, amount: split.tobacco.amount, category: TOBACCO, items: split.tobacco.items });
      if (split.rest) await onSave({ ...base, amount: split.rest.amount, category, items: split.rest.items });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Scan receipt" onClose={onClose}>
      {state === 'reading' && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: T.muted, fontSize: 14, lineHeight: 1.6 }}>
          Reading the receipt…<br />Sorting items into groups. This takes 10–30 seconds.
        </div>
      )}
      {state === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
          <div style={{ fontSize: 14, color: T.red, lineHeight: 1.5 }}>{error}</div>
          <PrimaryButton onClick={onClose}>Close</PrimaryButton>
        </div>
      )}
      {state === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={store} onChange={e => setStore(e.target.value)} placeholder="Store" aria-label="Store" style={{ ...inputStyle, flex: 1 }} />
            <input type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Date" style={{ ...inputStyle, width: 150 }} />
          </div>
          <Field label="Total paid">
            <input value={total} onChange={e => setTotal(e.target.value)} inputMode="decimal" style={{ ...inputStyle, fontSize: 24, fontWeight: 700 }} />
            <span style={{ fontSize: 12, color: rest < 0 ? T.red : T.muted, lineHeight: 1.45 }}>
              Items {money(itemsCents)}
              {rest > 0 && <> + tax & fees {money(rest)}, added to {taxedCount ? `the ${taxedCount} taxed item${taxedCount === 1 ? '' : 's'}` : 'all items'} by price</>}
              {rest < 0 && <> · items are more than the total by {money(-rest)}</>}
            </span>
          </Field>
          <Field label="Category">
            <Chips small options={cats.map(c => ({ value: c.id, label: `${c.emoji} ${c.label}` }))} value={category} onChange={setCategory} />
          </Field>
          <Field label="Paid from">
            <Chips small options={accounts.map(a => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
          </Field>
          {noNames && (
            <div style={{ fontSize: 13, color: T.khaki, lineHeight: 1.45, background: '#2A2616', borderRadius: 10, padding: '10px 12px' }}>
              This receipt doesn't list item names, so the whole amount is one row. Pick what kind it was below, or split it: change the price and add rows for each kind.
            </div>
          )}
          {split.tobacco && split.rest && (
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.45, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '10px 12px' }}>
              🚬 Saved as two entries: <b>{money(split.tobacco.amount)}</b> in Tobacco and <b>{money(split.rest.amount)}</b> in the category above.
              <span style={{ color: T.muted }}> Each item includes its tax.</span>
            </div>
          )}
          <Field label={`Items (${rows.length}) — fix any group or tax mark that's wrong`}>
            <ReceiptItems rows={rows} onChange={setRows} taxShares={shares} />
          </Field>
          {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
          <PrimaryButton onClick={save} disabled={!canSave}>{saving ? 'Saving…' : accountId ? 'Save' : 'Pick an account'}</PrimaryButton>
        </div>
      )}
    </Modal>
  );
}
