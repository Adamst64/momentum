import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { formatShortDate } from '../../utils/dateUtils';
import { money, signedMoney, pct, qtyFmt, sortTx } from '../../utils/investing';
import { Chips, inputStyle, gainColor, SectionTitle } from './ui';
import { registerPushToken } from '../../utils/pushNotifications';
import StockInfo from './StockInfo';

const timeAgo = iso => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return formatShortDate(iso.slice(0, 10));
};

export function TxList({ txs, hide, onDelete }) {
  const [confirm, setConfirm] = useState(null);
  if (!txs.length) return <div style={{ fontSize: 13, color: T.muted }}>No transactions yet.</div>;
  const describe = t => {
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
            <div style={{ fontSize: 11, color: T.muted }}>{formatShortDate(t.date)} · {t.date.slice(0, 4)}{t.fee ? ` · fee ${money(t.fee, hide)}` : ''}</div>
          </div>
          <span style={{ fontSize: 13, color: amount(t) >= 0 ? T.green : T.text, fontVariantNumeric: 'tabular-nums' }}>
            {signedMoney(amount(t), hide)}
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

export default function HoldingModal({ hook, symbol, hide, userId, onTrade, onClose }) {
  const { portfolio, assets, txs, alerts, setAsset, deleteTx, addAlert, toggleAlert, deleteAlert, stockInfo } = hook;
  const h = [...portfolio.holdings, ...portfolio.closed].find(x => x.symbol === symbol);
  const asset = assets[symbol] || {};
  const myTx = txs.filter(t => t.symbol === symbol);
  const myAlerts = alerts.filter(a => a.symbol === symbol);

  const [manualPrice, setManualPrice] = useState(asset.price ? String(asset.price) : '');
  const [target, setTarget]       = useState(asset.targetPct != null ? String(asset.targetPct) : '');
  const [alertDir, setAlertDir]   = useState('above');
  const [alertPrice, setAlertPrice] = useState('');
  const [msg, setMsg]             = useState(null);

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

        {h && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {stat('Shares', qtyFmt(h.qty))}
            {stat('Avg cost / share', money(h.avgCost, hide))}
            {stat('Price', money(h.price, hide))}
            {stat('Value', money(h.value, hide))}
            {stat('Unrealized', `${signedMoney(h.unrealized, hide)} (${pct(h.unrealizedPct)})`, gainColor(h.unrealized))}
            {stat('Today', pct(h.dayPct), gainColor(h.dayPct))}
            {stat('Realized (sells)', signedMoney(h.realized, hide), gainColor(h.realized))}
            {stat('Dividends', money(h.dividends, hide), h.dividends > 0 ? T.green : T.text)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {['buy', 'sell', 'dividend'].map(t => (
            <button
              key={t}
              onClick={() => onTrade(t, symbol)}
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
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>Updated {timeAgo(asset.priceUpdatedAt)}</div>
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
        </div>

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
            Checked every 15 minutes during US market hours{asset.source !== 'finnhub' ? ' — needs Auto (live) price' : ''}.
          </div>
        </div>

        {msg && <div style={{ fontSize: 13, color: msg.ok ? T.green : T.red }}>{msg.text}</div>}

        <div>
          <SectionTitle>Transactions</SectionTitle>
          <TxList txs={myTx} hide={hide} onDelete={id => run(() => deleteTx(id))} />
        </div>
      </div>
    </Modal>
  );
}
