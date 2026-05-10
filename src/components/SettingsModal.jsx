import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { T } from '../theme';
import { todayStr } from '../utils/dateUtils';

const TAB_NAMES = { routines: 'Routines', tasks: 'Tasks', work: 'Work', shopping: 'Shopping', birthdays: 'Birthdays' };

export default function SettingsModal({ user, onChangePassword, onSignOut, onClose, routines, tasks, shoppingLists, features, onUnlockFeature, tabOrder, setTabOrder, showWork }) {
  const [pwOpen, setPwOpen]         = useState(false);
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwStatus, setPwStatus]     = useState(null);
  const [pwLoading, setPwLoading]   = useState(false);

  const [featureCode, setFeatureCode]     = useState('');
  const [featureStatus, setFeatureStatus] = useState(null);

  const handleFeatureCode = async () => {
    const code = featureCode.trim().toUpperCase();
    if (code === 'RBA') {
      await onUnlockFeature('workTab');
      setFeatureCode('');
      setFeatureStatus({ ok: true, msg: 'Work tab unlocked!' });
    } else {
      setFeatureStatus({ ok: false, msg: 'Invalid code' });
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setPwStatus({ ok: false, msg: "New passwords don't match" }); return; }
    if (newPw.length < 6)   { setPwStatus({ ok: false, msg: 'Password must be at least 6 characters' }); return; }
    setPwLoading(true);
    setPwStatus(null);
    try {
      await onChangePassword(currentPw, newPw);
      setPwStatus({ ok: true, msg: 'Password updated' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) {
      const msg = (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
        ? 'Current password is incorrect' : e.message;
      setPwStatus({ ok: false, msg });
    } finally {
      setPwLoading(false);
    }
  };

  const handleExport = async () => {
    const shoppingExport = await Promise.all(
      (shoppingLists || []).map(async (list) => {
        const [itemsSnap, tagsSnap] = await Promise.all([
          getDocs(collection(db, 'lists', list.id, 'items')),
          getDocs(collection(db, 'lists', list.id, 'tags')),
        ]);
        return {
          id: list.id, name: list.name,
          items: itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          tags: tagsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        };
      })
    );

    const data = { exportedAt: new Date().toISOString(), version: 2, routines, tasks, shopping: shoppingExport };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `momentum-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: '20px 0 calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '88dvh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 20px' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Settings</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 22, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <Group>
          <Row
            label="Change Password"
            onTap={() => { setPwOpen(o => !o); setPwStatus(null); }}
            arrow
            arrowOpen={pwOpen}
          />
          {pwOpen && (
            <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PwInput placeholder="Current password" value={currentPw} onChange={setCurrentPw} />
              <PwInput placeholder="New password"     value={newPw}     onChange={setNewPw} />
              <PwInput placeholder="Confirm new password" value={confirmPw} onChange={setConfirmPw} />
              {pwStatus && (
                <div style={{ fontSize: 13, color: pwStatus.ok ? T.green : T.red, paddingLeft: 2 }}>{pwStatus.msg}</div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                style={{
                  padding: 12, borderRadius: 10, marginTop: 2,
                  background: (currentPw && newPw && confirmPw) ? T.olive : T.subtle,
                  color: '#fff', fontSize: 14, fontWeight: 600, transition: 'background 0.15s',
                }}
              >
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          )}
        </Group>

        <Group>
          <Row
            label="Export as JSON"
            detail={`${routines.length}r · ${tasks.length}t · ${(shoppingLists || []).length} lists`}
            onTap={handleExport}
          />
        </Group>

        {tabOrder && (
          <Group>
            <div style={{ padding: '12px 16px 4px', fontSize: 12, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Tab Order
            </div>
            {tabOrder.filter(id => id !== 'work' || showWork).map((id, i, arr) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 15, color: T.text }}>{TAB_NAMES[id]}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    disabled={i === 0}
                    onClick={() => {
                      const visible = tabOrder.filter(t => t !== 'work' || showWork);
                      const neighbor = visible[i - 1];
                      const newOrder = [...tabOrder];
                      const a = newOrder.indexOf(id), b = newOrder.indexOf(neighbor);
                      [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
                      setTabOrder(newOrder);
                    }}
                    style={{ width: 32, height: 32, borderRadius: 8, background: i === 0 ? 'transparent' : T.subtle, color: i === 0 ? T.cardBorder : T.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >↑</button>
                  <button
                    disabled={i === arr.length - 1}
                    onClick={() => {
                      const visible = tabOrder.filter(t => t !== 'work' || showWork);
                      const neighbor = visible[i + 1];
                      const newOrder = [...tabOrder];
                      const a = newOrder.indexOf(id), b = newOrder.indexOf(neighbor);
                      [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
                      setTabOrder(newOrder);
                    }}
                    style={{ width: 32, height: 32, borderRadius: 8, background: i === arr.length - 1 ? 'transparent' : T.subtle, color: i === arr.length - 1 ? T.cardBorder : T.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >↓</button>
                </div>
              </div>
            ))}
            <div style={{ height: 4 }} />
          </Group>
        )}

        <Group>
          {features?.workTab ? (
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, color: T.text }}>Work tab</span>
              <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Active ✓</span>
            </div>
          ) : (
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Feature code</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={featureCode}
                  onChange={e => { setFeatureCode(e.target.value); setFeatureStatus(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleFeatureCode()}
                  placeholder="Enter code…"
                  autoCapitalize="characters"
                  style={{ flex: 1, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '11px 14px', color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark' }}
                />
                <button
                  onClick={handleFeatureCode}
                  style={{ padding: '11px 16px', borderRadius: 10, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}
                >Apply</button>
              </div>
              {featureStatus && (
                <div style={{ fontSize: 13, color: featureStatus.ok ? T.green : T.red, marginTop: 8 }}>{featureStatus.msg}</div>
              )}
            </div>
          )}
        </Group>

        <div style={{ padding: '0 16px' }}>
          <button
            onClick={onSignOut}
            style={{
              width: '100%', padding: 13, borderRadius: 12,
              border: `1px solid ${T.cardBorder}`,
              color: T.red, fontSize: 15, fontWeight: 500, background: 'transparent',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Group({ children }) {
  return (
    <div style={{
      margin: '0 16px 12px', background: '#252527',
      borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.cardBorder}`,
    }}>
      {children}
    </div>
  );
}

function Row({ label, detail, onTap, arrow, arrowOpen }) {
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.cardBorder}`,
        color: T.text, fontSize: 15, background: 'transparent', textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {detail && <span style={{ fontSize: 12, color: T.muted }}>{detail}</span>}
        {arrow && (
          <span style={{
            color: T.muted, fontSize: 16,
            transform: arrowOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s', display: 'inline-block',
          }}>›</span>
        )}
      </span>
    </button>
  );
}

function PwInput({ placeholder, value, onChange }) {
  return (
    <input
      type="password"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '11px 14px', borderRadius: 10,
        background: T.bg, border: `1px solid ${T.cardBorder}`,
        color: T.text, fontSize: 15, outline: 'none', colorScheme: 'dark',
      }}
    />
  );
}

