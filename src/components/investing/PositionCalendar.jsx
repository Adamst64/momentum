import React, { useState } from 'react';
import { T } from '../../theme';
import { formatDateYear, todayStr } from '../../utils/dateUtils';
import { genId } from '../../utils/id';
import { Chips, ConfirmDialog, inputStyle } from './ui';

export const EVENT_KINDS = [
  { value: 'earnings', label: 'Earnings', color: '#FFD60A' },
  { value: 'dividend', label: 'Dividend', color: '#BF5AF2' },
  { value: 'other',    label: 'Other',    color: '#5AC8FA' },
];
const kindOf = k => EVENT_KINDS.find(x => x.value === k) || EVENT_KINDS[2];
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = n => String(n).padStart(2, '0');

// Every date to watch for one stock: your own (earnings call, ex-dividend day,
// product launch…) plus the next earnings report when it's known automatically.
// A month calendar with a dot on each, and the list of what's coming.
export function stockEvents(asset) {
  const own = (asset?.events || []).map(e => ({ ...e, own: true }));
  const auto = asset?.nextEarnings?.date && !own.some(e => e.kind === 'earnings' && e.date === asset.nextEarnings.date)
    ? [{ id: 'auto-earnings', date: asset.nextEarnings.date, label: 'Earnings report', kind: 'earnings', auto: true }]
    : [];
  return [...own, ...auto].sort((a, b) => a.date.localeCompare(b.date));
}

export default function PositionCalendar({ symbol, asset, onSave }) {
  const today = todayStr();
  const events = stockEvents(asset);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(null);       // a day tapped on the calendar
  const [form, setForm] = useState(null);           // { id?, date, label, kind, note }
  const [ask, setAsk] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const byDay = {};
  events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const shift = n => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); setPicked(null); };

  const upcoming = events.filter(e => e.date >= today);
  const past = events.filter(e => e.date < today).reverse();
  const shown = picked ? events.filter(e => e.date === picked) : upcoming;

  const save = async () => {
    if (!form?.label.trim() || !form.date || busy) return;
    setBusy(true);
    const own = asset?.events || [];
    const item = { id: form.id || genId(), date: form.date, label: form.label.trim(), kind: form.kind, ...(form.note?.trim() ? { note: form.note.trim() } : {}) };
    await onSave(form.id ? own.map(e => (e.id === form.id ? item : e)) : [...own, item]);
    setBusy(false);
    setForm(null);
    setMonth(item.date.slice(0, 7));
  };

  const row = e => {
    const k = kindOf(e.kind);
    const daysAway = Math.round((new Date(e.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5);
    const when = daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : daysAway > 0 ? `in ${daysAway} days` : `${-daysAway} days ago`;
    return (
      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${T.cardBorder}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: k.color, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{e.label}</span>
          <span style={{ display: 'block', fontSize: 12, color: T.muted }}>
            {formatDateYear(e.date)} · {when}{e.auto ? ' · from the earnings calendar' : ''}
          </span>
          {e.note && <span style={{ display: 'block', fontSize: 12, color: T.text, marginTop: 2, whiteSpace: 'pre-wrap' }}>{e.note}</span>}
        </span>
        {e.own && (
          <>
            <button onClick={() => setForm({ ...e, note: e.note || '' })} style={{ fontSize: 12, color: T.khaki, fontWeight: 600 }}>Edit</button>
            <button onClick={() => setAsk(e)} aria-label="Delete" style={{ fontSize: 16, color: T.muted, padding: '0 4px' }}>×</button>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: T.bg, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1 }}>📅 {symbol} calendar</span>
        <button onClick={() => shift(-1)} aria-label="Previous month" style={{ color: T.khaki, fontSize: 18, padding: '0 8px' }}>‹</button>
        <span style={{ fontSize: 13, color: T.text, minWidth: 92, textAlign: 'center' }}>
          {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button onClick={() => shift(1)} aria-label="Next month" style={{ color: T.khaki, fontSize: 18, padding: '0 8px' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {WEEK.map((d, i) => <span key={i} style={{ fontSize: 10, color: T.muted, padding: '2px 0' }}>{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const ds = `${month}-${pad(i + 1)}`;
          const evs = byDay[ds] || [];
          const isToday = ds === today, on = picked === ds;
          return (
            <button key={ds} onClick={() => setPicked(on ? null : ds)}
              style={{ padding: '5px 0 4px', borderRadius: 8, background: on ? '#2A3A1A' : 'transparent', border: `1px solid ${isToday ? T.olive : 'transparent'}` }}>
              <span style={{ display: 'block', fontSize: 12, color: ds < today ? T.muted : T.text, fontWeight: evs.length ? 700 : 400 }}>{i + 1}</span>
              <span style={{ display: 'flex', justifyContent: 'center', gap: 2, height: 5, marginTop: 2 }}>
                {evs.slice(0, 3).map(e => <span key={e.id} style={{ width: 5, height: 5, borderRadius: 3, background: kindOf(e.kind).color }} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
            {picked ? formatDateYear(picked) : 'Coming up'}
          </span>
          {!form && (
            <button onClick={() => setForm({ date: picked && picked >= today ? picked : today, label: '', kind: 'earnings', note: '' })}
              style={{ fontSize: 13, fontWeight: 600, color: T.khaki }}>+ Add date</button>
          )}
        </div>
        {form && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
            <Chips small options={EVENT_KINDS.map(k => ({ value: k.value, label: k.label }))} value={form.kind}
              onChange={k => setForm(f => ({ ...f, kind: k, label: f.label || (k === 'earnings' ? 'Earnings report' : k === 'dividend' ? 'Ex-dividend date' : '') }))} />
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="What's happening, e.g. Earnings report, Investor day" style={inputStyle} />
            <input type="date" value={form.date} onChange={e => e.target.value && setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={!form.label.trim() || busy}
                style={{ flex: 1, padding: 10, borderRadius: 10, background: form.label.trim() ? T.olive : T.subtle, color: '#fff', fontSize: 14, fontWeight: 600 }}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setForm(null)} style={{ padding: '10px 14px', color: T.muted, fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        )}
        {shown.map(row)}
        {!shown.length && !form && (
          <div style={{ fontSize: 12, color: T.muted, padding: '6px 0' }}>
            {picked ? 'Nothing on this day.' : 'Nothing coming up. Add an earnings date, ex-dividend day or anything you want to remember.'}
          </div>
        )}
        {!picked && past.length > 0 && (
          <>
            <button onClick={() => setShowPast(v => !v)} style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
              {showPast ? 'Hide' : 'Show'} past dates ({past.length}) {showPast ? '▴' : '▾'}
            </button>
            {showPast && past.map(row)}
          </>
        )}
      </div>

      {ask && (
        <ConfirmDialog
          title="Delete this date?"
          message={`"${ask.label}" on ${formatDateYear(ask.date)} will be removed from ${symbol}'s calendar.`}
          onConfirm={() => onSave((asset?.events || []).filter(e => e.id !== ask.id))}
          onClose={() => setAsk(null)}
        />
      )}
    </div>
  );
}
