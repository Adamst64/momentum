import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme';

export default function ShareSheet({ list, userId, onClose, onJoin, onLeaveOrDelete, onRegenerate, onRename }) {
  const [joinCode, setJoinCode]   = useState('');
  const [joining, setJoining]     = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied]       = useState(false);
  const [renaming, setRenaming]   = useState(false);
  const [newName, setNewName]     = useState(list?.name || '');

  const isOwner = list?.ownerId === userId;

  const copyCode = () => {
    navigator.clipboard.writeText(list.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError('');
    try {
      const result = await onJoin(joinCode.trim());
      if (result?.alreadyMember) setJoinError('You are already a member of this list');
      else onClose();
    } catch (err) {
      setJoinError(err.message || 'Invalid invite code');
    } finally {
      setJoining(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: T.card, borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Manage List</span>
          <button onClick={onClose} style={{ color: T.muted, fontSize: 24, padding: '0 4px', background: 'none', border: 'none', lineHeight: 1 }}>×</button>
        </div>

        {renaming ? (
          <div style={{ marginBottom: 14 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onRename(newName); setRenaming(false); } }}
              autoFocus
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
                background: T.bg, border: `1px solid ${T.olive}`, color: T.text,
                fontSize: 15, outline: 'none', marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenaming(false)} style={{
                flex: 1, padding: '9px', borderRadius: 8, background: 'transparent',
                border: `1px solid ${T.cardBorder}`, color: T.muted, fontSize: 14,
              }}>Cancel</button>
              <button onClick={() => { onRename(newName); setRenaming(false); }} disabled={!newName.trim()} style={{
                flex: 1, padding: '9px', borderRadius: 8,
                background: newName.trim() ? T.olive : T.subtle, color: T.text, fontSize: 14, fontWeight: 600,
              }}>Save</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRenaming(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 14px', borderRadius: 10, marginBottom: 14,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
          }}>
            <span style={{ fontSize: 15, color: T.text }}>{list?.name}</span>
            <span style={{ color: T.muted, fontSize: 13 }}>Rename ✎</span>
          </button>
        )}

        <div style={{ background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Invite Code
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 5, color: T.khaki, flex: 1 }}>
              {list?.inviteCode}
            </span>
            <button onClick={copyCode} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: copied ? '#1A2410' : T.subtle, color: copied ? T.oliveLight : T.text,
              border: `1px solid ${copied ? T.olive + '44' : 'transparent'}`,
            }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {isOwner && (
              <button onClick={onRegenerate} title="Generate new code" style={{
                padding: '7px 10px', borderRadius: 8, fontSize: 16,
                background: T.subtle, color: T.muted, border: 'none',
              }}>↻</button>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            Share this code with family or friends to let them join this list.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Join Another List
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter code"
              maxLength={6}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: 10,
                background: T.bg, border: `1px solid ${T.cardBorder}`,
                color: T.text, fontSize: 15, outline: 'none', letterSpacing: 3, fontWeight: 700,
              }}
            />
            <button onClick={handleJoin} disabled={joining || !joinCode.trim()} style={{
              padding: '11px 18px', borderRadius: 10,
              background: joinCode.trim() ? T.olive : T.subtle,
              color: T.text, fontSize: 14, fontWeight: 600,
            }}>
              {joining ? '...' : 'Join'}
            </button>
          </div>
          {joinError && <p style={{ color: T.red, fontSize: 13, margin: '6px 0 0' }}>{joinError}</p>}
        </div>

        <button onClick={onLeaveOrDelete} style={{
          width: '100%', padding: '12px', borderRadius: 12,
          border: `1px solid ${T.red}44`, color: T.red,
          fontSize: 14, fontWeight: 500, background: 'transparent',
        }}>
          {isOwner && list?.members?.length <= 1 ? 'Delete list' : 'Leave list'}
        </button>
      </div>
    </div>,
    document.body
  );
}
