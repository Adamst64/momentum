import React, { useState, useEffect } from 'react';
import { T } from '../theme';

const inputStyle = {
  padding: '14px 16px', borderRadius: 12,
  border: '1px solid #2C2C2E', background: '#1C1C1E',
  color: '#F5F0E8', fontSize: 15, outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

export default function ResetPasswordScreen({ oobCode, verifyResetCode, applyPasswordReset }) {
  const [status, setStatus]     = useState('verifying'); // verifying | ready | success | invalid
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    verifyResetCode(oobCode)
      .then(e => { setEmail(e); setStatus('ready'); })
      .catch(() => setStatus('invalid'));
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await applyPasswordReset(oobCode, password);
      window.history.replaceState({}, '', window.location.pathname);
      setStatus('success');
    } catch (err) {
      setError(err.code === 'auth/expired-action-code' || err.code === 'auth/invalid-action-code'
        ? 'This link has expired. Please request a new password reset.'
        : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: T.bg, minHeight: '100dvh', maxWidth: 430,
      margin: '0 auto', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '0 24px',
    }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Momentum</span>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive, marginTop: 2 }} />
        </div>
        <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Set new password</p>
      </div>

      {status === 'verifying' && (
        <div style={{ color: T.muted, fontSize: 14, textAlign: 'center' }}>Verifying link…</div>
      )}

      {status === 'invalid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: '#2A0D0D', border: `1px solid ${T.red}44`,
            borderRadius: 12, padding: 16, fontSize: 14, color: T.red, lineHeight: 1.6,
          }}>
            This reset link has expired or already been used. Please request a new one.
          </div>
          <button
            onClick={() => window.history.replaceState({}, '', window.location.pathname) || window.location.reload()}
            style={{ padding: 14, borderRadius: 12, background: T.olive, color: T.text, fontSize: 15, fontWeight: 700 }}
          >Back to Sign In</button>
        </div>
      )}

      {status === 'ready' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>
            Resetting password for <strong style={{ color: T.text }}>{email}</strong>
          </div>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={inputStyle}
          />
          {error && <p style={{ color: T.red, fontSize: 13, margin: '4px 0 0' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || !confirm}
            style={{
              marginTop: 8, padding: 14, borderRadius: 12,
              background: password && confirm ? T.olive : T.subtle,
              color: password && confirm ? T.text : T.muted,
              fontSize: 15, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}
          >{loading ? 'Saving…' : 'Set New Password'}</button>
        </form>
      )}

      {status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: '#1A2410', border: `1px solid ${T.olive}44`,
            borderRadius: 12, padding: 16, fontSize: 14, color: T.oliveLight, lineHeight: 1.6,
          }}>
            Password updated successfully. You can now sign in with your new password.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: 14, borderRadius: 12, background: T.olive, color: T.text, fontSize: 15, fontWeight: 700 }}
          >Sign In</button>
        </div>
      )}
    </div>
  );
}
