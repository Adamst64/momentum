import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr, formatDateYear } from '../../utils/dateUtils';
import { validateTx, money, qtyFmt, accountHoldings } from '../../utils/investing';
import { genId } from '../../utils/id';
import { Field, Chips, PrimaryButton, inputStyle } from './ui';
import SymbolInput from './SymbolInput';

const TYPES = [
  { value: 'buy',      label: 'Buy' },
  { value: 'sell',     label: 'Sell' },
  { value: 'deposit',  label: 'Add money' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'dividend', label: 'Dividend' },
];


const num = v => {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const round6 = n => Math.round(n * 1e6) / 1e6;

// Add any transaction. Past trades are fine: pick their real date.
// There's no free cash: money sits in funds (FDRXX, VMFXX…), so every money
// movement names a fund — or, for buys/sells, money from/to outside the app.
// editing: { ids, init } from txEditInit — the form starts with that transaction's
// values and saving replaces it (both halves of a linked pair).
export default function TxModal({ hook, initialType = 'buy', initialSymbol = '', editing = null, onClose }) {
  const { txs, assets, accounts, addTx, addTxs, replaceTxs, ensureAsset, setAsset, priceHistory } = hook;
  const init = editing?.init || {};
  const str = v => (v === null || v === undefined ? '' : String(v));
  // Nothing is picked for you: account and where the money comes from / goes
  // must be chosen each time, so nothing lands in the wrong place by accident.
  // null = not chosen yet; '' = "No account" (only offered before any account exists).
  const [account, setAccountState] = useState(editing ? init.account ?? '' : null);
  const setAccount = v => { setAccountState(v); setPayWith(null); };
  const [type, setType]       = useState(editing ? init.type : initialType === 'interest' ? 'dividend' : initialType);
  const [date, setDate]       = useState(editing ? init.date : toDateStr(new Date()));
  const [symbol, setSymbol]   = useState(editing ? str(init.symbol) : initialSymbol);
  const [qty, setQty]         = useState(str(init.qty));
  const [price, setPrice]     = useState(str(init.price));
  const [fee, setFee]         = useState(str(init.fee));
  const [amount, setAmount]   = useState(str(init.amount));
  // Where money comes from / goes to: 'fund:SYM' (a fund in this account),
  // 'owned' (buy: shares you already had), 'out' (sell/dividend: money leaves
  // the account), 'reinvest' (dividend: buy more of the same). null = default.
  const [payWith, setPayWith] = useState(editing ? init.pay ?? null : null);
  const [newFund, setNewFund] = useState('');   // Add money into a fund not held yet
  const [newFundStatus, setNewFundStatus] = useState(null);
  // Is the symbol a real ticker? Unchecked ones (offline) need an explicit OK.
  const [symStatus, setSymStatus] = useState(null);
  const [allowUnchecked, setAllowUnchecked] = useState(false);
  const [symListOpen, setSymListOpen] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);

  const isTrade = type === 'buy' || type === 'sell';
  const isMoney = type === 'deposit' || type === 'withdraw';
  const sym = symbol.trim().toUpperCase();
  const q = num(qty), p = num(price), f = num(fee) || 0, a = num(amount);
  const acct = account ? { account } : {};

  // Holdings in this account right now: the funds money can come from / go to
  // When editing, everything is checked against the other transactions (without the old version)
  const baseTxs = useMemo(() => (editing ? txs.filter(t => !editing.ids.includes(t.id)) : txs), [txs, editing]);
  const acctHold = useMemo(() => (account === null ? [] : accountHoldings(baseTxs, account)), [baseTxs, account]);
  const funds = acctHold.filter(h => h.symbol !== sym || isMoney);
  const isMM = s => Math.abs((assets[s]?.price ?? 0) - 1) < 0.01; // $1 money market fund

  const options = type === 'buy'
    ? [...funds.map(h => `fund:${h.symbol}`), 'owned']
    : type === 'sell' ? [...funds.map(h => `fund:${h.symbol}`), 'out']
    : type === 'dividend' ? [...funds.map(h => `fund:${h.symbol}`), ...(sym ? ['reinvest'] : []), 'out']
    : type === 'deposit' ? [...acctHold.map(h => `fund:${h.symbol}`), 'new']
    : acctHold.map(h => `fund:${h.symbol}`);
  // Editing: keep the fund it used selectable even if nothing else holds it now
  if (editing && init.fund && init.pay === `fund:${init.fund}` && type === init.type && account === (init.account ?? '') && !options.includes(init.pay)) options.unshift(init.pay);
  const pay = payWith && options.includes(payWith) ? payWith : null; // no default — you pick
  const fundSym = pay === 'new' ? newFund.trim().toUpperCase() : pay?.startsWith('fund:') ? pay.slice(5) : pay === 'reinvest' ? sym : null;
  // Price the fund / reinvested stock traded at. $1 money market funds are always $1;
  // anything else is asked for, filled in with that day's close when known.
  const needsFlowPrice = !!fundSym && (pay === 'reinvest' || !isMM(fundSym));
  const [flowPriceText, setFlowPriceText] = useState(editing && init.flowPrice && Math.abs(init.flowPrice - 1) > 0.005 ? String(init.flowPrice) : '');
  const [hist, setHist] = useState(null); // { key, price, date } close on/before the chosen date
  const histKey = needsFlowPrice ? `${fundSym}|${date}` : null;
  useEffect(() => {
    if (!histKey || !priceHistory) return undefined;
    if (hist?.key === histKey) return undefined;
    let live = true;
    const days = (Date.now() - new Date(date + 'T12:00:00')) / 864e5;
    const range = days <= 25 ? '1mo' : days <= 85 ? '3mo' : days <= 175 ? '6mo' : days <= 360 ? '1y' : days <= 1800 ? '5y' : 'max';
    priceHistory(fundSym, range)
      .then(pts => {
        const pt = [...pts].reverse().find(x => x.date <= date);
        if (live) setHist({ key: histKey, price: pt ? Math.round(pt.value * 100) / 100 : null, date: pt?.date || null });
      })
      .catch(() => { if (live) setHist({ key: histKey, price: null, date: null }); });
    return () => { live = false; };
  }, [histKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const histPrice = hist?.key === histKey ? hist.price : null;
  const isToday = date === toDateStr(new Date());
  const suggested = isToday ? assets[fundSym]?.price || histPrice : histPrice || assets[fundSym]?.price;
  const fundPrice = !fundSym ? null
    : needsFlowPrice ? (num(flowPriceText) > 0 ? num(flowPriceText) : suggested || null)
    : assets[fundSym]?.price || 1;
  const flowOk = !fundSym || fundPrice > 0;
  const lastFund = useRef(fundSym);
  useEffect(() => { if (lastFund.current !== fundSym) { lastFund.current = fundSym; setFlowPriceText(''); } }, [fundSym]);

  // What gets saved: the transaction plus, when money moves through a fund, its linked fund trade
  let toSave = [];
  let total = 0;
  if (isTrade && sym && q > 0 && p > 0 && pay && flowOk) {
    total = q * p + (type === 'buy' ? f : -f);
    const main = { type, date, symbol: sym, quantity: q, price: p, ...(f ? { fee: f } : {}), ...acct,
      ...(type === 'buy' && pay === 'owned' ? { fromCash: false } : {}),
      ...(type === 'sell' && pay === 'out' ? { toCash: false } : {}) };
    const fundTx = fundSym ? { type: type === 'buy' ? 'sell' : 'buy', date, symbol: fundSym, quantity: round6(total / fundPrice), price: fundPrice, fundLeg: true, ...acct } : null;
    toSave = fundTx ? (type === 'buy' ? [fundTx, main] : [main, fundTx]) : [main];
  }
  if (type === 'deposit' && a > 0 && fundSym && flowOk) {
    total = a;
    toSave = [{ type: 'buy', date, symbol: fundSym, quantity: round6(a / fundPrice), price: fundPrice, fromCash: false, deposit: true, ...acct }];
  }
  if (type === 'withdraw' && a > 0 && fundSym && flowOk) {
    total = a;
    toSave = [{ type: 'sell', date, symbol: fundSym, quantity: round6(a / fundPrice), price: fundPrice, toCash: false, deposit: true, ...acct }];
  }
  if (type === 'dividend' && sym && a > 0 && pay && flowOk) {
    total = a;
    const div = { type: 'dividend', date, symbol: sym, amount: a, ...acct };
    toSave = pay === 'out'
      ? [div, { type: 'withdraw', date, amount: a, note: `${sym} dividend paid out`, ...acct }]
      : fundSym ? [div, { type: 'buy', date, symbol: fundSym, quantity: round6(a / fundPrice), price: fundPrice, ...acct }] : [];
  }
  const ready = toSave.length > 0;

  const check = ready ? validateTx(baseTxs, toSave) : null;
  const needsSym = isTrade || type === 'dividend';
  const symUnchecked = symStatus === 'offline' || symStatus === 'error';
  const symOk = !needsSym || symStatus === 'ok' || (symUnchecked && allowUnchecked);
  const newFundOk = pay !== 'new' || type !== 'deposit' || newFundStatus === 'ok';
  const blocked = account === null || !ready || !symOk || !newFundOk || check.errors.length > 0;
  const held = acctHold.find(h => h.symbol === sym);
  const acctName = account ? accounts.find(x => x.id === account)?.name : null;

  const handleSave = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (type === 'buy') await ensureAsset(sym, p);
      if (type === 'deposit' && pay === 'new') await ensureAsset(fundSym, 1);
      if (editing) await replaceTxs(editing.ids, toSave);
      else if (toSave.length > 1) {
        const linkId = genId();
        await addTxs(toSave.map(t => ({ ...t, linkId })));
      } else await addTx(toSave[0]);
      // Owned now, so it no longer belongs on the watchlist
      if (type === 'buy' && assets[sym]?.watch) await setAsset(sym, { watch: false });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save. Try again.');
      setBusy(false);
    }
  };

  const label = o => o === 'owned' ? 'Already owned' : o === 'out' ? (type === 'dividend' ? 'Paid out' : 'Taken out') : o === 'reinvest' ? `Reinvest in ${sym}` : o === 'new' ? 'Another fund…' : o.slice(5);
  const flowLabel = { buy: 'Paid with', sell: 'Money goes to', dividend: 'Goes to', deposit: 'Into', withdraw: 'From' }[type];

  return (
    <Modal title={editing ? 'Edit transaction' : 'New Transaction'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Chips options={TYPES} value={type} onChange={t => { setType(t); setPayWith(null); }} />

        <AccountPicker hook={hook} value={account} onChange={setAccount} />

        <Field label="Date">
          <input type="date" value={date} max={toDateStr(new Date())} onChange={e => e.target.value && setDate(e.target.value)} style={inputStyle} />
        </Field>

        {needsSym && (
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
            {type === 'sell' && held && (
              <button type="button" onClick={() => setQty(String(held.qty))} style={{ alignSelf: 'flex-start', fontSize: 12, color: T.khaki }}>
                You hold {qtyFmt(held.qty)}{acctName ? ` in ${acctName}` : ''} — sell all
              </button>
            )}
          </>
        )}

        {!isTrade && (
          <Field label={type === 'dividend' ? 'Amount received' : 'Amount'}>
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" style={inputStyle} />
          </Field>
        )}

        {account !== null && options.length > 0 && (
          <Field label={flowLabel}>
            <Chips small options={options.map(o => ({ value: o, label: label(o) }))} value={pay} onChange={setPayWith} />
          </Field>
        )}
        {account === null && (
          <div style={{ fontSize: 13, color: T.khaki }}>Choose the account first.</div>
        )}
        {account !== null && options.length > 0 && !pay && (isTrade ? sym && q > 0 && p > 0 : a > 0) && (
          <div style={{ fontSize: 13, color: T.khaki }}>Choose {type === 'buy' ? 'what pays for it' : type === 'withdraw' ? 'which fund it comes from' : 'where the money goes'}.</div>
        )}
        {needsFlowPrice && (
          <Field label={pay === 'reinvest' ? `Reinvest price (${fundSym} per share)` : `${fundSym} price that day`}>
            <input
              value={flowPriceText} onChange={e => setFlowPriceText(e.target.value)} inputMode="decimal"
              placeholder={suggested ? `$${suggested.toFixed(2)}` : '$0.00'} style={inputStyle}
            />
            <span style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              {num(flowPriceText) > 0 ? 'Your price.'
                : histPrice && !isToday && hist?.date ? `Using the ${hist.date === date ? '' : 'last '}close on ${formatDateYear(hist.date)}: $${histPrice.toFixed(2)} — type the exact price from your statement if it differs.`
                : suggested ? `Using today's price $${suggested.toFixed(2)}.`
                : hist?.key === histKey ? 'No price found for that day — type it in.' : 'Looking up that day\'s price…'}
            </span>
          </Field>
        )}
        {type === 'deposit' && pay === 'new' && (
          <Field label="Fund">
            <SymbolInput hook={hook} value={newFund} onChange={setNewFund} onStatus={setNewFundStatus} placeholder="e.g. FDRXX, SPAXX, VMFXX" />
          </Field>
        )}
        {type === 'withdraw' && account !== null && options.length === 0 && (
          <div style={{ fontSize: 13, color: T.muted }}>Nothing in {acctName || 'this account'} to withdraw from yet.</div>
        )}

        {/* What will happen, in words */}
        {ready && (
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
            {type === 'buy' && pay === 'owned' && <>The <b style={{ color: T.text }}>{money(total)}</b> cost counts as money you brought in (like a deposit), so it isn't counted as a gain.</>}
            {type === 'buy' && fundSym && <>Sells <b style={{ color: T.text }}>{qtyFmt(toSave[0].quantity)} {fundSym}</b> at {money(fundPrice)} ({money(total)}) to pay for it.</>}
            {type === 'sell' && fundSym && <>Buys <b style={{ color: T.text }}>{qtyFmt(toSave[1].quantity)} {fundSym}</b> at {money(fundPrice)} with the {money(total)}.</>}
            {type === 'sell' && pay === 'out' && <>The <b style={{ color: T.text }}>{money(total)}</b> leaves the account (like a withdrawal); your gain on the sale still counts.</>}
            {type === 'deposit' && <>Adds <b style={{ color: T.text }}>{qtyFmt(toSave[0].quantity)} {fundSym}</b> at {money(fundPrice)}. Money you put in isn't counted as a gain.</>}
            {type === 'withdraw' && <>Sells <b style={{ color: T.text }}>{qtyFmt(toSave[0].quantity)} {fundSym}</b> at {money(fundPrice)} and takes the money out.</>}
            {type === 'dividend' && fundSym && <>Buys <b style={{ color: T.text }}>{qtyFmt(toSave[1].quantity)} {fundSym}</b> at {money(fundPrice)} with it. Counts as return.</>}
            {type === 'dividend' && pay === 'out' && <>Counts as return, then leaves the account (e.g. paid to your bank).</>}
            {toSave.length > 1 && ' Saved together — deleting one deletes both.'}
          </div>
        )}

        {check?.errors.map(msg => <div key={msg} style={{ fontSize: 13, color: T.red }}>{msg}</div>)}

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
