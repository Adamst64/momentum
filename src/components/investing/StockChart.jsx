import React, { useEffect, useState } from 'react';
import { T } from '../../theme';
import { formatDateYear } from '../../utils/dateUtils';
import { money, signedMoney, pct, qtyFmt } from '../../utils/investing';
import { Chips, gainColor, noSelect, ConfirmDialog, inputStyle } from './ui';
import { ValueChart, NOTE_COLOR, DIV_COLOR } from './Charts';

const RANGES = [
  { value: 'i1d', label: '1D' },
  { value: 'i5d', label: '1W' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: 'ytd', label: 'YTD' },
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
    // YTD = the 1Y daily history from the last close of last year on (so the change is vs Dec 31)
    const ytd = range === 'ytd';
    priceHistory(symbol, ytd ? '1y' : range)
      .then(p => {
        if (!live) return;
        if (!ytd) return setPoints(p);
        const jan1 = `${new Date().getFullYear()}-01-01`;
        const i = p.findIndex(x => x.date >= jan1);
        setPoints(i < 0 ? p.slice(-1) : p.slice(Math.max(0, i - 1)));
      })
      .catch(e => live && setError(e.message || 'Could not load the chart'));
    return () => { live = false; };
  }, [symbol, range, priceHistory]);

  let pts = points || [];
  if (pts.length && livePrice) pts = [...pts.slice(0, -1), { ...pts[pts.length - 1], value: livePrice }];
  // Marks sit on the price of their day (or the next trading day)
  const noteDots = notes.map(n => {
    // A mark newer than the last candle (today before close, a weekend) sits on the latest point
    const last = pts[pts.length - 1];
    const pt = pts.find(p => p.date >= n.date) || (last && n.date > last.date ? last : null);
    return pt ? { ...n, id: `note:${n.id}`, noteId: n.id, type: 'note', date: pt.date, realDate: n.date, price: pt.value, priceThen: pt.value, priceNow: last.value } : null;
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
              {span.from.label || formatDateYear(span.from.date)} → {span.to.label || formatDateYear(span.to.date)} · {money(span.from.value, hide)} → {money(span.to.value, hide)}
            </div>
          </>
        ) : shown && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{money(shown.value, hide)}</div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {scrub ? scrub.label || formatDateYear(scrub.date) : 'Now'}
              {change !== null && shown !== first && (
                <span style={{ color: gainColor(change) }}> · {signedMoney(change, hide)} ({pct(change / first.value)}) since {first.label || formatDateYear(first.date)}</span>
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
        <MarkCard
          key={trade.id} mark={trade} now={livePrice || trade.priceNow} hide={hide}
          onClose={() => setTradeId(null)} onUpdate={onUpdateNote} onAskDelete={onDeleteNote && (() => setAskNote(trade))}
        />
      )}
      {askNote && (
        <ConfirmDialog
          title="Delete this mark?"
          message={`“${askNote.label}” on ${formatDateYear(askNote.realDate || askNote.date)} will be removed from the chart.`}
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
          {trades.length > 0 && <><span style={{ color: '#30D158', fontWeight: 700 }}>B</span> buys · <span style={{ color: '#FF9F0A', fontWeight: 700 }}>S</span> sells · {trades.some(t => t.reinvest) && <><span style={{ color: DIV_COLOR, fontWeight: 700 }}>D</span> dividends reinvested · </>}</>}
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
      {notes.length > 0 && (
        <MarksList
          symbol={symbol} notes={notes} priceHistory={priceHistory} now={livePrice || pts[pts.length - 1]?.value} hide={hide}
          onUpdate={onUpdateNote} onAskDelete={onDeleteNote && (n => setAskNote(n))}
        />
      )}
    </div>
  );
}

// One mark: move since that day, the note, edit / delete.
// mark: { noteId, label, date, realDate?, note, auto, priceThen }
function MarkCard({ mark, now, hide, onClose, onUpdate, onAskDelete, flat }) {
  const [editing, setEditing] = useState(null);
  const day = mark.realDate || mark.date;
  const then = mark.priceThen;
  const diff = now && then ? now - then : null;
  return (
    <div style={flat ? { padding: '2px 0 4px' } : { marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${NOTE_COLOR}55` }}>
      {!flat && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NOTE_COLOR, flex: 1, minWidth: 0 }}>★ {mark.label}</span>
          <button onClick={onClose} aria-label="Close" style={{ fontSize: 16, color: T.muted, padding: '0 2px' }}>×</button>
        </div>
      )}
      {diff !== null ? (
        <div style={{ marginTop: flat ? 2 : 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: gainColor(diff), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {pct(diff / then)} <span style={{ fontSize: 15, fontWeight: 700 }}>{signedMoney(diff, hide)}</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
            since {formatDateYear(day)} · {money(then, hide)} then → {money(now, hide)} now
          </div>
        </div>
      ) : !flat && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{formatDateYear(day)}</div>}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <input value={editing.label} onChange={e => setEditing(n => ({ ...n, label: e.target.value }))} placeholder="Mark name" style={inputStyle} />
          <input type="date" value={editing.date} max={new Date().toLocaleDateString('en-CA')} onChange={e => e.target.value && setEditing(n => ({ ...n, date: e.target.value }))} style={inputStyle} />
          <textarea value={editing.note} onChange={e => setEditing(n => ({ ...n, note: e.target.value }))} placeholder="Note" rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => { if (!editing.label.trim()) return; await onUpdate(mark.noteId, editing); setEditing(null); }}
              style={{ flex: 1, padding: 10, borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}
            >Save</button>
            <button onClick={() => setEditing(null)} style={{ padding: '10px 14px', color: T.muted, fontSize: 14 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {mark.note && (
            <div style={{ fontSize: 14, color: T.text, marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mark.note}</div>
          )}
          {mark.auto
            ? <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Added automatically from your watch list.</div>
            : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {onUpdate && <button onClick={() => setEditing({ label: mark.label, date: day, note: mark.note || '' })} style={{ fontSize: 12, fontWeight: 600, color: T.khaki, border: `1px solid ${T.khaki}55`, borderRadius: 8, padding: '5px 10px' }}>{mark.note ? 'Edit' : 'Edit / add a note'}</button>}
                {onAskDelete && <button onClick={onAskDelete} style={{ fontSize: 12, fontWeight: 600, color: T.red, border: `1px solid ${T.red}66`, borderRadius: 8, padding: '5px 10px' }}>Delete mark</button>}
              </div>
            )}
        </>
      )}
    </div>
  );
}

// Every mark on this stock, newest first, whatever range the chart shows.
// Prices for "since" come from daily 5-year history (monthly beyond that), loaded on first open.
function MarksList({ symbol, notes, priceHistory, now, hide, onUpdate, onAskDelete }) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [hist, setHist] = useState(null); // { daily, monthly }
  const oldest = notes.reduce((m, n) => (n.date < m ? n.date : m), notes[0].date);

  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const daily = await priceHistory(symbol, 'd5y').catch(() => []);
      const monthly = !daily.length || oldest < daily[0].date ? await priceHistory(symbol, 'max').catch(() => []) : [];
      if (live) setHist({ daily, monthly });
    })();
    return () => { live = false; };
  }, [open, symbol, priceHistory, oldest]);

  const priceOn = date => {
    if (!hist) return null;
    for (const pts of [hist.daily, hist.monthly]) {
      if (!pts.length || date < pts[0].date) continue;
      const pt = pts.find(p => p.date >= date) || pts[pts.length - 1];
      return pt.value;
    }
    return null;
  };

  const sorted = [...notes].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return (
    <div style={{ marginTop: 12, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', fontSize: 13, fontWeight: 700, color: T.text, padding: '4px 0' }}>
        <span style={{ color: NOTE_COLOR }}>★</span> All marks ({notes.length})
        <span style={{ marginLeft: 'auto', color: T.muted, fontSize: 12 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && sorted.map(n => {
        const then = priceOn(n.date);
        const move = then && now ? now / then - 1 : null;
        const expanded = openId === n.id;
        return (
          <div key={n.id} style={{ borderTop: `1px solid ${T.cardBorder}55`, padding: '8px 0' }}>
            <button onClick={() => setOpenId(expanded ? null : n.id)} style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'left' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>{n.label}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{formatDateYear(n.date)}{n.note && !expanded ? ' · has a note' : ''}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: move === null ? T.muted : gainColor(move), fontVariantNumeric: 'tabular-nums' }}>
                {move === null ? (hist ? '' : '…') : pct(move)}
              </span>
            </button>
            {expanded && (
              <MarkCard
                flat mark={{ ...n, noteId: n.id, priceThen: then }} now={now} hide={hide}
                onUpdate={onUpdate} onAskDelete={onAskDelete && (() => onAskDelete({ ...n, noteId: n.id }))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Details for one tapped buy or sell
function TradeCard({ t, hide, onClose, onDelete, onEdit }) {
  const buy = t.type === 'buy';
  const tint = t.reinvest ? DIV_COLOR : buy ? '#30D158' : '#FF9F0A';
  const row = (label, value, color = T.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: T.bg, border: `1px solid ${tint}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: tint }}>
          {t.reinvest ? 'Dividend reinvested' : buy ? (t.fromCash === false ? 'Added (already owned)' : 'Bought') : t.closedOut ? 'Sold (all)' : 'Sold'}
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
