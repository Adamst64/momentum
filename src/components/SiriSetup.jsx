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
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); setMsg('Copied ✓ Now paste it in the Shortcuts app.'); }
    catch { setMsg('Could not copy. Press and hold the link to copy it.'); }
  };

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
              <div style={{ fontSize: 12, color: T.muted }}>Your shopping list link (keep it private):</div>
              <div style={{ fontSize: 11, color: T.text, background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>{link('shopping')}</div>
              <button onClick={() => copy(link('shopping'))} style={{ padding: 11, borderRadius: 12, background: T.olive, color: '#fff', fontSize: 14, fontWeight: 600 }}>Copy shopping link</button>

              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 4 }}>Make the shortcut (once, about a minute)</div>
              {step(1, <>Open the <b>Shortcuts</b> app → tap <b>+</b>. Name it <b>Add to shopping list</b> (that's what you'll say to Siri).</>)}
              {step(2, <>Add the action <b>Dictate Text</b> (Siri will ask what to add).</>)}
              {step(3, <>Add the action <b>Text</b> and paste your link into it. Right after <b>item=</b>, insert the variable <b>Dictated Text</b>.</>)}
              {step(4, <>Add <b>Get Contents of URL</b> (it uses the Text above).</>)}
              {step(5, <>Add <b>Show Result</b> so Siri reads back "Added Milk to Groceries".</>)}
              {step(6, <>Say <b>"Hey Siri, add to shopping list"</b>, then "milk, eggs and bread".</>)}

              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
                Several items at once: separate them with "and" or commas. Another list: add <b>&amp;list=Costco</b> before <b>&amp;item=</b>.
                For tasks, make a second shortcut ("Add a task") with this link, which adds to today's tasks:
              </div>
              <button onClick={() => copy(link('task'))} style={{ padding: 10, borderRadius: 12, border: `1px solid ${T.cardBorder}`, color: T.khaki, fontSize: 13, fontWeight: 600 }}>Copy task link</button>
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
