import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { formatDateYear } from '../../utils/dateUtils';
import { money, signedMoney, pct, qtyFmt } from '../../utils/investing';
import { Chips, gainColor, noSelect, ConfirmDialog, inputStyle } from './ui';
import { ValueChart, NOTE_COLOR } from './Charts';

const RANGES = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y',  label: '1Y' },
  { value: '5y',  label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: 'max', label: 'Max' },
];

// Price chart for one stock (trading days only), with optional reference lines
// (avg cost, sell price, your target) and markers (when you sold).
// livePrice replaces the last close so the chart ends at the current quote.
// notes: your own marks [{ id, date, label, auto? }] (auto = from a watch list, not deletable here)
export default function StockChart({ symbol, priceHistory, livePrice, refs, markers, trades = [], onDeleteTrade, onEditTrade, notes = [], onAddNote, onUpdateNote, onDeleteNote, hide, initialRange = '6mo' }) {
  const [adding, setAdding] = useState(false);
  const [noteLabel, setNoteLabel] = useState('');
  const [noteText, setNoteText] = useState('');
  const [editingNote, setEditingNote] = useState(null); // { id, label, date, note } being edited
  const [noteDate, setNoteDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [askNote, setAskNote] = useState(null);
  const [askDelete, setAskDelete] = useState(null);
  const [range, setRange]   = useState(initialRange);
  const [points, setPoints] = useState(null);
  const [error, setError]   = useState(null);
  const [scrub, setScrub]   = useState(null);
  const [tradeId, setTradeId] = useState(null);
  const [span, setSpan]     = useState(null); // two-finger { from, to }

  useEffect(() => {
    let live = true;
    setPoints(null);
    setError(null);
    priceHistory(symbol, range)
      .then(p => live && setPoints(p))
      .catch(e => live && setError(e.message || 'Could not load the chart'));
    return () => { live = false; };
  }, [symbol, range, priceHistory]);

  let pts = points || [];
  if (pts.length && livePrice) pts = [...pts.slice(0, -1), { ...pts[pts.length - 1], value: livePrice }];
  // Marks sit on the price of their day (or the next trading day)
  const noteDots = notes.map(n => {
    const pt = pts.find(p => p.date >= n.date);
    return pt ? { ...n, id: `note:${n.id}`, noteId: n.id, type: 'note', price: pt.value, priceThen: pt.value, priceNow: pts[pts.length - 1]?.value } : null;
  }).filter(Boolean);
  const allDots = [...trades, ...noteDots];
  const trade = allDots.find(t => t.id === tradeId) || null;
  const first = pts[0];
  const shown = scrub || pts[pts.length - 1];
  const change = shown && first ? shown.value - first.value : null;

  return (
    <div style={noSelect}>
      <div style={{ minHeight: 38 }}>
        {span ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: gainColor(span.to.value - span.from.value), fontVariantNumeric: 'tabular-nums' }}>
              {signedMoney(span.to.value - span.from.value, hide)} ({pct(span.to.value / span.from.value - 1)})
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {formatDateYear(span.from.date)} → {formatDateYear(span.to.date)} · {money(span.from.value, hide)} → {money(span.to.value, hide)}
            </div>
          </>
        ) : shown && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{money(shown.value, hide)}</div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {scrub ? formatDateYear(scrub.date) : 'Now'}
              {change !== null && shown !== first && (
                <span style={{ color: gainColor(change) }}> · {signedMoney(change, hide)} ({pct(change / first.value)}) since {formatDateYear(first.date)}</span>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {error ? (
          <div style={{ fontSize: 13, color: T.muted, padding: '24px 0', textAlign: 'center' }}>Chart unavailable: {error}</div>
        ) : points === null ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: T.muted }}>Loading chart…</div>
        ) : (
          <ValueChart points={pts} hide={hide} onScrub={setScrub} onRange={setSpan} refs={refs} markers={markers} trades={allDots} selectedTrade={tradeId} onTradeTap={setTradeId} emptyText="No price history for this symbol." />
        )}
      </div>
      {trade?.type === 'note' && (
        <div key={trade.id} style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${NOTE_COLOR}55` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: NOTE_COLOR, flex: 1, minWidth: 0 }}>★ {trade.label}</span>
            <button onClick={() => { setTradeId(null); setEditingNote(null); }} aria-label="Close" style={{ fontSize: 16, color: T.muted, padding: '0 2px' }}>×</button>
          </div>
          {(() => {
            // How the stock moved from that day to right now (live price when there is one)
            const now = livePrice || trade.priceNow;
            const then = trade.priceThen;
            const diff = now && then ? now - then : null;
            return (
              <>
                {diff !== null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: gainColor(diff), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                      {pct(diff / then)} <span style={{ fontSize: 15, fontWeight: 700 }}>{signedMoney(diff, hide)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                      since {formatDateYear(trade.date)} · {money(then, hide)} then → {money(now, hide)} now
                    </div>
                  </div>
                )}
                {diff === null && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{formatDateYear(trade.date)}</div>}
              </>
            );
          })()}
          {editingNote?.id === trade.noteId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <input value={editingNote.label} onChange={e => setEditingNote(n => ({ ...n, label: e.target.value }))} placeholder="Mark name" style={inputStyle} />
              <input type="date" value={editingNote.date} max={new Date().toLocaleDateString('en-CA')} onChange={e => e.target.value && setEditingNote(n => ({ ...n, date: e.target.value }))} style={inputStyle} />
              <textarea value={editingNote.note} onChange={e => setEditingNote(n => ({ ...n, note: e.target.value }))} placeholder="Note" rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => { if (!editingNote.label.trim()) return; await onUpdateNote(editingNote.id, { label: editingNote.label, date: editingNote.date, note: editingNote.note }); setEditingNote(null); }}
                  style={{ flex: 1, padding: 10, borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}
                >Save</button>
                <button onClick={() => setEditingNote(null)} style={{ padding: '10px 14px', color: T.muted, fontSize: 14 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {trade.note && (
                <div style={{ fontSize: 14, color: T.text, marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{trade.note}</div>
              )}
              {trade.auto
                ? <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Added automatically from your watch list.</div>
                : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {onUpdateNote && <button onClick={() => setEditingNote({ id: trade.noteId, label: trade.label, date: trade.date, note: trade.note || '' })} style={{ fontSize: 12, fontWeight: 600, color: T.khaki, border: `1px solid ${T.khaki}55`, borderRadius: 8, padding: '5px 10px' }}>{trade.note ? 'Edit' : 'Edit / add a note'}</button>}
                    {onDeleteNote && <button onClick={() => setAskNote(trade)} style={{ fontSize: 12, fontWeight: 600, color: T.red, border: `1px solid ${T.red}66`, borderRadius: 8, padding: '5px 10px' }}>Delete mark</button>}
                  </div>
                )}
            </>
          )}
        </div>
      )}
      {askNote && (
        <ConfirmDialog
          title="Delete this mark?"
          message={`“${askNote.label}” on ${formatDateYear(askNote.date)} will be removed from the chart.`}
          onConfirm={async () => { await onDeleteNote(askNote.noteId); setTradeId(null); }}
          onClose={() => setAskNote(null)}
        />
      )}
      {trade && trade.type !== 'note' && <TradeCard key={trade.id} t={trade} hide={hide} onClose={() => setTradeId(null)} onDelete={onDeleteTrade && (() => setAskDelete(trade))} onEdit={onEditTrade && (() => { onEditTrade(trade.id); setTradeId(null); })} />}
      {askDelete && (
        <ConfirmDialog
          title="Delete this transaction?"
          message={`${askDelete.type === 'buy' ? 'Buy' : 'Sale'} of ${qtyFmt(askDelete.quantity)} ${symbol} at ${money(askDelete.price)} on ${formatDateYear(askDelete.date)} will be removed${askDelete.linkId ? ', with its linked fund trade' : ''}. This can't be undone.`}
          onConfirm={async () => { await onDeleteTrade(askDelete.id); setTradeId(null); }}
          onClose={() => setAskDelete(null)}
        />
      )}
      {!trade && allDots.length > 0 && points?.length > 1 && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
          {trades.length > 0 && <><span style={{ color: '#30D158', fontWeight: 700 }}>B</span> buys · <span style={{ color: '#FF9F0A', fontWeight: 700 }}>S</span> sells · </>}
          {noteDots.length > 0 && <><span style={{ color: NOTE_COLOR, fontWeight: 700 }}>★</span> your marks · </>}
          tap one for details · two fingers to compare dates
        </div>
      )}
      {onAddNote && (adding ? (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={noteLabel} onChange={e => setNoteLabel(e.target.value)} placeholder="Mark name, e.g. Started watching, Pelosi bought" autoFocus style={inputStyle} />
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Note (optional) — why it matters, what you read, what you expect…" rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={noteDate} max={new Date().toLocaleDateString('en-CA')} onChange={e => e.target.value && setNoteDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button
              onClick={async () => { if (!noteLabel.trim()) return; await onAddNote(noteDate, noteLabel, noteText); setNoteLabel(''); setNoteText(''); setAdding(false); }}
              style={{ padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}
            >Add</button>
            <button onClick={() => setAdding(false)} style={{ padding: '0 8px', color: T.muted, fontSize: 14 }}>Cancel</button>
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>Shows on this stock's chart as a ★ on that day. Pick a longer range (1Y, 5Y…) for older dates.</div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: NOTE_COLOR }}>★ Add a mark</button>
      ))}
      <div style={{ marginTop: 10 }}>
        <Chips small options={RANGES} value={range} onChange={v => { setRange(v); setScrub(null); }} />
      </div>
    </div>
  );
}

