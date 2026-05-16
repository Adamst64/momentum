import React, { useState, useMemo } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { DAYS_SHORT, DAYS_FULL, getDOW, todayStr, addDays, formatShortDate } from '../../utils/dateUtils';

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none',
};

function CountStepper({ value, onChange, min = 1, max = 10 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 32, height: 32, borderRadius: '8px 0 0 8px',
          background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
          color: value <= min ? T.subtle : T.text, fontSize: 18, lineHeight: 1,
        }}
      >−</button>
      <div style={{
        width: 36, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0F0F', borderTop: `1px solid ${T.cardBorder}`, borderBottom: `1px solid ${T.cardBorder}`,
        fontSize: 15, fontWeight: 600, color: T.text,
      }}>{value}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 32, height: 32, borderRadius: '0 8px 8px 0',
          background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
          color: value >= max ? T.subtle : T.text, fontSize: 18, lineHeight: 1,
        }}
      >+</button>
    </div>
  );
}

export default function CreateRoutineModal({ initial, onSave, onClose }) {
  const [name,             setName]             = useState(initial?.name || '');
  const [days,             setDays]             = useState(initial?.days || [1, 2, 3, 4, 5]);
  const [timesPerDay,      setTimesPerDay]      = useState(initial?.timesPerDay || 1);
  const [timesPerDayByDow, setTimesPerDayByDow] = useState(initial?.timesPerDayByDow || {});
  const [showPast,         setShowPast]         = useState(false);
  const [startDate,        setStartDate]        = useState('');
  const [pastCompletions,  setPastCompletions]  = useState({});

  const yesterday = addDays(todayStr(), -1);

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handleSetTimesPerDay = (val) => {
    setTimesPerDay(val);
    if (val === 1) setTimesPerDayByDow({});
  };

  const setDowOverride = (dow, value) => {
    setTimesPerDayByDow(prev => {
      const next = { ...prev };
      if (value === timesPerDay) delete next[String(dow)];
      else next[String(dow)] = value;
      return next;
    });
  };

  const getRequiredForDow = (dow) =>
    timesPerDayByDow[String(dow)] ?? timesPerDay;

  // All scheduled days from startDate to yesterday, newest first
  const pastDays = useMemo(() => {
    if (!showPast || !startDate || startDate > yesterday) return [];
    const result = [];
    let d = new Date(startDate + 'T12:00:00');
    const end = new Date(yesterday + 'T12:00:00');
    while (d <= end) {
      const ds  = d.toISOString().slice(0, 10);
      const dow = getDOW(ds);
      if (days.includes(dow)) result.push(ds);
      d.setDate(d.getDate() + 1);
    }
    return result.reverse();
  }, [showPast, startDate, days, yesterday]);

  const markAllDone = () => {
    const next = { ...pastCompletions };
    pastDays.forEach(ds => { next[ds] = getRequiredForDow(getDOW(ds)); });
    setPastCompletions(next);
  };

  const clearAll = () => {
    const next = { ...pastCompletions };
    pastDays.forEach(ds => delete next[ds]);
    setPastCompletions(next);
  };

  const setPastCount = (ds, val) => {
    setPastCompletions(prev => {
      const next = { ...prev };
      if (val === 0) delete next[ds];
      else next[ds] = val;
      return next;
    });
  };

  const save = () => {
    if (!name.trim() || days.length === 0) return;
    const byDow = Object.fromEntries(
      Object.entries(timesPerDayByDow).filter(([dow]) => days.includes(Number(dow)))
    );
    const useStartDate = showPast && startDate && startDate <= yesterday ? startDate : null;
    onSave(name.trim(), days, timesPerDay, byDow, useStartDate, showPast ? pastCompletions : {});
    onClose();
  };

  const sortedDays = [...days].sort((a, b) => a - b);

  return (
    <Modal title={initial ? 'Edit Routine' : 'New Routine'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          style={inputStyle}
          placeholder="Routine name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />

        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Repeat on
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DAYS_SHORT.map((label, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    background: on ? T.olive : '#0F0F0F',
                    border: `1px solid ${on ? T.olive : T.cardBorder}`,
                    color: on ? '#fff' : T.muted,
                    fontSize: 12, fontWeight: on ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: T.muted }}>Times per day</span>
          <div style={{ marginLeft: 'auto' }}>
            <CountStepper value={timesPerDay} onChange={handleSetTimesPerDay} />
          </div>
        </div>

        {timesPerDay > 1 && sortedDays.length > 0 && (
          <div style={{
            background: '#0F0F0F', border: `1px solid ${T.cardBorder}`,
            borderRadius: 10, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Override per day
            </div>
            {sortedDays.map(dow => {
              const val = timesPerDayByDow[String(dow)] ?? timesPerDay;
              return (
                <div key={dow} style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: val !== timesPerDay ? T.khaki : T.text, minWidth: 90 }}>
                    {DAYS_FULL[dow]}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    <CountStepper value={val} onChange={v => setDowOverride(dow, v)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Past progress section — only for new routines */}
        {!initial && (
          <div>
            <button
              type="button"
              onClick={() => setShowPast(p => !p)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: showPast ? '#1A2410' : '#0F0F0F',
                border: `1px solid ${showPast ? T.olive : T.cardBorder}`,
                color: showPast ? T.oliveLight : T.muted,
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>Add past progress</span>
              <span style={{ fontSize: 16 }}>{showPast ? '▾' : '▸'}</span>
            </button>

            {showPast && (
              <div style={{
                marginTop: 8, background: '#0F0F0F',
                border: `1px solid ${T.cardBorder}`, borderRadius: 10,
                padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>Started on</span>
                  <input
                    type="date"
                    value={startDate}
                    max={yesterday}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8,
                      background: '#1A1A1C', border: `1px solid ${T.cardBorder}`,
                      color: T.text, colorScheme: 'dark', fontSize: 14,
                    }}
                  />
                </div>

                {pastDays.length > 0 && (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={markAllDone}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: '#2A3A1A', color: T.oliveLight, border: `1px solid ${T.olive}40`,
                        }}
                      >Mark all done</button>
                      <button
                        type="button"
                        onClick={clearAll}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: T.subtle, color: T.muted, border: 'none',
                        }}
                      >Clear all</button>
                    </div>

                    <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pastDays.map(ds => {
                        const dow      = getDOW(ds);
                        const required = getRequiredForDow(dow);
                        const val      = pastCompletions[ds] ?? 0;
                        const done     = val >= required;
                        const partial  = val > 0 && !done;
                        return (
                          <div key={ds} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 12, flex: 1,
                              color: done ? T.oliveLight : partial ? '#FF9F0A' : T.muted,
                            }}>
                              {DAYS_SHORT[dow]} {formatShortDate(ds)}
                            </span>
                            {required === 1 ? (
                              <button
                                type="button"
                                onClick={() => setPastCount(ds, val === 1 ? 0 : 1)}
                                style={{
                                  width: 28, height: 28, borderRadius: 8,
                                  border: `2px solid ${done ? T.olive : T.subtle}`,
                                  background: done ? T.olive : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {done && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <CountStepper
                                value={val}
                                min={0}
                                max={required}
                                onChange={v => setPastCount(ds, v)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: 11, color: T.subtle, textAlign: 'center' }}>
                      {pastDays.length} scheduled day{pastDays.length !== 1 ? 's' : ''}
                    </div>
                  </>
                )}

                {showPast && startDate && pastDays.length === 0 && startDate <= yesterday && days.length > 0 && (
                  <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: '8px 0' }}>
                    No scheduled days in that range
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          style={{
            width: '100%', padding: 14, borderRadius: 12,
            background: name.trim() && days.length ? T.olive : T.subtle,
            color: name.trim() && days.length ? '#fff' : T.muted,
            fontSize: 16, fontWeight: 600,
            transition: 'background 0.2s',
          }}
        >
          {initial ? 'Save Changes' : 'Add Routine'}
        </button>
      </div>
    </Modal>
  );
}
