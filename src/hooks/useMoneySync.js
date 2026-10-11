import { useEffect } from 'react';
import { toDateStr, parseDate } from '../utils/dateUtils';
import { parsePayEntry } from '../utils/workUtils';

// Keeps the budget in step with the Work and Investing tabs:
// - Work pay: once a debit card is linked (workLink.since), every crew-week marked
//   paid after that moment becomes a Salary entry on that card, dated the day it was
//   marked paid. Marking it unpaid removes the entry; changing the amount updates it.
//   Pay marked paid before the link is ignored (it's already in the starting balance).
// - Investing: money moved between a bank account and investing is saved on both
//   sides; when the investing side is deleted, the budget side goes too.
export function useMoneySync(budget, work, investing) {
  const { loaded, txDocs, accounts, putSynced, removeSynced } = budget;

  useEffect(() => {
    if (!loaded || !work?.loaded) return;
    const linked = accounts.find(a => a.workLink?.since);
    const byId = Object.fromEntries(txDocs.map(t => [t.id, t]));
    const crewName = id => work.crews.find(c => c.id === id)?.name || 'Work';
    for (const w of work.weeks) {
      for (const [crewId, raw] of Object.entries(w)) {
        if (crewId === 'id') continue;
        const { paid, amount } = parsePayEntry(raw);
        const paidAt = raw?.paidAt;
        const id = `work-${w.id}-${crewId}`;
        const existing = byId[id];
        const cents = Math.round(amount * 100);
        if (paid && cents > 0 && paidAt && linked && paidAt >= linked.workLink.since) {
          if (!existing) {
            const crew = crewName(crewId);
            const week = parseDate(w.id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            putSynced(id, {
              type: 'income', amount: cents, date: toDateStr(new Date(paidAt)), accountId: linked.id, toAccountId: null,
              category: 'salary', note: `${crew} · week of ${week}`, source: 'work', crew, workWeek: w.id, workAmount: cents,
              createdAt: new Date().toISOString(),
            }).catch(() => {});
          } else if (!existing.deleted && existing.workAmount !== cents) {
            // The Work amount changed; a hand edit of the budget entry alone is left as is
            putSynced(id, { amount: cents, workAmount: cents }).catch(() => {});
          }
        } else if (existing?.source === 'work' && !existing.deleted && !paid) {
          removeSynced(id).catch(() => {});
        }
      }
    }
  }, [loaded, work?.loaded, work?.weeks, work?.crews, accounts, txDocs, putSynced, removeSynced]);

  useEffect(() => {
    if (!loaded || !investing?.txsLoaded) return;
    const refs = new Set(investing.txs.map(t => t.bankRef).filter(Boolean));
    for (const t of txDocs) {
      // Skip brand-new ones: the investing half may not have reached this device yet
      const fresh = Date.now() - new Date(t.createdAt || 0).getTime() < 5 * 60 * 1000;
      if (t.source === 'investing' && t.bankRef && !refs.has(t.bankRef) && !fresh) removeSynced(t.id).catch(() => {});
    }
  }, [loaded, investing?.txsLoaded, investing?.txs, txDocs, removeSynced]);
}
