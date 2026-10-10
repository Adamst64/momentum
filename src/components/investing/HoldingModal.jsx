import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { formatShortDate } from '../../utils/dateUtils';
import { money, signedMoney, pct, qtyFmt, sortTx, extendedPrice, soldPositions, tradeDetails, accountGroups } from '../../utils/investing';
import { Chips, inputStyle, gainColor, SectionTitle } from './ui';
import { registerPushToken } from '../../utils/pushNotifications';
import StockInfo, { ANALYST_COLOR } from './StockInfo';
import StockChart from './StockChart';

const timeAgo = iso => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return formatShortDate(iso.slice(0, 10));
};

// allTxs: every transaction, to name the other half of a linked pair when
// txs is filtered to one symbol. accounts + onSetAccount: account label you can change.
export function TxList({ txs, allTxs = txs, hide, onDelete, onUpdate, accounts = [], onSetAccount }) {
  const [confirm, setConfirm] = useState(null);
  if (!txs.length) return <div style={{ fontSize: 13, color: T.muted }}>No transactions yet.</div>;
  const partner = t => (t.linkId ? allTxs.find(o => o.linkId === t.linkId && o.id !== t.id) : null);
  const showAccounts = accounts.length > 0 || txs.some(t => t.account);
  const describe = t => {
    if (t.type === 'buy' && t.fromCash === false) return `Added ${qtyFmt(t.quantity)} ${t.symbol} @ ${money(t.price, hide)}`;
    if (t.type === 'buy' || t.type === 'sell') return `${t.type === 'buy' ? 'Bought' : 'Sold'} ${qtyFmt(t.quantity)} ${t.symbol} @ ${money(t.price, hide)}`;
    if (t.type === 'dividend') return `${t.symbol} dividend`;
    if (t.type === 'interest') return 'Interest on cash';
    return t.note || (t.type === 'deposit' ? 'Cash added' : 'Cash withdrawn');
  };
  const amount = t => {
    if (t.type === 'buy')  return -(t.quantity * t.price + (t.fee || 0));
    if (t.type === 'sell') return t.quantity * t.price - (t.fee || 0);
    return t.type === 'withdraw' ? -t.amount : t.amount;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sortTx(txs).reverse().map((t, i) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: T.text }}>{describe(t)}</div>
            <div style={{ fontSize: 11, color: T.muted }}>
              {formatShortDate(t.date)} · {t.date.slice(0, 4)}{t.fee ? ` · fee ${money(t.fee, hide)}` : ''}
              {(() => {
                const o = partner(t);
                if (!o) return null;
                return ` · ${t.type === 'buy' ? `paid with ${o.symbol}` : o.type === 'buy' ? `into ${o.symbol}` : `paid for ${o.symbol}`}`;
              })()}
              {t.type === 'buy' && !t.linkId && (onUpdate ? (
                <>
                  {' · '}
                  <button
                    onClick={() => onUpdate(t.id, { fromCash: t.fromCash === false })}
                    style={{ fontSize: 11, color: T.khaki, padding: 0 }}
                    aria-label={t.fromCash === false ? 'Switch to paid from free cash' : 'Switch to already owned'}
                  >
                    {t.fromCash === false ? 'already owned' : 'from cash'} ⇄
                  </button>
                </>
              ) : ` · ${t.fromCash === false ? 'already owned' : 'from cash'}`)}
            </div>
            {showAccounts && (
              onSetAccount ? (
                <select
                  value={t.account || ''}
                  onChange={e => onSetAccount(t.id, e.target.value)}
                  aria-label="Account"
                  style={{
                    marginTop: 3, fontSize: 11, color: t.account ? T.khaki : T.muted, background: T.bg, border: `1px solid ${T.cardBorder}`,
                    borderRadius: 8, padding: '2px 6px', maxWidth: '100%', colorScheme: 'dark',
                  }}
                >
                  <option value="">No account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  {t.account && !accounts.some(a => a.id === t.account) && <option value={t.account}>Deleted account</option>}
                </select>
              ) : (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{accounts.find(a => a.id === t.account)?.name || 'No account'}</div>
              )
            )}
          </div>
          <span style={{ fontSize: 13, color: t.fromCash === false ? T.muted : amount(t) >= 0 ? T.green : T.text, fontVariantNumeric: 'tabular-nums' }}>
            {t.fromCash === false ? money(-amount(t), hide) : signedMoney(amount(t), hide)}
          </span>
          <button
            onClick={() => confirm === t.id ? (onDelete(t.id), setConfirm(null)) : setConfirm(t.id)}
            style={{ fontSize: confirm === t.id ? 11 : 16, color: confirm === t.id ? T.red : T.subtle, padding: '0 2px' }}
            aria-label="Delete transaction"
          >
            {confirm === t.id ? 'Delete?' : '×'}
          </button>
        </div>
      ))}
    </div>
  );
}

