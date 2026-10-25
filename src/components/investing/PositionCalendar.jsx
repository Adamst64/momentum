import React, { useRef, useState } from 'react';
import { T } from '../../theme';
import { formatDateYear, todayStr } from '../../utils/dateUtils';
import { genId } from '../../utils/id';
import { Chips, ConfirmDialog, inputStyle } from './ui';

export const EVENT_KINDS = [
  { value: 'earnings', label: 'Earnings' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'other',    label: 'Other' },
];
// Colored by who added it: your own dates green, automatic ones (Yahoo Finance
// and the earnings calendar) yellow, market-wide ones (Fed, CPI, jobs) blue
export const OWN_COLOR = '#30D158';
export const AUTO_COLOR = '#FFD60A';
export const MARKET_COLOR = '#5AC8FA';
export const POLITICIAN_COLOR = '#BF5AF2';
export const INSIDER_COLOR = '#FF9F0A';
export const colorOf = e => (e.own ? OWN_COLOR : e.kind === 'market' ? MARKET_COLOR : e.kind === 'politician' ? POLITICIAN_COLOR : e.kind === 'insider' ? INSIDER_COLOR : AUTO_COLOR);
const KIND_NAMES = { market: 'Market', insider: 'Insider trade', politician: 'Politician trade', filing: 'SEC filing', news: 'News' };
const kindLabel = k => KIND_NAMES[k] || (EVENT_KINDS.find(x => x.value === k) || EVENT_KINDS[2]).label;

// 🔔 on an event: tap to be notified 9 AM the business day before and 8 AM on the day (see useInvesting)
export function EventBell({ hook, event, symbol }) {
  if (!hook?.addEventAlert || !event?.date || event.date < todayStr()) return null;
  const e = { ...event, symbol: event.kind === 'market' ? null : symbol };
  const on = hook.eventAlertFor(e);
  return (
    <button
      onClick={ev => { ev.stopPropagation(); if (on) hook.removeEventAlert(on.id); else hook.addEventAlert(e); }}
      aria-label={on ? 'Stop the reminders' : 'Notify me the business day before and on the day'}
      style={{ flexShrink: 0, width: 34, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: on ? '#2A3A1A' : 'transparent', border: `1px solid ${on ? T.olive : T.cardBorder}` }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? T.khaki : 'none'}>
        <path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0" stroke={on ? T.khaki : T.muted} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = n => String(n).padStart(2, '0');

// Every date to watch for one stock: your own (earnings call, investor day,
// product launch…) plus the automatic ones (earnings reports, dividends, splits)
// the server fetches daily. An automatic date you also added yourself shows once.
// A month calendar with a dot on each, and the list of what's coming.
export function stockEvents(asset) {
  const own = (asset?.events || []).map(e => ({ ...e, own: true }));
  const near = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 6 * 864e5;
  const fetched = (asset?.autoEvents || []).map(e => ({ ...e, auto: true }));
  // Before the first daily fetch: the next earnings date already known
  const ne = asset?.nextEarnings?.date;
  if (ne && !fetched.some(e => e.kind === 'earnings' && near(e.date, ne))) {
    fetched.push({ id: 'auto-earnings', date: ne, label: 'Earnings report', kind: 'earnings', auto: true });
  }
  const auto = fetched.filter(a => !own.some(o => o.kind === a.kind && o.date === a.date));
  return [...own, ...auto].sort((a, b) => a.date.localeCompare(b.date));
}

export default function PositionCalendar({ symbol, asset, onSave, hook, market = [], startOpen = false }) {
  const today = todayStr();
  // The stock's own dates plus the market-wide ones (Fed, CPI, jobs report)
  const events = [...stockEvents(asset), ...market.map((m, i) => ({ ...m, id: `mkt-${m.date}-${i}`, auto: true }))]
    .sort((a, b) => a.date.localeCompare(b.date));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(null);       // a day tapped on the calendar
  const [form, setForm] = useState(null);           // { id?, date, label, kind, note }
  const [ask, setAsk] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(startOpen);      // folded unless opened from a notification
  const swipe = useRef(null);

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
    const daysAway = Math.round((new Date(e.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5);
    const when = daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : daysAway > 0 ? `in ${daysAway} days` : `${-daysAway} days ago`;
    return (
      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${T.cardBorder}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: colorOf(e), flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{e.label}</span>
          <span style={{ display: 'block', fontSize: 12, color: T.muted }}>
            {formatDateYear(e.date)} · {when} · {kindLabel(e.kind)}{e.auto ? ' · automatic' : ''}
          </span>
          {e.note && <span style={{ display: 'block', fontSize: 12, color: T.text, marginTop: 2, whiteSpace: 'pre-wrap' }}>{e.note}</span>}
          {(e.details || []).map(d => <span key={d} style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 1 }}>{d}</span>)}
          {/^https:\/\//.test(e.url || '') && <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 12, color: T.khaki, marginTop: 3 }}>Open the report ↗</a>}
        </span>
        <EventBell hook={hook} event={e} symbol={symbol} />
        {e.own && (
          <>
            <button onClick={() => setForm({ ...e, note: e.note || '' })} style={{ fontSize: 12, color: T.khaki, fontWeight: 600 }}>Edit</button>
            <button onClick={() => setAsk(e)} aria-label="Delete" style={{ fontSize: 16, color: T.muted, padding: '0 4px' }}>×</button>
          </>
        )}
      </div>
    );
  };

  const nextUp = upcoming[0];
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: T.bg, borderRadius: 12, padding: '11px 12px' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>📅 Calendar</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nextUp ? `${nextUp.label} · ${formatDateYear(nextUp.date)}` : 'Nothing coming up'}
        </span>
        <span style={{ color: T.muted, fontSize: 12 }}>▾</span>
      </button>
    );
  }

  return (
    <div style={{ background: T.bg, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <button onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1, textAlign: 'left' }}>📅 {symbol} calendar <span style={{ color: T.muted, fontSize: 12 }}>▴</span></button>
        <button onClick={() => shift(-1)} aria-label="Previous month" style={{ color: T.khaki, fontSize: 18, padding: '0 8px' }}>‹</button>
        <span style={{ fontSize: 13, color: T.text, minWidth: 92, textAlign: 'center' }}>
          {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button onClick={() => shift(1)} aria-label="Next month" style={{ color: T.khaki, fontSize: 18, padding: '0 8px' }}>›</button>
      </div>
      {/* Swipe left / right to change month (the app's swipe-back stays out of it) */}
      <div
        data-no-swipe-back
        onTouchStart={e => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={e => {
          const s0 = swipe.current; swipe.current = null;
          if (!s0) return;
          const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', touchAction: 'pan-y' }}
      >
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
                {evs.slice(0, 3).map(e => <span key={e.id} style={{ width: 5, height: 5, borderRadius: 3, background: colorOf(e) }} />)}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: T.muted, padding: '4px 0 6px' }}>
          <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: OWN_COLOR, marginRight: 5 }} />Yours</span>
          <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: AUTO_COLOR, marginRight: 5 }} />This stock</span>
          <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: MARKET_COLOR, marginRight: 5 }} />Market (Fed, CPI, jobs)</span>
          <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: INSIDER_COLOR, marginRight: 5 }} />Insiders</span>
          <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: POLITICIAN_COLOR, marginRight: 5 }} />Politicians</span>
        </div>
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
