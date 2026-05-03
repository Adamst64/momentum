import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { T } from '../theme';
import { todayStr } from '../utils/dateUtils';

export default function SettingsModal({ user, onChangePassword, onSignOut, onClose, routines, tasks, shopping }) {
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwStatus, setPwStatus]     = useState(null);
  const [pwLoading, setPwLoading]   = useState(false);

  const [importConfirm, setImportConfirm] = useState(null);
  const [importStatus, setImportStatus]   = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileRef = useRef(null);

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

  const handleExport = () => {
    const data = { exportedAt: new Date().toISOString(), version: 1, routines, tasks, shopping };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `momentum-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed.routines) || !Array.isArray(parsed.tasks)) throw new Error();
        setImportConfirm(parsed);
        setImportStatus(null);
      } catch {
        setImportStatus({ ok: false, msg: 'Invalid file — must be a Momentum export' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importConfirm || !user) return;
    setImportLoading(true);
    setImportStatus(null);
    try {
      const uid = user.uid;
      for (const col of ['routines', 'tasks', 'shopping']) {
        const snap = await getDocs(collection(db, 'users', uid, col));
        await runBatch(snap.docs.map(d => b => b.delete(d.ref)));
      }
      await runBatch([
        ...(importConfirm.routines  || []).map(item => b => b.set(doc(db, 'users', uid, 'routines',  item.id), item)),
        ...(importConfirm.tasks     || []).map(item => b => b.set(doc(db, 'users', uid, 'tasks',     item.id), item)),
        ...(importConfirm.shopping  || []).map(item => b => b.set(doc(db, 'users', uid, 'shopping',  item.id), item)),
      ]);
      setImportStatus({ ok: true, msg: 'Import successful' });
      setImportConfirm(null);
    } catch (e) {
      setImportStatus({ ok: false, msg: 'Import failed: ' + e.message });
    } finally {
      setImportLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.card,
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '85dvh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Settings</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 22, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        {/* Change password */}
        <div>
          <SectionLabel>Account</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                padding: 12, borderRadius: 10,
                background: (currentPw && newPw && confirmPw) ? T.olive : T.subtle,
                color: '#fff', fontSize: 14, fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Export / Import */}
        <div>
          <SectionLabel>Data</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleExport}
              style={{
                padding: '13px 14px', borderRadius: 10, textAlign: 'left',
                border: `1px solid ${T.cardBorder}`,
                color: T.text, fontSize: 14, fontWeight: 500, background: 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>Export as JSON</span>
              <span style={{ color: T.muted, fontSize: 12 }}>
                {routines.length}r · {tasks.length}t · {shopping.length}s
              </span>
            </button>

            <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} />

            {!importConfirm ? (
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '13px 14px', borderRadius: 10, textAlign: 'left',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.text, fontSize: 14, fontWeight: 500, background: 'transparent',
                }}
              >
                Import from JSON
              </button>
            ) : (
              <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${T.red}55`, background: `${T.red}11` }}>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
                  Replace all current data with:
                  <span style={{ color: T.text, marginLeft: 6 }}>
                    {importConfirm.routines?.length || 0} routines · {importConfirm.tasks?.length || 0} tasks · {importConfirm.shopping?.length || 0} shopping items
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setImportConfirm(null); setImportStatus(null); }}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 13, background: 'transparent' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importLoading}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: T.red, color: '#fff', fontSize: 13, fontWeight: 600 }}
                  >
                    {importLoading ? 'Importing…' : 'Replace & Import'}
                  </button>
                </div>
              </div>
            )}

            {importStatus && (
              <div style={{ fontSize: 13, color: importStatus.ok ? T.green : T.red, paddingLeft: 2 }}>{importStatus.msg}</div>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          style={{
            padding: 13, borderRadius: 12,
            border: `1px solid ${T.cardBorder}`,
            color: T.red, fontSize: 15, fontWeight: 500, background: 'transparent',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>,
    document.body
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
      {children}
    </div>
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

async function runBatch(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op(batch));
    await batch.commit();
  }
}
