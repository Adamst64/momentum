import React, { useMemo, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr } from '../../utils/dateUtils';
import { validateTx, money, qtyFmt, replay, accountHoldings } from '../../utils/investing';
import { genId } from '../../utils/id';
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

const LAST_ACCOUNT_KEY = 'momentum_last_account';
const readLastAccount = () => { try { return localStorage.getItem(LAST_ACCOUNT_KEY) || ''; } catch { return ''; } };
const writeLastAccount = v => { try { localStorage.setItem(LAST_ACCOUNT_KEY, v || ''); } catch { /* storage unavailable */ } };

const num = v => {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Add any transaction. Past trades are fine: pick their real date.
export default function TxModal({ hook, initialType = 'buy', initialSymbol = '', initialAccount, onClose }) {
  const { txs, assets, accounts, addTx, addTxs, ensureAsset, setAsset } = hook;
  // Account: the one passed in, else the last one used (if it still exists), else the first
  const [account, setAccountState] = useState(() => {
    if (initialAccount !== undefined) return initialAccount || '';
    const last = readLastAccount();
    return accounts.some(x => x.id === last) ? last : accounts[0]?.id || '';
  });
  const setAccount = v => { setAccountState(v); writeLastAccount(v); setPayWith(null); };
  const [type, setType]       = useState(initialType);
  const [date, setDate]       = useState(toDateStr(new Date()));
  const [symbol, setSymbol]   = useState(initialSymbol);
  const [qty, setQty]         = useState('');
  const [price, setPrice]     = useState('');
  const [fee, setFee]         = useState('');
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  // Buys: 'cash' (this account's free cash), 'owned' (shares you already had —
  // cash untouched) or 'fund:SYM' (sell that fund, e.g. FDRXX, to pay).
  // Sells: 'cash' or 'fund:SYM' (proceeds buy that fund). null = pick a default.
  const [payWith, setPayWith] = useState(null);
  const [allowShort, setAllowShort] = useState(false);
  // Is the symbol a real ticker? Unchecked ones (offline) need an explicit OK.
  const [symStatus, setSymStatus] = useState(null);
  const [allowUnchecked, setAllowUnchecked] = useState(false);
  const [symListOpen, setSymListOpen] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);

  const isTrade = type === 'buy' || type === 'sell';
  const sym = symbol.trim().toUpperCase();
  const q = num(qty), p = num(price), f = num(fee) || 0, a = num(amount);

  // This account's cash and holdings right now (funds you can pay from)
  const acctCash = useMemo(() => replay(txs, { byAccount: true }).cashBy[account] || 0, [txs, account]);
  const acctHold = useMemo(() => accountHoldings(txs, account), [txs, account]);
  const funds = acctHold.filter(h => h.symbol !== sym);
  // Default for buys: cash if there is some, else a $1 fund you hold (FDRXX…), else "already owned"
  const mmFund = funds.find(h => Math.abs((assets[h.symbol]?.price ?? 0) - 1) < 0.01);
  const pay = payWith && (payWith === 'cash' || payWith === 'owned' || funds.some(h => `fund:${h.symbol}` === payWith))
    ? payWith
    : type === 'buy' ? (acctCash > 0.005 ? 'cash' : mmFund ? `fund:${mmFund.symbol}` : 'owned') : 'cash';
  const fundSym = pay.startsWith('fund:') ? pay.slice(5) : null;
  const fundPrice = fundSym ? assets[fundSym]?.price || 1 : null;
  const fromCash = pay !== 'owned';
  const acct = account ? { account } : {};

  let tx = null;
  if (isTrade && sym && q > 0 && p > 0) {
    tx = { type, date, symbol: sym, quantity: q, price: p, ...(f ? { fee: f } : {}), ...(type === 'buy' && pay === 'owned' ? { fromCash: false } : {}), ...acct };
  }
  if ((type === 'deposit' || type === 'withdraw') && a > 0) tx = { type, date, amount: a, ...(note.trim() ? { note: note.trim() } : {}), ...acct };
  if (type === 'dividend' && sym && a > 0) tx = { type, date, symbol: sym, amount: a, ...acct };
  if (type === 'interest' && a > 0) tx = { type, date, amount: a, ...acct };

  // Paying from / into a fund: the matching fund trade is saved with it, linked
  const tradeTotal = tx && isTrade ? q * p + (type === 'buy' ? f : -f) : 0;
  const fundTx = tx && isTrade && fundSym ? {
    type: type === 'buy' ? 'sell' : 'buy', date, symbol: fundSym,
    quantity: Math.round((tradeTotal / fundPrice) * 1e6) / 1e6, price: fundPrice, ...acct,
  } : null;
  const toSave = !tx ? [] : fundTx ? (type === 'buy' ? [fundTx, tx] : [tx, fundTx]) : [tx];

  const check = tx ? validateTx(txs, toSave) : null;
  const needsSym = isTrade || type === 'dividend';
  const symUnchecked = symStatus === 'offline' || symStatus === 'error';
  const symOk = !needsSym || symStatus === 'ok' || (symUnchecked && allowUnchecked);
  const blocked = !tx || !symOk || check.errors.length > 0 || (check.cashShort && !allowShort);
  const held = acctHold.find(h => h.symbol === sym);
  const acctName = account ? accounts.find(x => x.id === account)?.name : null;

  const handleSave = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (type === 'buy') await ensureAsset(sym, p);
      if (toSave.length > 1) {
        const linkId = genId();
        await addTxs(toSave.map(t => ({ ...t, linkId })));
      } else await addTx(tx);
      // Owned now, so it no longer belongs on the watchlist
      if (type === 'buy' && assets[sym]?.watch) await setAsset(sym, { watch: false });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setBusy(false);
    }
  };

  return (
    <Modal title="New Transaction" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Chips options={TYPES} value={type} onChange={t => { setType(t); setAllowShort(false); setPayWith(null); }} />

        <AccountPicker hook={hook} value={account} onChange={setAccount} />

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
              onOpenChange={setSymListOpen}
              placeholder="Ticker or company, e.g. VOO"
            />
          </Field>
        )}

        {needsSym && sym && !symListOpen && symStatus === 'checking' && (
          <div style={{ fontSize: 13, color: T.muted }}>Checking {sym}…</div>
        )}
        {needsSym && sym && !symListOpen && symStatus === 'invalid' && (
          <div style={{ fontSize: 13, color: T.red }}>
            {sym} isn't a ticker. Type the ticker, or pick the company from the list.
          </div>
        )}
        {needsSym && sym && !symListOpen && symUnchecked && (
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
            <Field label={type === 'buy' ? 'Paid with' : 'Money goes to'}>
              <Chips
                small
                options={[
                  { value: 'cash', label: `Free cash${account || accounts.length ? ` (${money(acctCash)})` : ''}` },
                  ...funds.map(h => ({ value: `fund:${h.symbol}`, label: h.symbol })),
                  ...(type === 'buy' ? [{ value: 'owned', label: 'Already owned' }] : []),
                ]}
                value={pay}
                onChange={v => { setPayWith(v); setAllowShort(false); }}
              />
            </Field>
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
            Free cash stays at {money(acctCash)}. The <b style={{ color: T.text }}>{money(q * p + f)}</b> cost counts as money you brought in
            (like a deposit), so it isn't counted as a gain.
          </div>
        )}

        {tx && fundTx && (
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
            {type === 'buy' ? 'Sells' : 'Buys'} <b style={{ color: T.text }}>{qtyFmt(fundTx.quantity)} {fundSym}</b> at {money(fundPrice)}
            {' '}({money(tradeTotal)}) {type === 'buy' ? 'to pay for it' : 'with the money'}. Both are saved together; deleting one deletes both.
          </div>
        )}

        {tx && isTrade && pay === 'cash' && (
          <div style={{ fontSize: 13, color: T.muted }}>
            {type === 'buy' ? 'Takes' : 'Adds'} <b style={{ color: T.text }}>{money(tradeTotal)}</b> {type === 'buy' ? 'from' : 'to'} free cash
            {acctName ? ` in ${acctName}` : ''} ({money(acctCash)} now).
          </div>
        )}

        {check?.errors.map(msg => <div key={msg} style={{ fontSize: 13, color: T.red }}>{msg}</div>)}

        {check?.cashShort && check.errors.length === 0 && (
          <div style={{ background: '#3A1C1C', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: T.text }}>
              Not enough {fundSym ? fundSym : 'free cash'}{acctName ? ` in ${acctName}` : ''} for this at that date. {type === 'buy' ? 'If you owned these shares before, pick “Already owned” above. Otherwise add' : 'Add'} the deposit that paid for it first, or record it anyway.
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

// Which account a transaction belongs to; "+ New" adds one on the spot
function AccountPicker({ hook, value, onChange }) {
  const { accounts, addAccount } = hook;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    try { const id = await addAccount(n); onChange(id); setAdding(false); setName(''); }
    catch (e) { setErr(e.message || 'Could not add the account'); }
  };
  return (
    <Field label="Account">
      <Chips
        small
        options={[
          ...accounts.map(x => ({ value: x.id, label: x.name })),
          ...(accounts.length === 0 || value === '' ? [{ value: '', label: 'No account' }] : []),
          { value: '__new', label: '+ New account' },
        ]}
        value={adding ? '__new' : value}
        onChange={v => (v === '__new' ? setAdding(true) : (setAdding(false), onChange(v)))}
      />
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. Fidelity Roth IRA" autoFocus style={inputStyle}
          />
          <button type="button" onClick={save} style={{ padding: '0 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>Add</button>
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{err}</div>}
    </Field>
  );
}