// account: opened from that account's row → starts showing just that account,
// with a switch to all accounts. undefined → all accounts.
export default function HoldingModal({ hook, symbol, account, hide, userId, onTrade, onClose }) {
  const { portfolio, assets, txs, accounts, setTxAccount, alerts, setAsset, deleteTx, updateTx, deleteHolding, addAlert, toggleAlert, deleteAlert, stockInfo, priceHistory } = hook;
  const h = [...portfolio.holdings, ...portfolio.closed].find(x => x.symbol === symbol);
  const asset = assets[symbol] || {};
  const myTx = txs.filter(t => t.symbol === symbol);
  // Where it's held, when that's more than one account
  const byAcct = accountGroups(myTx, assets, accounts)
    .map(g => ({ ...g, pos: g.positions.find(p => p.symbol === symbol) }))
    .filter(g => g.pos);
  const myAlerts = alerts.filter(a => a.symbol === symbol);
  const ext = asset.source === 'finnhub' ? extendedPrice(asset) : null;
  const held = h && h.qty > 0;
  const sold = !held && h ? soldPositions([h], assets)[0] || null : null;

  // One account or all of them (only offered when it's held in several)
  const multi = byAcct.length > 1;
  const [scope, setScope] = useState(account !== undefined && account !== null ? account : 'all');
  const scoped = multi && scope !== 'all' ? byAcct.find(g => g.id === scope) : null;
  const v = scoped ? scoped.pos : h;          // numbers shown in the stats
  const scopeTx = scoped ? myTx.filter(t => (t.account || '') === scope) : myTx;

  const [manualPrice, setManualPrice] = useState(asset.price ? String(asset.price) : '');
  const [target, setTarget]       = useState(asset.targetPct != null ? String(asset.targetPct) : '');
  const [priceTarget, setPriceTarget] = useState(asset.priceTarget ? String(asset.priceTarget) : '');
  const [targetAlert, setTargetAlert] = useState(true);
  const [alertDir, setAlertDir]   = useState('above');
  const [alertPrice, setAlertPrice] = useState('');
  const [msg, setMsg]             = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const handleDeleteHolding = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    setMsg(null);
    try {
      await deleteHolding(symbol);
      onClose();
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Could not delete. Try again.' });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const run = async (fn, ok) => {
    setMsg(null);
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); }
    catch (e) { setMsg({ ok: false, text: e.message || 'Something went wrong.' }); }
  };

  const stat = (label, value, color = T.text) => (
    <div style={{ background: T.bg, borderRadius: 10, padding: '9px 11px' }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  return (
    <Modal title={symbol} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {asset.name && <div style={{ fontSize: 13, color: T.muted, marginTop: -12 }}>{asset.name}</div>}

        {multi && (
          <Chips
            small
            options={[...byAcct.map(g => ({ value: g.id, label: g.name })), { value: 'all', label: `All accounts (${byAcct.length})` }]}
            value={scoped ? scope : 'all'}
            onChange={setScope}
          />
        )}

        <StockChart
          symbol={symbol}
          priceHistory={priceHistory}
          livePrice={asset.source === 'finnhub' ? asset.price : null}
          hide={hide}
          refs={[
            held && { value: v.avgCost, label: 'Avg cost', color: T.muted },
            sold && { value: sold.avgSell, label: 'Sold at', color: T.khaki },
            asset.priceTarget && { value: asset.priceTarget, label: 'Target', color: '#5AC8FA' },
            asset.analyst?.targetMean && { value: asset.analyst.targetMean, label: 'Analysts', color: ANALYST_COLOR },
          ].filter(Boolean)}
          markers={[]}
          trades={tradeDetails(scoped ? scopeTx : txs, symbol, asset.price || null)}
          initialRange={sold && sold.date < new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10) ? '1y' : '6mo'}
        />

        {sold && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stat('Sold', `${qtyFmt(sold.qty)} @ ${money(sold.avgSell, hide)}`)}
            {stat('Sold on', formatShortDate(sold.date))}
            {stat(sold.realized >= 0 ? 'Gain' : 'Loss', `${signedMoney(sold.realized, hide)} (${pct(sold.realizedPct)})`, gainColor(sold.realized))}
            {stat('Since sold', pct(sold.sinceSell), gainColor(sold.sinceSell))}
            {sold.ifHeld !== null && stat(sold.ifHeld > 0 ? 'Missed by selling' : 'Saved by selling', money(Math.abs(sold.ifHeld), hide), sold.ifHeld > 0 ? T.red : T.green)}
            {sold.dividends > 0 && stat('Dividends', money(sold.dividends, hide), T.green)}
          </div>
        )}

        {held && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stat(scoped ? 'Shares' : multi ? 'Total shares' : 'Shares', qtyFmt(v.qty))}
            {stat('Avg cost / share', money(v.avgCost, hide))}
            {stat('Price', money(v.price, hide))}
            {stat(scoped || !multi ? 'Value' : 'Total value', money(v.value, hide))}
            {stat('Unrealized', `${signedMoney(v.unrealized, hide)} (${pct(v.unrealizedPct)})`, gainColor(v.unrealized))}
            {stat('Today', pct(v.dayPct), gainColor(v.dayPct))}
            {stat('Realized (sells)', signedMoney(v.realized, hide), gainColor(v.realized))}
            {stat('Dividends', money(v.dividends, hide), v.dividends > 0 ? T.green : T.text)}
          </div>
        )}

        {multi && !scoped && (
          <div>
            <SectionTitle>By account</SectionTitle>
            {byAcct.map(g => (
              <button key={g.id || 'none'} onClick={() => setScope(g.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ color: T.muted }}>{qtyFmt(g.pos.qty)} @ {money(g.pos.avgCost, hide)}</span>
                <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{money(g.pos.value, hide)}</span>
                <span style={{ color: gainColor(g.pos.unrealized), width: 58, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(g.pos.unrealizedPct)}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {['buy', 'sell', 'dividend'].map(t => (
            <button
              key={t}
              onClick={() => onTrade(t, symbol, scoped ? scope : undefined)}
              style={{ flex: 1, padding: 10, borderRadius: 10, background: t === 'buy' ? T.olive : T.subtle, color: '#fff', fontSize: 14, fontWeight: 600 }}
            >
              {t === 'buy' ? 'Buy' : t === 'sell' ? 'Sell' : 'Dividend'}
            </button>
          ))}
        </div>

        {asset.source === 'finnhub' && (
          <StockInfo symbol={symbol} price={asset.price} stockInfo={stockInfo} hide={hide} />
        )}

        <div>
          <SectionTitle>Price</SectionTitle>
          <Chips
            small
            value={asset.source || 'manual'}
            onChange={src => run(() => setAsset(symbol, { source: src }), src === 'finnhub' ? 'Will update automatically' : 'Switched to manual price')}
            options={[{ value: 'finnhub', label: 'Auto (live)' }, { value: 'manual', label: 'Manual' }]}
          />
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
            Updated {timeAgo(asset.priceUpdatedAt)}
            {asset.source === 'finnhub' && asset.priceProvider === 'yahoo' && ' · from Yahoo Finance — mutual funds get one price a day, published in the evening'}
          </div>
          {ext && (
            <div style={{ fontSize: 13, color: T.text, marginTop: 6 }}>
              {ext.label}: {money(ext.price, hide)} <span style={{ color: gainColor(ext.pct) }}>({pct(ext.pct)})</span>
              <span style={{ fontSize: 12, color: T.muted }}> · {new Date(ext.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
          {(asset.source || 'manual') === 'manual' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={manualPrice} onChange={e => setManualPrice(e.target.value)} inputMode="decimal" placeholder="Current price" style={inputStyle} />
              <button
                onClick={() => {
                  const p = parseFloat(manualPrice);
                  if (p > 0) run(() => setAsset(symbol, { price: p, prevClose: null, priceUpdatedAt: new Date().toISOString() }), 'Price saved');
                }}
                style={{ padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
              >Save</button>
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Price target</SectionTitle>
          {asset.priceTarget > 0 && asset.price > 0 && (
            <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>
              {money(asset.priceTarget, hide)} is{' '}
              <b style={{ color: '#5AC8FA' }}>{pct(asset.priceTarget / asset.price - 1)}</b> from today's {money(asset.price, hide)}
              {Math.abs(asset.priceTarget / asset.price - 1) < 0.005 && ' — target reached'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={priceTarget} onChange={e => setPriceTarget(e.target.value)} inputMode="decimal"
              placeholder={held ? 'Price you expect or would sell at' : 'Price you would buy at'} style={inputStyle}
            />
            <button
              onClick={() => {
                const v = priceTarget.trim() === '' ? null : parseFloat(priceTarget.replace(/[$,]/g, ''));
                if (v !== null && !(v > 0)) return;
                run(async () => {
                  await setAsset(symbol, { priceTarget: v });
                  if (v && targetAlert && asset.price) {
                    await addAlert(symbol, v >= asset.price ? 'above' : 'below', v);
                    await registerPushToken(userId);
                  }
                }, v === null ? 'Price target cleared' : targetAlert && asset.price ? 'Price target saved, with an alert' : 'Price target saved');
              }}
              style={{ padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
            >Save</button>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.muted, marginTop: 8 }}>
            <input type="checkbox" checked={targetAlert} onChange={e => setTargetAlert(e.target.checked)} />
            Also add a price alert for it
          </label>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Your own target — shown on the chart and in your lists.</div>
        </div>

        {held && <div>
          <SectionTitle>Target allocation</SectionTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" placeholder="e.g. 25 (% of portfolio)" style={inputStyle} />
            <button
              onClick={() => {
                const v = target.trim() === '' ? null : parseFloat(target);
                if (v === null || (v >= 0 && v <= 100)) run(() => setAsset(symbol, { targetPct: v }), v === null ? 'Target cleared' : 'Target saved');
              }}
              style={{ padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
            >Save</button>
          </div>
        </div>}

        <div>
          <SectionTitle>Price alerts</SectionTitle>
          {myAlerts.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: 14, color: a.enabled ? T.text : T.muted }}>
                {a.direction === 'above' ? '▲ Above' : '▼ Below'} {money(a.target)}
                {a.triggeredAt && <span style={{ fontSize: 11, color: T.khaki }}> · hit {formatShortDate(a.triggeredAt.slice(0, 10))}</span>}
              </span>
              <button onClick={() => run(() => toggleAlert(a.id, !a.enabled))} style={{ fontSize: 12, color: T.khaki }}>
                {a.enabled ? 'Pause' : 'Re-arm'}
              </button>
              <button onClick={() => run(() => deleteAlert(a.id))} style={{ fontSize: 16, color: T.subtle }} aria-label="Delete alert">×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <Chips small value={alertDir} onChange={setAlertDir} options={[{ value: 'above', label: 'Above' }, { value: 'below', label: 'Below' }]} />
            <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)} inputMode="decimal" placeholder="$ price" style={{ ...inputStyle, flex: 1 }} />
            <button
              onClick={() => {
                const p = parseFloat(alertPrice);
                if (!(p > 0)) return;
                run(async () => {
                  await addAlert(symbol, alertDir, p);
                  setAlertPrice('');
                  await registerPushToken(userId);
                }, 'Alert added');
              }}
              style={{ padding: '10px 14px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
            >Add</button>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
            Checked every 15 minutes, 4 AM–8 PM ET on market days (including pre-market and after hours){asset.source !== 'finnhub' ? ' — needs Auto (live) price' : ''}.
          </div>
        </div>

        {msg && <div style={{ fontSize: 13, color: msg.ok ? T.green : T.red }}>{msg.text}</div>}

        <div>
          <SectionTitle>Transactions</SectionTitle>
          <TxList txs={scopeTx} allTxs={txs} hide={hide} onDelete={id => run(() => deleteTx(id))} onUpdate={(id, f) => run(() => updateTx(id, f))} accounts={accounts} onSetAccount={(id, acc) => run(() => setTxAccount(id, acc))} />
        </div>

        {myTx.length > 0 && (
          <div>
            <button
              onClick={handleDeleteHolding}
              disabled={deleting}
              style={{
                width: '100%', padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 600,
                background: confirmDelete ? T.red : 'transparent', border: `1px solid ${T.red}`,
                color: confirmDelete ? '#fff' : T.red,
              }}
            >
              {deleting ? 'Deleting…' : confirmDelete ? `Tap again to delete ${symbol}` : `Delete ${symbol}`}
            </button>
            {confirmDelete && !deleting && (
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
                Removes all {myTx.length} {symbol} transaction{myTx.length !== 1 ? 's' : ''}{myAlerts.length ? ' and its price alerts' : ''}, as if you never added it.
                {' '}<button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, color: T.khaki, padding: 0 }}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
