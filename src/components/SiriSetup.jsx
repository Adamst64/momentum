import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { T } from '../theme';

// Settings → Siri: a private link for an Apple Shortcut, so "Hey Siri, add to
// shopping list" → "milk" adds it without opening the app (see functions/shortcuts.js)
const ENDPOINT = `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/siriAdd`;

export default function SiriSetup({ userId }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!open || !userId || key) return;
    getDoc(doc(db, 'users', userId)).then(s => setKey(s.data()?.shortcutKey || null)).catch(() => {});
  }, [open, userId, key]);

  const makeKey = async () => {
    setBusy(true); setMsg(null);
    try { setKey((await httpsCallable(getFunctions(getApp()), 'createShortcutKey')({})).data.key); }
    catch (e) { setMsg(e.message || 'Could not create the link. Try again.'); }
    finally { setBusy(false); }
  };
  const link = type => `${ENDPOINT}?key=${key}${type === 'task' ? '&type=task' : ''}&item=`;
  const copy = async type => {
    const text = link(type);
    setMsg(null);
    try { await navigator.clipboard.writeText(text); }
    catch {
      // Older iOS: copy through a hidden text box
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) { setMsg('Could not copy. Press and hold the link to copy it.'); return; }
    }
    setCopied(type);
    setTimeout(() => setCopied(c => (c === type ? null : c)), 2500);
  };
  const linkBlock = (type, title) => (
    <>
      <div style={{ fontSize: 12, color: T.muted }}>{title}</div>
      <div style={{ fontSize: 11, color: T.text, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>{link(type)}</div>
      <button onClick={() => copy(type)} style={{ padding: 11, borderRadius: 12, background: copied === type ? T.green : T.olive, color: '#fff', fontSize: 14, fontWeight: 600, transition: 'background 0.2s' }}>
        {copied === type ? '✓ Link copied' : `Copy ${type === 'task' ? 'task' : 'shopping'} link`}
      </button>
    </>
  );

  const step = (n, text) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, color: T.text, lineHeight: 1.45 }}>
      <span style={{ width: 20, height: 20, borderRadius: 10, background: '#2A3A1A', color: T.khaki, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span>{text}</span>
    </div>
  );

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', textAlign: 'left' }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15, color: T.text }}>Siri: add by voice</span>
          <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 2 }}>"Hey Siri, add to shopping list" → "milk"</span>
        </span>
        <span style={{ color: T.muted, fontSize: 16, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!key ? (
            <>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
                Siri can't open web apps directly, but Apple's Shortcuts app can. First make your private link (it only adds items to your lists):
              </div>
              <button onClick={makeKey} disabled={busy} style={{ padding: 12, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 15, fontWeight: 600 }}>
                {busy ? 'Making your link…' : 'Make my Siri link'}
              </button>
            </>
          ) : (
            <>
              {linkBlock('shopping', 'Shopping list link (keep it private):')}

              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 4 }}>Make the shortcut (once, about a minute)</div>
              {step(1, <>Open the <b>Shortcuts</b> app → tap <b>+</b>. Ignore the suggested actions; you'll use the <b>Search Actions</b> bar at the bottom.</>)}
              {step(2, <>Search <b>Dictate Text</b> and tap it (Siri will ask what to add).</>)}
              {step(3, <>Search <b>Text</b> and tap it. Tap inside its box, paste your link, then tap <b>Dictated Text</b> in the bar above the keyboard so it lands right after <b>item=</b>.</>)}
              {step(4, <>Search <b>Get Contents of URL</b> (green icon) and tap it. It should read "Get contents of Text".</>)}
              {step(5, <>Search <b>Speak Text</b> and tap it, so Siri says "Added Milk to Groceries" (optional; it adds either way).</>)}
              {step(6, <>Tap the name at the top → <b>Rename</b> → <b>Add to shopping list</b> (that's what you'll say), then <b>Done</b>.</>)}
              {step(7, <>Say <b>"Hey Siri, add to shopping list"</b>, then "milk, eggs and bread".</>)}

              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
                Say several items at once ("bread milk eggs"). Another list: add <b>&amp;list=Costco</b> before <b>&amp;item=</b>.
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 8 }}>Tasks (optional)</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
                Tasks use a different link (it ends with <b>type=task</b>). Make a second shortcut the same way, named <b>Add a task</b>, with this link. It adds to today's tasks.
              </div>
              {linkBlock('task', 'Task link (keep it private):')}
              <button onClick={makeKey} disabled={busy} style={{ alignSelf: 'flex-start', fontSize: 12, color: T.muted, padding: '4px 0' }}>
                {busy ? 'Making…' : 'Make a new link (the old one stops working)'}
              </button>
            </>
          )}
          {msg && <div style={{ fontSize: 12, color: msg.includes('✓') ? T.green : T.red }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
