import React, { useState } from 'react';
import Modal from '../Modal';
import { T } from '../../theme';
import { todayStr, toDateStr, formatDateYear, formatShortDate } from '../../utils/dateUtils';
import { money, parseAmount, centsToInput, nextRecurringDate, lookupCategory, BALANCE_CATEGORY } from '../../utils/budget';
import { genId } from '../../utils/id';
import { Card, SectionTitle, Field, Chips, PrimaryButton, ConfirmDialog, inputStyle } from '../investing/ui';

const OFTEN = [{ value: 1, label: 'Every month' }, { value: 3, label: 'Every 3 months' }];

// On a debit card / savings page: where pay comes in automatically.
// - Work tab pay (debit cards, one account at a time)
// - Repeating income, e.g. a salary on the 1st of every month or a quarterly bonus
export default function AccountExtras({ account, workEnabled, categories, onLinkWork, onSetRecurring }) {
  const [editing, setEditing] = useState(null); // null | 'new' | rule
  const [askUnlink, setAskUnlink] = useState(false);
  const rules = account.recurring || [];
  const today = todayStr();
  const linked = !!account.workLink?.since;

  return (
    <Card>
      <SectionTitle>Pay coming in</SectionTitle>

      {workEnabled && account.type === 'debit' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 10px', borderBottom: `1px solid ${T.cardBorder}` }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🛠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Work tab pay</div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
              {linked
                ? `Lands here when you mark a crew paid · since ${formatShortDate(toDateStr(new Date(account.workLink.since)))}`
                : 'Crew pay you mark as paid from now on goes to this card. Earlier pay is left out.'}
            </div>
          </div>
          <button
            onClick={() => (linked ? setAskUnlink(true) : onLinkWork(account.id))}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: linked ? '#2A3A1A' : T.bg, color: linked ? T.khaki : T.text, border: `1px solid ${linked ? T.olive : T.cardBorder}`,
            }}
          >{linked ? 'Linked ✓' : 'Link'}</button>
        </div>
      )}

      {rules.map(r => {
        const next = nextRecurringDate(r, today);
        const c = lookupCategory(categories, r.category || 'salary');
        return (
          <button key={r.id} onClick={() => setEditing(r)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
            <span style={{ fontSize: 20 }} aria-hidden="true">{c.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.text }}>{r.label || c.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: T.muted }}>
                {r.months === 3 ? 'Every 3 months' : 'Every month'}{next ? ` · next ${formatShortDate(next)}` : ''}
              </span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.green }}>+{money(r.amount)}</span>
          </button>
        );
      })}

      <button onClick={() => setEditing('new')} style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: T.khaki }}>
        + Add a repeating income (salary, bonus…)
      </button>

      {editing && (
        <RuleForm
          initial={editing === 'new' ? null : editing}
          categories={categories}
          onSave={rule => onSetRecurring(account.id, editing === 'new'
            ? [...rules, rule]
            : rules.map(x => (x.id === rule.id ? rule : x)))}
          onDelete={editing === 'new' ? null : () => onSetRecurring(account.id, rules.filter(x => x.id !== editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
      {askUnlink && (
        <ConfirmDialog
          title="Stop sending Work pay here?"
          message="Pay already added stays. New pay won't be added to any card until you link one again."
          confirmLabel="Unlink"
          onConfirm={() => onLinkWork(null)}
          onClose={() => setAskUnlink(false)}
        />
      )}
    </Card>
  );
}

function RuleForm({ initial, categories, onSave, onDelete, onClose }) {
  const cats = categories.filter(c => c.kind === 'income' && !c.hidden && c.id !== BALANCE_CATEGORY.id);
  const [label, setLabel] = useState(initial?.label || '');
  const [amount, setAmount] = useState(centsToInput(initial?.amount));
  const [months, setMonths] = useState(initial?.months || 1);
  const [start, setStart] = useState(initial?.start || todayStr());
  const [category, setCategory] = useState(initial?.category || 'salary');
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const cents = parseAmount(amount);
  const past = !initial && start < todayStr();

  const save = async () => {
    if (!cents || busy) return;
    setBusy(true);
    const rule = {
      id: initial?.id || genId(), label: label.trim(), amount: cents, months, start, category,
      // Edits apply from today on; a new rule fills in its past dates too
      ...(initial ? { from: todayStr() } : {}),
    };
    await onSave(rule);
    onClose();
  };

  return (
    <Modal title={initial ? 'Repeating income' : 'New repeating income'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Salary, Quarterly bonus" style={inputStyle} />
        </Field>
        <Field label="Amount each time">
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" style={{ ...inputStyle, fontSize: 22, fontWeight: 700, color: T.green }} />
        </Field>
        <Field label="How often">
          <Chips options={OFTEN} value={months} onChange={setMonths} small />
        </Field>
        <Field label={initial ? 'Paid on (same day each time)' : 'First payment'}>
          <input type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)} style={inputStyle} />
          {past && <span style={{ fontSize: 12, color: T.khaki }}>Payments from {formatDateYear(start)} up to today will be added too.</span>}
        </Field>
        <Field label="Category">
          <Chips small options={cats.map(c => ({ value: c.id, label: `${c.emoji} ${c.label}` }))} value={category} onChange={setCategory} />
        </Field>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
          Added automatically on each date. If one payment was different, tap it in the list and edit it.
          {initial && ' Changes apply from today; payments already added stay as they are.'}
        </div>
        <PrimaryButton onClick={save} disabled={!cents || busy}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
        {initial && (
          <button onClick={() => setAskDelete(true)} style={{ padding: 11, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.red, fontSize: 14 }}>
            Stop this income
          </button>
        )}
      </div>
      {askDelete && (
        <ConfirmDialog
          title="Stop this repeating income?"
          message="No new payments will be added. Payments already added stay."
          confirmLabel="Stop"
          onConfirm={async () => { await onDelete(); onClose(); }}
          onClose={() => setAskDelete(false)}
        />
      )}
    </Modal>
  );
}
