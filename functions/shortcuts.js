// Siri / Apple Shortcuts: "Hey Siri, add to shopping list" → "milk".
// A shortcut calls siriAdd with the user's private key and what was said; the
// item is added without opening the app, and the reply is what Siri reads back.
//   GET/POST …/siriAdd?key=…&item=milk and eggs[&list=Costco][&type=shopping|task]
// Keys live in shortcutKeys/{key} = { uid } (server only); users/{uid}.shortcutKey
// remembers the current one so a new key replaces it.
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const genId = () => crypto.randomBytes(10).toString('hex');

exports.createShortcutKey = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const old = (await userRef.get()).data()?.shortcutKey;
  const key = crypto.randomBytes(18).toString('base64url');
  const batch = db.batch();
  if (old) batch.delete(db.collection('shortcutKeys').doc(old));
  batch.set(db.collection('shortcutKeys').doc(key), { uid, createdAt: new Date().toISOString() });
  batch.set(userRef, { shortcutKey: key }, { merge: true });
  await batch.commit();
  return { key };
});

// "milk, eggs and bread" → ['milk', 'eggs', 'bread']
const splitItems = text => String(text || '')
  .split(/\s*(?:,|;|\band\b|\bplus\b|&)\s*/i)
  .map(s => s.trim().replace(/[.!?]+$/, ''))
  .filter(Boolean)
  .map(s => s.charAt(0).toUpperCase() + s.slice(1))
  .slice(0, 20);

// What was said → separate items, reworded to match what's already known (the list's
// inventory and items): "bread milk eggs" → 3 items; "marinated cucumbers" →
// "Pickled cucumbers". Claude Haiku (key at config/anthropic, like receipts);
// without it, the simple split above.
const PARSE_SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'string' } } },
  required: ['items'],
  additionalProperties: false,
};
async function parseItems(db, text, known, kind) {
  try {
    const apiKey = (await db.doc('config/anthropic').get()).data()?.key;
    if (!apiKey) return splitItems(text);
    const client = new Anthropic({ apiKey });
    const prompt = kind === 'task'
      ? `Someone dictated to-do tasks to Siri: "${text}". Return each separate task as a short, clean task name (capitalized). Only split when they are clearly different tasks; "buy milk and eggs" is one task.`
      : `Someone dictated items for a shopping list to Siri: "${text}". Dictation often drops commas, so "bread milk eggs apples" is four items, while "peanut butter" or "orange juice" is one item.
Return each separate item. If an item means the same thing as one of these already known items (different wording, a synonym, singular/plural, a description or a type of it, e.g. "marinated cucumbers" or "dill pickles" for "Pickled cucumbers"), return the known name exactly as written. Otherwise return a clean name with a capital first letter. Keep quantities only if said (e.g. "2 lemons").
Known items: ${known.length ? known.slice(0, 400).map(k => `"${k}"`).join(', ') : '(none)'}`;
    const res = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 1000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PARSE_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });
    const out = JSON.parse(res.content.find(b => b.type === 'text')?.text || '{}');
    const items = (out.items || []).map(x => String(x).trim()).filter(Boolean).slice(0, 20);
    return items.length ? items : splitItems(text);
  } catch (e) {
    console.warn('parseItems fell back to splitting:', e.message);
    return splitItems(text);
  }
}

const localToday = tz => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'America/New_York' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function addToShopping(db, uid, text, listName) {
  const lists = (await db.collection('lists').where('members', 'array-contains', uid).get()).docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  if (!lists.length) return 'You have no shopping list yet. Open Momentum once to create it.';
  const want = String(listName || '').trim().toLowerCase();
  const list = (want && lists.find(l => String(l.name || '').toLowerCase() === want))
    || (want && lists.find(l => String(l.name || '').toLowerCase().includes(want)))
    || lists.find(l => l.ownerId === uid) || lists[0];
  const items = (await list.ref.collection('items').get()).docs.map(d => ({ ref: d.ref, ...d.data() }));
  const inventory = (await list.ref.collection('inventory').get()).docs.map(d => d.data());
  const known = [...new Set([...inventory, ...items].map(x => String(x.name || '').trim()).filter(Boolean))];
  const names = await parseItems(db, text, known, 'shopping');
  if (!names.length) return "I didn't catch what to add.";
  // Same as adding in the app: the item takes its inventory entry's store tags, and a
  // new name joins the inventory (when the list keeps one)
  const invEnabled = list.hasInventory || inventory.length > 0;
  const lc = x => String(x || '').trim().toLowerCase();
  const batch = db.batch();
  names.forEach((name, i) => {
    const inv = inventory.find(v => lc(v.name) === lc(name));
    const invTags = inv?.tagIds || [];
    const existing = items.find(it => lc(it.name) === lc(name));
    if (existing) {
      batch.update(existing.ref, { checked: false, tagIds: [...new Set([...(existing.tagIds || []), ...invTags])] });
    } else {
      batch.set(list.ref.collection('items').doc(genId()), { name, checked: false, order: Date.now() + i, tagIds: invTags });
    }
    if (invEnabled && !inv) {
      batch.set(list.ref.collection('inventory').doc(genId()), { name, tagIds: existing?.tagIds || [] });
      inventory.push({ name, tagIds: [] });
    }
  });
  await batch.commit();
  return `Added ${joinNames(names)} to ${list.name || 'your shopping list'}.`;
}

async function addTasks(db, uid, text) {
  const names = await parseItems(db, text, [], 'task');
  if (!names.length) return "I didn't catch the task.";
  const user = (await db.collection('users').doc(uid).get()).data() || {};
  const today = localToday(user.preferences?.dailyReview?.timezone);
  const batch = db.batch();
  names.forEach(name => {
    const id = genId();
    batch.set(db.collection('users').doc(uid).collection('tasks').doc(id), {
      id, name, type: 'one-time', date: today, notify: { enabled: false }, createdAt: today,
    });
  });
  await batch.commit();
  return `Added ${joinNames(names)} to today's tasks.`;
}

const joinNames = n => (n.length <= 1 ? n[0] : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);

exports.siriAdd = onRequest(async (req, res) => {
  const p = { ...req.query, ...(typeof req.body === 'object' ? req.body : {}) };
  res.set('Content-Type', 'text/plain; charset=utf-8');
  const key = String(p.key || '').trim();
  if (!key) return res.status(401).send('Missing key. Set up Siri in Momentum settings.');
  const db = getFirestore();
  const found = await db.collection('shortcutKeys').doc(key).get();
  if (!found.exists) return res.status(401).send('This shortcut key is no longer valid. Make a new one in Momentum settings.');
  const uid = found.data().uid;
  const text = String(p.item || p.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).send("I didn't catch what to add.");
  try {
    const reply = String(p.type || 'shopping') === 'task'
      ? await addTasks(db, uid, text)
      : await addToShopping(db, uid, text, p.list);
    await found.ref.update({ usedAt: FieldValue.serverTimestamp() });
    return res.send(reply);
  } catch (e) {
    console.error('siriAdd failed:', e);
    return res.status(500).send('Something went wrong adding that. Try again.');
  }
});
