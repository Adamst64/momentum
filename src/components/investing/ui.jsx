import React from 'react';
import { T } from '../../theme';
import Modal from '../Modal';

// Allocation colors: validated categorical palette for the dark card surface
// (adjacent-pair CVD ΔE ≥ 8.4). Assigned by first-purchase order, never by rank.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
export const OTHER_COLOR = '#5A5A5E';

export const gainColor = n => (n === null || n === undefined || Math.abs(n) < 1e-9 ? T.muted : n > 0 ? T.green : T.red);

// For anything you touch-and-drag (charts and their headlines): no iOS text
// selection, no long-press callout, no grey tap flash
export const noSelect = {
  userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
};

export const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 10,
  background: T.bg, border: `1px solid ${T.cardBorder}`,
  color: T.text, fontSize: 16, outline: 'none', colorScheme: 'dark',
};

export function Card({ children, style }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</span>
      {right}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
      {children}
    </label>
  );
}

export function Chips({ options, value, onChange, small }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: small ? '5px 10px' : '7px 12px', borderRadius: 16,
              background: on ? '#2A3A1A' : T.bg, border: `1px solid ${on ? T.olive : T.cardBorder}`,
              color: on ? T.khaki : T.muted, fontSize: small ? 12 : 13, fontWeight: on ? 600 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 600, color: '#fff',
        background: disabled ? T.subtle : danger ? T.red : T.olive,
      }}
    >
      {children}
    </button>
  );
}

// "Are you sure?" sheet for anything that deletes. Opens on top of other sheets.
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try { await onConfirm(); onClose(); }
    catch (e) { setErr(e.message || 'Something went wrong. Try again.'); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {message && <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>{message}</div>}
        {err && <div style={{ fontSize: 13, color: T.red }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: T.subtle, color: T.text, fontSize: 15, fontWeight: 600 }}>Cancel</button>
          <button onClick={go} disabled={busy} style={{ flex: 1, padding: 13, borderRadius: 12, background: T.red, color: '#fff', fontSize: 15, fontWeight: 700 }}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
