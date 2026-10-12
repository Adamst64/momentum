import React, { useState } from 'react';
import Modal from './Modal';
import { T } from '../theme';
import { todayStr } from '../utils/dateUtils';
import { money as cents$, parseAmount } from '../utils/budget';
import { validateTx, accountHoldings, money as usd } from '../utils/investing';
import { genId } from '../utils/id';
import { inputStyle, Field, Chips, PrimaryButton } from './investing/ui';

const MODES = [
  { value: 'in',   label: 'Bank → Investing' },
  { value: 'out',  label: 'Investing → Bank' },
  { value: 'bank', label: 'Bank → Bank' },
];
const round6 = n => Math.round(n * 1e6) / 1e6;

// One place to move money between your bank accounts (Budget) and investing accounts.
// Bank → Investing buys the account's cash fund (or a fund you pick) with the money;
// Investing → Bank sells it. Both sides are saved and linked by bankRef, so deleting
// the investing entry removes the budget one too. Bank → Bank is a budget transfer.
export default function TransferSheet({ investing, budget, onClose }) {
  const bankAccts = budget.accounts;
  const invAccts = investing.accounts;
  const [mode, setMode] = useState(invAccts.length ? 'in' : 'bank');
  const [bank, setBank] = useState(null);
  const [bank2, setBank2] = useState(null);
  const [inv, setInvState] = useState(null);
  const [fund, setFund] = useState(null);
  const [otherFund, setOtherFund] = useState('');
  const [amount, setAmount] = useState('');
  const [priceText, setPriceText] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const setInv = id => {
    setInvState(id);
    setFund(invAccts.find(a => a.id === id)?.coreFund || null);
    setPriceText('');
  };

  const a = parseAmount(amount);                 // cents
  const held = inv ? accountHoldings(investing.txs, inv) : [];
  const core = invAccts.find(x => x.id === inv)?.coreFund || null;
  const fundOptions = [...new Set([...(core ? [core] : []), ...held.map(h => h.symbol)])];
  const fundSym = (fund === '__other' ? otherFund.trim().toUpperCase() : fund) || null;
  const assetPrice = fundSym ? investing.assets[fundSym]?.price : null;
  const isDollar = !assetPrice || Math.abs(assetPrice - 1) < 0.01; // money market funds are $1
  const price = isDollar && !priceText ? 1 : parseFloat(priceText) || assetPrice || null;
  const fundHeld = held.find(h => h.symbol === fundSym);
  const bankOpts = bankAccts.filter(x => x.type !== 'credit' || mode === 'bank');

  // What gets saved on the investing side
  let invTx = null;
  if (mode !== 'bank' && inv && fundSym && a > 0 && price > 0) {
    const dollars = a / 100;
    invTx = mode === 'in'
      ? { type: 'buy', date, symbol: fundSym, quantity: round6(dollars / price), price, fromCash: false, deposit: true, account: inv }
      : { type: 'sell', date, symbol: fundSym, quantity: round6(dollars / price), price, toCash: false, deposit: true, account: inv };
  }
  const check = invTx ? validateTx(investing.txs, invTx) : null;
  const ready = mode === 'bank'
    ? a > 0 && bank && bank2 && bank !== bank2
    : !!invTx && !!bank && check.errors.length === 0;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'bank') {
        await budget.addTx({ type: 'transfer', amount: a, date, accountId: bank, toAccountId: bank2, note });
      } else {
        const bankRef = genId();
        if (mode === 'in' && !investing.assets[fundSym]) await investing.ensureAsset(fundSym, price);
        await investing.addTx({ ...invTx, bankRef, ...(note.trim() ? { note: note.trim() } : {}) });
        await budget.putSynced(`inv-${bankRef}`, {
          type: 'transfer', amount: a, date,
          accountId: mode === 'in' ? bank : null, toAccountId: mode === 'in' ? null : bank, category: null,
          note: note.trim() || (mode === 'in' ? 'Added to investing' : 'Withdrew from investing'),
          source: 'investing', bankRef, invAccountName: invAccts.find(x => x.id === inv)?.name || '',
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setBusy(false);
    }
  };

  const bankChips = (value, onChange, exclude) => (
    <Chips small options={bankOpts.filter(x => x.id !== exclude).map(x => ({ value: x.id, label: `${x.name} · ${cents$(budget.balances[x.id] || 0)}` }))} value={value} onChange={onChange} />
  );
  const invPicker = (
    <Field label={mode === 'in' ? 'To investing account' : 'From investing account'}>
      <Chips small options={invAccts.map(x => ({ value: x.id, label: x.name }))} value={inv} onChange={setInv} />
    </Field>
  );
  const fundPicker = inv && (
    <Field label={mode === 'in' ? 'Into fund' : 'Out of fund'}>
      <Chips small
        options={[...fundOptions.map(s => ({ value: s, label: s === core ? `${s} (cash)` : s })), ...(mode === 'in' ? [{ value: '__other', label: 'Another fund…' }] : [])]}
        value={fund} onChange={v => { setFund(v); setPriceText(''); }} />
      {fund === '__other' && (
        <input value={otherFund} onChange={e => setOtherFund(e.target.value)} placeholder="e.g. FDRXX, VMFXX" style={{ ...inputStyle, marginTop: 6 }} />
      )}
      {!core && <span style={{ fontSize: 11, color: T.muted }}>Tip: set the account's cash fund on its page so it's picked for you.</span>}
      {mode === 'out' && fundHeld && <span style={{ fontSize: 11, color: T.muted }}>{fundSym} in this account: {usd(fundHeld.qty * (assetPrice || fundHeld.avgCost || 1))}</span>}
    </Field>
  );

  return (
    <Modal title="Transfer" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Chips options={MODES.filter(m => m.value === 'bank' || invAccts.length)} value={mode} onChange={v => { setMode(v); setError(null); }} />

        <input
          value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" aria-label="Amount"
          style={{ ...inputStyle, fontSize: 28, fontWeight: 700, padding: '12px 14px' }}
        />

        {mode === 'in' && (<>
          <Field label="From bank account">{bankChips(bank, setBank)}</Field>
          {invPicker}
          {fundPicker}
        </>)}
        {mode === 'out' && (<>
          {invPicker}
          {fundPicker}
          <Field label="To bank account">{bankChips(bank, setBank)}</Field>
        </>)}
        {mode === 'bank' && (<>
          <Field label="From">{bankChips(bank, v => { setBank(v); if (v === bank2) setBank2(null); })}</Field>
          <Field label="To">{bankChips(bank2, setBank2, bank)}</Field>
        </>)}

        {mode !== 'bank' && fundSym && !isDollar && (
          <Field label={`${fundSym} price that day`}>
            <input value={priceText} onChange={e => setPriceText(e.target.value)} inputMode="decimal" placeholder={assetPrice ? `$${assetPrice.toFixed(2)}` : '$0.00'} style={inputStyle} />
          </Field>
        )}

        <Field label="Date">
          <input type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Note (optional)">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={mode === 'bank' ? 'e.g. Savings top-up' : 'e.g. Monthly investing'} style={inputStyle} />
        </Field>

        {check?.errors.map(m => <div key={m} style={{ fontSize: 13, color: T.red }}>{m}</div>)}
        {error && <div style={{ fontSize: 13, color: T.red }}>{error}</div>}
        {mode !== 'bank' && invAccts.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>Add an investing account first.</div>}

        <PrimaryButton onClick={save} disabled={!ready || busy}>{busy ? 'Saving…' : 'Transfer'}</PrimaryButton>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
          {mode === 'bank' ? "Moves money between your accounts; it isn't spending or income."
            : 'Saved in both Budget and Investing. Money moved in or out isn\'t counted as an investment gain or loss.'}
        </div>
      </div>
    </Modal>
  );
}