// Details for one tapped buy or sell
function TradeCard({ t, hide, onClose, onDelete, onEdit }) {
  const buy = t.type === 'buy';
  const row = (label, value, color = T.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${buy ? '#30D158' : '#FF9F0A'}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: buy ? '#30D158' : '#FF9F0A' }}>
          {buy ? (t.fromCash === false ? 'Added (already owned)' : 'Bought') : t.closedOut ? 'Sold (all)' : 'Sold'}
        </span>
        <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{formatDateYear(t.date)}</span>
        <button onClick={onClose} aria-label="Close" style={{ fontSize: 16, color: T.muted, padding: '0 2px' }}>×</button>
      </div>
      {row('Shares', `${qtyFmt(t.quantity)} @ ${money(t.price, hide)}`)}
      {t.fee ? row('Fee', money(t.fee, hide)) : null}
      {buy ? (
        <>
          {row('Total paid', money(t.total, hide))}
          {t.valueNow !== null && row('Worth today', money(t.valueNow, hide))}
          {t.gain !== null && row('Gain since', `${signedMoney(t.gain, hide)} (${pct(t.gainPct)})`, gainColor(t.gain))}
        </>
      ) : (
        <>
          {row('Received', money(t.proceeds, hide))}
          {row('Cost of those shares', `${money(t.basis, hide)} (avg ${money(t.avgCost, hide)})`)}
          {row(t.realized >= 0 ? 'Gain' : 'Loss', `${signedMoney(t.realized, hide)} (${pct(t.realizedPct)})`, gainColor(t.realized))}
          {t.sinceSell !== null && row('Price since', pct(t.sinceSell), gainColor(t.sinceSell))}
        </>
      )}
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {onEdit && <button onClick={onEdit} style={{ fontSize: 12, fontWeight: 600, color: T.khaki, border: `1px solid ${T.khaki}55`, borderRadius: 8, padding: '5px 10px' }}>Edit</button>}
          {onDelete && <button onClick={onDelete} style={{ fontSize: 12, fontWeight: 600, color: T.red, border: `1px solid ${T.red}66`, borderRadius: 8, padding: '5px 10px' }}>Delete</button>}
        </div>
      )}
    </div>
  );
}
