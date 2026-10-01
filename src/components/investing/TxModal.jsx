import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr } from '../../utils/dateUtils';
import { validateTx, money, qtyFmt } from '../../utils/investing';
import { Field, Chips, PrimaryButton, inputStyle } from './ui';

const TYPES = [
  { value: 'buy',      label: 'Buy' },
  { value: 'sell',     label: 'Sell' },
  { value: 'deposit',  label: 'Add cash' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'dividend', label: 'Dividend' },
];

const num = v => {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Add any transaction. Past trades are fine: pick their real date.
export default function TxModal({ hook, initialType = 'buy', initialSymbol = '', onClose }) {
  const { txs, portfolio, addTx, ensureAsset } = hook;
  const [type, setType]       = useState(initialType);
  const [date, setDate]       = useState(toDateStr(new Date()));
  const [symbol, setSymbol]   = useState(initialSymbol);
  const [qty, setQty]         = useState('');
  const [price, setPrice]     = useState('');
  const [fee, setFee]         = useState('');
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [allowShort, setAllowShort] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);

  const isTrade = type === 'buy' || type === 'sell';
  const sym = symbol.trim().toUpperCase();
  const q = num(qty), p = num(price), f = num(fee) || 0, a = num(amount);

  let tx = null;
  if (isTrade && sym && q > 0 && p > 0) tx = { type, date, symbol: sym, quantity: q, price: p, ...(f ? { fee: f } : {}) };
  if ((type === 'deposit' || type === 'withdraw') && a > 0) tx = { type, date, amount: a, ...(note.trim() ? { note: note.trim() } : {}) };
  if (type === 'dividend' && sym && a > 0) tx = { type, date, symbol: sym, amount: a };

  const check = tx ? validateTx(txs, tx) : null;
  const blocked = !tx || check.errors.length > 0 || (check.cashShort && !allowShort);
  const held = portfolio.holdings.find(h => h.symbol === sym);

  const handleSave = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (type === 'buy') await ensureAsset(sym, p);
      await addTx(tx);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setBusy(false);
    }
  };

  return (
    <Modal title="New Transaction" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Chips options={TYPES} value={type} onChange={t => { setType(t); setAllowShort(false); }} />

        <Field label="Date">
          <input type="date" value={date} max={toDateStr(new Date())} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
        </Field>

        {(isTrade || type === 'dividend') && (
          <Field label="Symbol">
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. VOO"
              autoCapitalize="characters"
              autoCorrect="off"
              style={inputStyle}
            />
          </Field>
        )}

        {isTrade && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="Quantity">
                <input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
              </Field>
              <Field label="Price per share">
                <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder="$0.00" style={inputStyle} />
              </Field>
            </div>
            <Field label="Fee (optional)">
              <input value={fee} onChange={e => setFee(e.target.value)} inputMode="decimal" placeholder="$0.00" style={inputStyle} />
            </Field>
            {type === 'sell' && held && (
              <button type="button" onClick={() => setQty(String(held.qty))} style={{ alignSelf: 'flex-start', fontSize: 12, color: T.khaki }}>
                You hold {qtyFmt(held.qty)} — sell all
              </button>
            )}
          </>
        )}

        {!isTrade && (
          <Field label={type === 'dividend' ? 'Amount received' : 'Amount'}>
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" style={inputStyle} />
          </Field>
        )}

        {(type === 'deposit' || type === 'withdraw') && (
          <Field label="Note (optional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'deposit' ? 'e.g. Salary' : ''} style={inputStyle} />
          </Field>
        )}

        {tx && isTrade && (
          <div style={{ fontSize: 13, color: T.muted }}>
            {type === 'buy' ? 'Takes' : 'Adds'} <b style={{ color: T.text }}>{money(q * p + (type === 'buy' ? f : -f))}</b> {type === 'buy' ? 'from' : 'to'} free cash
            {' '}({money(portfolio.cash)} now).
          </div>
        )}

        {check?.errors.map(msg => <div key={msg} style={{ fontSize: 13, color: T.red }}>{msg}</div>)}

        {check?.cashShort && check.errors.length === 0 && (
          <div style={{ background: '#3A1C1C', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: T.text }}>
              Not enough free cash for this at that date. Add the deposit that paid for it first, or record it anyway.
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: T.muted }}>
              <input type="checkbox" checked={allowShort} onChange={e => setAllowShort(e.target.checked)} />
              Record anyway (cash goes negative)
            </label>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}

        <PrimaryButton disabled={blocked || busy} onClick={handleSave}>
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
