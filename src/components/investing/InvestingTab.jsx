import React, { useState, useMemo } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { toDateStr } from '../../utils/dateUtils';
import { isMarketDay, priceDate } from '../../utils/marketCalendar';
import { money, signedMoney, pct, qtyFmt, periodReturn, monthlyFlows, cashInterestYear, benchmarkReturn, sectorBreakdown, PERIODS, CASH_ID, BENCHMARK, extendedPrice } from '../../utils/investing';
import { earningsLabel } from './StockInfo';
import { Card, SectionTitle, Chips, inputStyle, gainColor } from './ui';
import { ValueChart, AllocationDonut, AllocationLegend, allocationSlices, MonthlyFlows, Performers } from './Charts';
import TxModal from './TxModal';
import SymbolInput from './SymbolInput';
import HoldingModal, { TxList } from './HoldingModal';

const HIDE_KEY = 'momentum_hide_amounts';
const readHide = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const writeHide = v => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ } };

const VIEWS = [
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'activity',  label: 'Activity' },
  { value: 'insights',  label: 'Insights' },
  { value: 'watchlist', label: 'Watchlist' },
];

export default function InvestingTab({ hook, userId }) {
  const { txs, portfolio, assets, snapshots, cashTarget, refreshPrices, deleteTx, updateTx, setAsset } = hook;
  const [view, setView]       = useState('portfolio');
  const [period, setPeriod]   = useState('ALL');
  const [hide, setHide]       = useState(readHide);
  const [trade, setTrade]     = useState(null);  // { type, symbol }
  const [open, setOpen]       = useState(null);  // symbol
  const [targetFor, setTargetFor] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);

  const toggleHide = () => { setHide(h => { writeHide(!h); return !h; }); };

  const today = toDateStr(new Date());
  const ret = useMemo(() => periodReturn(txs, snapshots, portfolio.value, period, today), [txs, snapshots, portfolio.value, period, today]);

  // Chart: saved daily values in the selected period, plus "now". Only market
  // days, so weekends and holidays don't show up as flat stretches. "Now" stands
  // in for the session current prices belong to (the last one when closed).
  const chartPoints = useMemo(() => {
    const p = PERIODS.find(x => x.key === period);
    const start = p.start ? p.start(today) : '0000';
    const nowDate = priceDate();
    const pts = snapshots
      .filter(s => s.date > start && s.date < nowDate && isMarketDay(s.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    return txs.length ? [...pts, { date: nowDate, value: portfolio.value, label: 'Now' }] : [];
  }, [snapshots, period, today, portfolio.value, txs.length]);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await refreshPrices();
      const n = Object.keys(res.prices || {}).length;
      setUpdateMsg({ ok: true, text: n ? `Updated ${n} price${n !== 1 ? 's' : ''}` : 'Nothing to update yet' });
    } catch (e) {
      setUpdateMsg({ ok: false, text: e.message || 'Could not update prices' });
    } finally {
      setUpdating(false);
    }
  };

  const bench = ret && !ret.unavailable ? benchmarkReturn(snapshots, ret.start, assets[BENCHMARK]?.price) : null;

  // Holdings reporting earnings in the coming weeks
  const upcoming = portfolio.holdings
    .map(h => ({ symbol: h.symbol, next: assets[h.symbol]?.nextEarnings }))
    .filter(x => x.next && x.next.date >= today)
    .sort((a, b) => a.next.date.localeCompare(b.next.date));

  const lastUpdate = Object.values(assets).map(a => a.priceUpdatedAt).filter(Boolean).sort().pop();
  const slices = allocationSlices(portfolio, assets, cashTarget);
  const sliceColor = Object.fromEntries(slices.map(x => [x.key, x.color]));
  const slicePct = Object.fromEntries(slices.map(x => [x.key, x.pct]));
  const allocTotal = slices.reduce((t, x) => t + x.value, 0);
  // Most underweight holding (by target %), at least 2 pts and $1 short
  const nextBuy = slices
    .filter(x => x.key !== 'cash' && x.key !== 'other' && x.target !== null && x.target !== undefined)
    .map(x => ({ symbol: x.key, target: x.target, under: x.target - x.pct * 100, amount: (x.target / 100) * allocTotal - x.value }))
    .filter(x => x.under >= 2 && x.amount >= 1)
    .sort((a, b) => b.under - a.under)[0] || null;
  const watch = Object.values(assets).filter(a => a.watch && !portfolio.holdings.some(h => h.symbol === a.symbol));

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: T.muted }}>Total value</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: T.text, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
              {money(portfolio.value, hide)}
            </div>
            <div style={{ fontSize: 13, color: gainColor(portfolio.dayChange), marginTop: 2 }}>
              {signedMoney(portfolio.dayChange, hide)} today
            </div>
            {portfolio.ext && (
              <div style={{ fontSize: 12, color: gainColor(portfolio.ext.change), marginTop: 1 }}>
                {signedMoney(portfolio.ext.change, hide)} {portfolio.ext.label.toLowerCase()}
              </div>
            )}
          </div>
          <button onClick={toggleHide} aria-label={hide ? 'Show amounts' : 'Hide amounts'} style={{ padding: 6 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={T.olive} strokeWidth="1.8" />
              <circle cx="12" cy="12" r="3" stroke={T.olive} strokeWidth="1.8" />
              {hide && <path d="M4 4l16 16" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <MiniStat label="Free cash" value={money(portfolio.cash, hide)} />
          <MiniStat label="Invested" value={money(portfolio.holdingsValue, hide)} />
          <MiniStat label="All-time gain" value={signedMoney(portfolio.totalGain, hide)} color={gainColor(portfolio.totalGain)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <button
            onClick={handleUpdate}
            disabled={updating}
            style={{ padding: '9px 14px', borderRadius: 10, background: '#2A3A1A', border: `1px solid ${T.olive}`, color: T.khaki, fontSize: 13, fontWeight: 600 }}
          >
            {updating ? 'Updating…' : '↻ Update prices'}
          </button>
          <span style={{ fontSize: 11, color: updateMsg ? (updateMsg.ok ? T.green : T.red) : T.muted }}>
            {updateMsg ? updateMsg.text : lastUpdate ? `Last: ${new Date(lastUpdate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
          </span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8 }}>
        {[['buy', 'Buy'], ['sell', 'Sell'], ['deposit', '+ Cash']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTrade({ type: t })}
            style={{ flex: 1, padding: 11, borderRadius: 12, background: t === 'buy' ? T.olive : T.subtle, color: '#fff', fontSize: 14, fontWeight: 600 }}
          >
            {label}
          </button>
        ))}
      </div>

      <Chips options={VIEWS} value={view} onChange={setView} />

      {txs.length === 0 && view !== 'watchlist' && (
        <div style={{ textAlign: 'center', color: T.muted, fontSize: 14, padding: '24px 12px', lineHeight: 1.5 }}>
          Already own some stocks? Tap <b style={{ color: T.text }}>Buy</b> and pick <b style={{ color: T.text }}>Already owned</b> — free cash isn't touched.
          For new money (like a paycheck) use <b style={{ color: T.text }}>+ Cash</b>, then <b style={{ color: T.text }}>Buy</b> from free cash. Past trades are fine — just pick their real date.
        </div>
      )}

      {view === 'portfolio' && txs.length > 0 && (
        <>
          <Card>
            <SectionTitle>Return</SectionTitle>
            <Chips small options={PERIODS.map(p => ({ value: p.key, label: p.label }))} value={period} onChange={setPeriod} />
            <div style={{ marginTop: 12 }}>
              {ret?.unavailable ? (
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                  Not enough history for this period yet{ret.trackingSince ? ` (values saved since ${ret.trackingSince})` : ''}. It fills in as daily values are saved.
                </div>
              ) : ret && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: gainColor(ret.gain) }}>{pct(ret.pct)}</span>
                  <span style={{ fontSize: 14, color: gainColor(ret.gain) }}>{signedMoney(ret.gain, hide)}</span>
                </div>
              )}
              {ret && !ret.unavailable && (
                <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
                  S&P 500 same period:{' '}
                  {bench !== null
                    ? <span style={{ color: gainColor(bench), fontWeight: 600 }}>{pct(bench)}</span>
                    : <span>not enough history yet</span>}
                  {bench !== null && ret.pct !== null && (
                    <span> · you're {ret.pct >= bench ? 'ahead' : 'behind'} by {Math.abs((ret.pct - bench) * 100).toFixed(2)} pts</span>
                  )}
                </div>
              )}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Excludes cash you added or withdrew — only how your money performed.</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <ValueChart points={chartPoints} hide={hide} />
            </div>
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <SectionTitle>Upcoming earnings</SectionTitle>
              {upcoming.map(u => (
                <button key={u.symbol} onClick={() => setOpen(u.symbol)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 0', fontSize: 14 }}>
                  <span style={{ color: T.text, fontWeight: 700 }}>{u.symbol}</span>
                  <span style={{ color: u.next.date <= toDateStr(new Date(Date.now() + 7 * 864e5)) ? T.khaki : T.muted, fontSize: 13 }}>{earningsLabel(u.next)}</span>
                </button>
              ))}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>You'll get a reminder the evening before (with notifications on).</div>
            </Card>
          )}

          <Card style={{ padding: '6px 16px' }}>
            {portfolio.holdings.length === 0 && <div style={{ fontSize: 13, color: T.muted, padding: '10px 0' }}>No holdings yet.</div>}
            {portfolio.holdings.map((h, i) => (
              <button
                key={h.symbol}
                onClick={() => setOpen(h.symbol)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none', textAlign: 'left' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {sliceColor[h.symbol] && <span style={{ width: 8, height: 8, borderRadius: 2, background: sliceColor[h.symbol], flexShrink: 0 }} />}
                    {h.symbol}
                    {h.source === 'manual' && <span style={{ fontSize: 10, color: T.muted, fontWeight: 400, marginLeft: 6 }}>manual</span>}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {qtyFmt(h.qty)} × avg {money(h.avgCost, hide)}
                    {slices.length > 1 && slicePct[h.symbol] ? ` · ${(slicePct[h.symbol] * 100).toFixed(0)}%` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>{money(h.value, hide)}</div>
                  <div style={{ fontSize: 12, color: gainColor(h.unrealized) }}>
                    {pct(h.unrealizedPct)}{h.dayPct !== null && <span style={{ color: gainColor(h.dayPct) }}> · {pct(h.dayPct)} today</span>}
                  </div>
                  {h.ext && <div style={{ fontSize: 11, color: gainColor(h.ext.pct) }}>{h.ext.label} {pct(h.ext.pct)}</div>}
                </div>
              </button>
            ))}
          </Card>

          {slices.length > 0 && (
            <Card>
              <SectionTitle>Allocation</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <AllocationDonut slices={slices} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AllocationLegend slices={slices} onEditTarget={setTargetFor} />
                </div>
              </div>
              {nextBuy ? (
                <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: '#2A2616', border: '1px solid #5A5130' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Next buy idea</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
                    {nextBuy.symbol} is {nextBuy.under.toFixed(1)} pts under its {nextBuy.target}% target — about {money(nextBuy.amount, hide)} more would get it there.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
                  {slices.some(x => x.target !== null && x.target !== undefined) ? 'Everything is close to its target.' : 'Tap “set target” on a holding to get buy suggestions.'}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {view === 'activity' && txs.length > 0 && (
        <Card>
          <SectionTitle right={
            <span style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setTrade({ type: 'interest' })} style={{ fontSize: 12, color: T.khaki }}>+ Interest</button>
              <button onClick={() => setTrade({ type: 'dividend' })} style={{ fontSize: 12, color: T.khaki }}>+ Dividend</button>
            </span>
          }>
            All transactions
          </SectionTitle>
          <TxList txs={txs} hide={hide} onDelete={deleteTx} onUpdate={updateTx} />
          {portfolio.closed.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12, color: T.muted }}>
              Fully sold: {portfolio.closed.map(c => `${c.symbol} (${signedMoney(c.realized + c.dividends, hide)})`).join(', ')}
            </div>
          )}
        </Card>
      )}

      {view === 'insights' && txs.length > 0 && (
        <>
          <Card>
            <SectionTitle>Allocation</SectionTitle>
            {slices.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted }}>Nothing allocated yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><AllocationDonut slices={slices} /></div>
                <AllocationLegend slices={slices} onEditTarget={setTargetFor} />
              </div>
            )}
            <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Tap “set target” to choose your own target %. Drift shows how far off you are.</div>
          </Card>

          <Card>
            <SectionTitle>Sectors</SectionTitle>
            {(() => {
              const sectors = sectorBreakdown(portfolio.holdings, assets);
              if (!sectors.length) return <div style={{ fontSize: 13, color: T.muted }}>No priced holdings yet.</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {sectors.map(s => (
                    <div key={s.sector}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: T.text }}>{s.sector}</span>
                        <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{(s.pct * 100).toFixed(1)}%{!hide && <span style={{ color: T.muted }}> · {money(s.value)}</span>}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: T.bg }}>
                        <div style={{ height: 6, borderRadius: 3, width: `${Math.max(2, s.pct * 100)}%`, background: '#3987e5' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: T.muted }}>Share of invested money (cash excluded). ETFs are grouped since the free data plan doesn't break them down.</div>
                </div>
              );
            })()}
          </Card>

          <Card>
            <SectionTitle>Top & bottom performers</SectionTitle>
            <Performers holdings={portfolio.holdings} hide={hide} onOpen={setOpen} />
          </Card>

          <Card>
            <SectionTitle>Monthly: deposited vs invested</SectionTitle>
            <MonthlyFlows months={monthlyFlows(txs)} hide={hide} />
          </Card>

          <Card>
            <SectionTitle>Totals</SectionTitle>
            <TotalRow label="Money added (net)" value={money(portfolio.netDeposits, hide)} />
            <TotalRow label="Realized gains (sells)" value={signedMoney(portfolio.realized, hide)} color={gainColor(portfolio.realized)} />
            <TotalRow label="Dividends received" value={money(portfolio.dividends, hide)} />
            <TotalRow label="Interest on cash" value={money(portfolio.interest, hide)} />
            {(() => {
              const y = cashInterestYear(txs, portfolio.cash);
              return y.total > 0 && (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                  {money(y.total, hide)} in the last 12 months{y.approxYield !== null ? ` · roughly ${(y.approxYield * 100).toFixed(1)}% a year on today's cash` : ''}
                </div>
              );
            })()}
            <TotalRow label="Unrealized gains" value={signedMoney(portfolio.holdings.reduce((a, h) => a + (h.unrealized || 0), 0), hide)} />
          </Card>
        </>
      )}

      {view === 'watchlist' && (
        <Watchlist hook={hook} items={watch} hide={hide} onOpen={setOpen} />
      )}

      {trade && <TxModal hook={hook} initialType={trade.type} initialSymbol={trade.symbol || ''} onClose={() => setTrade(null)} />}
      {open && (
        <HoldingModal
          hook={hook} symbol={open} hide={hide} userId={userId}
          onTrade={(type, symbol) => { setOpen(null); setTrade({ type, symbol }); }}
          onClose={() => setOpen(null)}
        />
      )}
      {targetFor && (
        <TargetModal
          label={targetFor === 'cash' ? 'Cash' : targetFor}
          initial={targetFor === 'cash' ? cashTarget : assets[targetFor]?.targetPct}
          onSave={v => setAsset(targetFor === 'cash' ? CASH_ID : targetFor, { targetPct: v })}
          onClose={() => setTargetFor(null)}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, color = T.text }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: T.bg, borderRadius: 10, padding: '8px 8px' }}>
      <div style={{ fontSize: 10, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2, letterSpacing: -0.2, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function TotalRow({ label, value, color = T.text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function TargetModal({ label, initial, onSave, onClose }) {
  const [v, setV] = useState(initial != null ? String(initial) : '');
  const [err, setErr] = useState(null);
  const save = async (val) => {
    try { await onSave(val); onClose(); } catch (e) { setErr(e.message || 'Could not save'); }
  };
  return (
    <Modal title={`Target for ${label}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" placeholder="% of portfolio, e.g. 25" autoFocus style={inputStyle} />
        {err && <div style={{ fontSize: 13, color: T.red }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => save(null)} style={{ flex: 1, padding: 12, borderRadius: 12, background: T.subtle, color: T.text, fontSize: 14 }}>Clear</button>
          <button
            onClick={() => { const n = parseFloat(v); if (n >= 0 && n <= 100) save(n); else setErr('Enter a number from 0 to 100'); }}
            style={{ flex: 2, padding: 12, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}
          >Save</button>
        </div>
      </div>
    </Modal>
  );
}

function Watchlist({ hook, items, hide, onOpen }) {
  const { setAsset, removeAsset, refreshPrices } = hook;
  const [sym, setSym] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const add = async () => {
    const s = sym.trim().toUpperCase();
    if (!s || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshPrices([s]);
      if (res.notFound?.includes(s)) { setMsg(`Couldn't find a price for ${s}. Check the ticker.`); return; }
      await setAsset(s, { watch: true });
      setSym('');
    } catch (e) {
      setMsg(e.message || 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Watchlist</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SymbolInput hook={hook} value={sym} onChange={setSym} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Ticker or company, e.g. NVDA" />
        </div>
        <button onClick={add} disabled={busy} style={{ height: 44, padding: '0 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14 }}>{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: T.red, marginBottom: 8 }}>{msg}</div>}
      {items.length === 0 && <div style={{ fontSize: 13, color: T.muted }}>Track stocks you don't own yet. Prices refresh with “Update prices”.</div>}
      {items.map((a, i) => {
        const day = a.price && a.prevClose ? (a.price - a.prevClose) / a.prevClose : null;
        const ext = extendedPrice(a);
        return (
          <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${T.cardBorder}` : 'none' }}>
            <button onClick={() => onOpen(a.symbol)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{a.symbol}</div>
              {a.name && <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>}
            </button>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ fontSize: 14, color: T.text }}>{money(a.price, hide)}</div>
              <div style={{ fontSize: 12, color: gainColor(day) }}>{pct(day)}</div>
              {ext && <div style={{ fontSize: 11, color: gainColor(ext.pct) }}>{ext.label} {pct(ext.pct)}</div>}
            </div>
            <button onClick={() => removeAsset(a.symbol)} aria-label={`Remove ${a.symbol}`} style={{ fontSize: 16, color: T.subtle }}>×</button>
          </div>
        );
      })}
    </Card>
  );
}
