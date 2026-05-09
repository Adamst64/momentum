import React, { useState } from 'react';
import { T } from '../theme';

export default function AuthScreen({ onSignIn, onSignUp, onResetPassword }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        await onResetPassword(email);
        setResetSent(true);
      } else if (mode === 'signin') {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: T.bg,
      minHeight: '100dvh',
      maxWidth: 430,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Momentum</span>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive, marginTop: 2 }} />
        </div>
        <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>
          {mode === 'signin' ? 'Sign in to your account' : mode === 'signup' ? 'Create a new account' : 'Reset your password'}
        </p>
      </div>

      {mode === 'reset' && resetSent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: '#1A2410', border: `1px solid ${T.olive}44`,
            borderRadius: 12, padding: '16px',
            fontSize: 14, color: T.oliveLight, lineHeight: 1.6,
          }}>
            Reset link sent to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
          </div>
          <button
            onClick={() => { setMode('signin'); setResetSent(false); setError(''); }}
            style={{ padding: '14px', borderRadius: 12, background: T.olive, color: T.text, fontSize: 15, fontWeight: 700 }}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          {mode !== 'reset' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          {error && (
            <p style={{ color: T.red, fontSize: 13, margin: '4px 0 0' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8, padding: '14px', borderRadius: 12, border: 'none',
              background: T.olive, color: T.text, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => { setMode('reset'); setError(''); }}
              style={{ background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: '4px 0' }}
            >
              Forgot password?
            </button>
          )}
        </form>
      )}

      <button
        onClick={() => {
          setMode(m => m === 'signup' ? 'signin' : m === 'reset' ? 'signin' : 'signup');
          setError(''); setResetSent(false);
        }}
        style={{ marginTop: 20, background: 'none', border: 'none', color: T.muted, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
      >
        {mode === 'signup' ? 'Already have an account? Sign in' : mode === 'reset' ? 'Back to sign in' : "Don't have an account? Sign up"}
      </button>
    </div>
  );
}

const inputStyle = {
  padding: '14px 16px',
  borderRadius: 12,
  border: `1px solid #2C2C2E`,
  background: '#1C1C1E',
  color: '#F5F0E8',
  fontSize: 15,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
