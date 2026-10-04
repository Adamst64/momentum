import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr } from '../../utils/dateUtils';
import { validateTx, money, qtyFmt } from '../../utils/investing';
import { Field, Chips, PrimaryButton, inputStyle } from './ui';
import SymbolInput from './SymbolInput';

const TYPES = [
  { value: 'buy',      label: 'Buy' },
  { value: 'sell',     label: 'Sell' },
  { value: 'deposit',  label: 'Add cash' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'interest', label: 'Cash interest' },
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
  // Buys: pay from free cash, or shares already owned (cash untouched). With no
  // cash recorded yet, it's most likely an existing holding being added.
  const [fromCash, setFromCash] = useState(portfolio.cash > 0.005);
  const [allowShort, setAllowShort] = useState(false);
  // Is the symbol a real ticker? Unchecked ones (offline) need an explicit OK.
  const [symStatus, setSymStatus] = useState(null);
  const [allowUnchecked, setAllowUnchecked] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);

  const isTrade = type === 'buy' || type === 'sell';
  const sym = symbol.trim().toUpperCase();
  const q = num(qty), p = num(price), f = num(fee) || 0, a = num(amount);

  let tx = null;
  if (isTrade && sym && q > 0 && p > 0) {
    tx = { type, date, symbol: sym, quantity: q, price: p, ...(f ? { fee: f } : {}), ...(type === 'buy' && !fromCash ? { fromCash: false } : {}) };
  }
  if ((type === 'deposit' || type === 'withdraw') && a > 0) tx = { type, date, amount: a, ...(note.trim() ? { note: note.trim() } : {}) };
  if (type === 'dividend' && sym && a > 0) tx = { type, date, symbol: sym, amount: a };
  if (type === 'interest' && a > 0) tx = { type, date, amount: a };

  const check = tx ? validateTx(txs, tx) : null;
  const needsSym = isTrade || type === 'dividend';
  const symUnchecked = symStatus === 'offline' || symStatus === 'error';
  const symOk = !needsSym || symStatus === 'ok' || (symUnchecked && allowUnchecked);
  const blocked = !tx || !symOk || check.errors.length > 0 || (check.cashShort && !allowShort);
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
            <SymbolInput
              hook={hook}
              value={symbol}
              onChange={v => { setSymbol(v); setAllowUnchecked(false); }}
              onStatus={setSymStatus}
              placeholder="Ticker or company, e.g. VOO"
            />
          </Field>
        )}

        {needsSym && sym && symStatus === 'checking' && (
          <div style={{ fontSize: 13, color: T.muted }}>Checking {sym}…</div>
        )}
        {needsSym && sym && symStatus === 'invalid' && (
          <div style={{ fontSize: 13, color: T.red }}>
            {sym} isn't a ticker. Type the ticker, or pick the company from the list.
          </div>
        )}
        {needsSym && sym && symUnchecked && (
          <div style={{ background: '#3A2E1C', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: T.text }}>
              {symStatus === 'offline'
                ? `You're offline, so ${sym} can't be checked. It'll be checked automatically when you're back online.`
                : `Couldn't check ${sym} right now.`}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: T.muted }}>
              <input type="checkbox" checked={allowUnchecked} onChange={e => setAllowUnchecked(e.target.checked)} />
              {sym} is the right ticker, save anyway
            </label>
          </div>
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
            {type === 'buy' && (
              <Field label="Paid with">
                <Chips
                  small
                  options={[{ value: 'cash', label: 'Free cash' }, { value: 'owned', label: 'Already owned' }]}
                  value={fromCash ? 'cash' : 'owned'}
                  onChange={v => { setFromCash(v === 'cash'); setAllowShort(false); }}
                />
              </Field>
            )}
            {type === 'sell' && held && (
              <button type="button" onClick={() => setQty(String(held.qty))} style={{ alignSelf: 'flex-start', fontSize: 12, color: T.khaki }}>
                You hold {qtyFmt(held.qty)} — sell all
              </button>
            )}
          </>
        )}

        {!isTrade && (
          <Field label={type === 'dividend' || type === 'interest' ? 'Amount received' : 'Amount'}>
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" style={inputStyle} />
          </Field>
        )}

        {type === 'interest' && (
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
            For what your cash earns on its own — like the monthly dividend from Vanguard's settlement fund (VMFXX).
            It's added to free cash and counts as return, unlike salary deposits.
          </div>
        )}

        {(type === 'deposit' || type === 'withdraw') && (
          <Field label="Note (optional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'deposit' ? 'e.g. Salary' : ''} style={inputStyle} />
          </Field>
        )}

        {tx && type === 'buy' && !fromCash && (
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
            Free cash stays at {money(portfolio.cash)}. The <b style={{ color: T.text }}>{money(q * p + f)}</b> cost counts as money you brought in
            (like a deposit), so it isn't counted as a gain.
          </div>
        )}

        {tx && isTrade && (type === 'sell' || fromCash) && (
          <div style={{ fontSize: 13, color: T.muted }}>
            {type === 'buy' ? 'Takes' : 'Adds'} <b style={{ color: T.text }}>{money(q * p + (type === 'buy' ? f : -f))}</b> {type === 'buy' ? 'from' : 'to'} free cash
            {' '}({money(portfolio.cash)} now).
          </div>
        )}

        {check?.errors.map(msg => <div key={msg} style={{ fontSize: 13, color: T.red }}>{msg}</div>)}

        {check?.cashShort && check.errors.length === 0 && (
          <div style={{ background: '#3A1C1C', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: T.text }}>
              Not enough free cash for this at that date. {type === 'buy' ? 'If you owned these shares before, pick “Already owned” above. Otherwise add' : 'Add'} the deposit that paid for it first, or record it anyway.
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
