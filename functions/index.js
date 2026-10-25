const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const investing = require('./investing');
const receipts = require('./receipts');

initializeApp();

// ── Shared list: join by invite code ────────────────────────────────────────

exports.joinListByCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { inviteCode } = request.data;
  if (!inviteCode) throw new HttpsError('invalid-argument', 'Invite code required');

  const db   = getFirestore();
  const snap = await db.collection('lists')
    .where('inviteCode', '==', inviteCode.trim().toUpperCase())
    .limit(1).get();

  if (snap.empty) throw new HttpsError('not-found', 'Invalid invite code');

  const listDoc  = snap.docs[0];
  const listData = listDoc.data();

  if (listData.members.includes(uid)) {
    return { listId: listDoc.id, listName: listData.name, alreadyMember: true };
  }

  await listDoc.ref.update({ members: FieldValue.arrayUnion(uid) });
  return { listId: listDoc.id, listName: listData.name };
});

// ── Investing: live prices on demand ─────────────────────────────────────────

exports.refreshPrices = onCall(request => investing.refreshPrices(getFirestore(), request));
exports.stockInfo     = onCall(request => investing.stockInfo(getFirestore(), request));
exports.marketEvents  = onCall(request => investing.marketEvents(getFirestore(), request));
exports.searchSymbols = onCall(request => investing.searchSymbols(getFirestore(), request));
exports.priceHistory  = onCall(request => investing.priceHistory(getFirestore(), request));

// ── Budget: read a receipt photo into categorized items ─────────────────────

exports.scanReceipt = onCall({ timeoutSeconds: 180, memory: '512MiB' }, request => receipts.scanReceipt(getFirestore(), request));

// ── Birthday push notifications ──────────────────────────────────────────────

async function sendToUsers(db, messaging, checkMonth, checkDay, title, body) {
  const usersSnap = await db.collection('users').get();

  await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
    const uid    = userDoc.id;
    const tokens = userDoc.data().fcmTokens || [];
    if (!tokens.length) return;

    const birthdaysSnap = await db.collection('users').doc(uid).collection('birthdays').get();

    for (const bDoc of birthdaysSnap.docs) {
      const b = bDoc.data();
      if (b.month !== checkMonth || b.day !== checkDay) continue;

      const notifTitle = typeof title === 'function' ? title(b.name) : title;
      const notifBody  = typeof body  === 'function' ? body(b.name)  : body;

      await sendPush(db, messaging, uid, tokens, notifTitle, notifBody, APP_URL + '?tab=birthdays');
    }
  }));
}

// 9:30 PM Eastern — day-before reminder
exports.sendDayBeforeReminders = onSchedule(
  { schedule: '30 21 * * *', timeZone: 'America/New_York' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();
    const nowET     = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const tomorrow  = new Date(nowET);
    tomorrow.setDate(tomorrow.getDate() + 1);
    await sendToUsers(db, messaging, tomorrow.getMonth() + 1, tomorrow.getDate(),
      '🎂 Birthday Tomorrow',
      (name) => `${name}'s birthday is tomorrow — don't forget to reach out!`
    );
  }
);

// 7:00 AM Eastern — day-of reminder
exports.sendDayOfReminders = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/New_York' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();
    const today     = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    await sendToUsers(db, messaging, today.getMonth() + 1, today.getDate(),
      (name) => `🎂 ${name}'s Birthday!`,
      (name) => `Today is ${name}'s birthday — wish them well!`
    );
  }
);

// ── Shared helpers ───────────────────────────────────────────────────────────

// Current date/time parts in a timezone
function localNow(tz) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const ym  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    minutes: now.getHours() * 60 + now.getMinutes(),
    ym,
    dom:   now.getDate(),
    today: `${ym}-${String(now.getDate()).padStart(2, '0')}`,
  };
}

// True once "HH:MM" has passed today, but not more than an hour ago
function isDue(time, minutesNow) {
  const [h, m] = time.split(':').map(Number);
  const late = minutesNow - (h * 60 + m);
  return late >= 0 && late < 60;
}

const APP_URL = 'https://adamst64.github.io/momentum/';

// link: where tapping the notification opens: ?tab=<section> or ?action=review
// (defaults to the app's start page)
async function sendPush(db, messaging, uid, tokens, title, body, link = APP_URL) {
  const tag = `${title}|${new Date().toISOString().slice(0, 13)}`; // same push on two registrations shows once
  const staleTokens = [];
  await Promise.allSettled(tokens.map(async (token) => {
    try {
      // Data-only: our service worker shows it (one per device, thanks to the tag)
      // and handles the tap, so it opens the right screen even when the app is
      // already running in the background
      await messaging.send({
        token,
        data: { title, body, url: link, tag },
        webpush: { headers: { TTL: '86400', Urgency: 'high' } },
      });
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered') staleTokens.push(token);
      else console.error(`Push to ${uid} failed:`, err.code || err.message);
    }
  }));
  if (staleTokens.length) {
    await db.collection('users').doc(uid).update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) });
  }
}

// Evening review reminder: users/{uid}.preferences.dailyReview = { enabled, time, timezone, lastSentDate, lastSentAt }
// (the app opens the review when it comes forward soon after lastSentAt)
async function maybeSendDailyReview(db, messaging, userDoc, tokens) {
  const pref = userDoc.data().preferences?.dailyReview;
  if (!pref?.enabled || !pref.time) return;
  const now = localNow(pref.timezone || 'UTC');
  if (!isDue(pref.time, now.minutes) || pref.lastSentDate === now.today) return;

  // Mark first so an overlapping run can't double-send
  await userDoc.ref.update({
    'preferences.dailyReview.lastSentDate': now.today,
    'preferences.dailyReview.lastSentAt': Date.now(),
  });
  await sendPush(db, messaging, userDoc.id, tokens,
    '🌙 Daily review', 'Take a minute to look back on today and plan tomorrow.',
    APP_URL + '?action=review');
}

// Fridays at 3 PM (local): remind to text last week's work summary to each crew
// that has a text number, worked last week and isn't marked paid for it yet. The text itself is opened from
// the Work tab (Messages, one tap to send); this only sends the reminder.
async function maybeSendWorkTexts(db, messaging, userDoc, tokens) {
  const data = userDoc.data();
  if (data.features?.workTab !== true) return;
  const pref = data.preferences?.workTexts;
  if (!pref) return;
  const now = localNow(pref.timezone || 'America/New_York');
  const dow = new Date(now.today + 'T12:00:00Z').getUTCDay();
  if (dow !== 5 || !isDue('15:00', now.minutes) || pref.lastSentDate === now.today) return;

  const shift = (ds, n) => {
    const d = new Date(ds + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const prevMon = shift(now.today, -11); // Friday → Monday of the week before
  const prevSun = shift(prevMon, 6);

  const crewsSnap = await userDoc.ref.collection('workCrews').get();
  const textCrews = new Set(crewsSnap.docs.filter(d => d.data().phone).map(d => d.id));
  if (!textCrews.size) return;

  const daysSnap = await userDoc.ref.collection('workDays')
    .where(FieldPath.documentId(), '>=', prevMon)
    .where(FieldPath.documentId(), '<=', prevSun)
    .get();
  // Trip-only days (nothing installed) aren't work; they need the text until
  // their pay is settled (paid or not paid)
  const worked = new Set(), openTrips = new Set();
  daysSnap.docs.forEach(d => {
    const day = d.data();
    if (day.isOff) return;
    if (day.isTrip) {
      if (textCrews.has(day.crewId) && !day.tripPay?.status) openTrips.add(day.crewId);
    } else if (textCrews.has(day.crewId)) worked.add(day.crewId);
    if (textCrews.has(day.second?.crewId)) worked.add(day.second.crewId);
  });

  // Crews already marked paid for that week don't need the text anymore
  const weekSnap = await userDoc.ref.collection('workWeeks').doc(prevMon).get();
  const week = weekSnap.exists ? weekSnap.data() : {};
  for (const crewId of [...worked]) {
    const pay = week[crewId];
    if (pay === true || pay?.paid === true) worked.delete(crewId);
  }
  openTrips.forEach(c => worked.add(c));

  await userDoc.ref.update({ 'preferences.workTexts.lastSentDate': now.today });
  if (!worked.size) return;
  await sendPush(db, messaging, userDoc.id, tokens,
    '💬 Weekly work texts',
    `Last week's summary is ready for ${worked.size} crew${worked.size === 1 ? '' : 's'}. Tap to send.`,
    APP_URL + '?tab=work&view=pay');
}

// ── Task push notifications (every 5 minutes) ─────────────────────────────────

// Is a task due on the given local day (and not checked off yet)? Mirrors
// src/hooks/useTasks.js.
function taskDueToday(task, { ym, dom, today }) {
  if (task.createdAt && today < task.createdAt) return false;
  if (task.type === 'one-time') return task.date === today && !task.completedAt;
  if (task.type === 'recurring-monthly') {
    const effectiveDay = task.monthOverrides?.[ym] ?? task.dayOfMonth;
    return effectiveDay === dom && !task.completedOccurrences?.[ym];
  }
  if (task.type === 'recurring-weekly') {
    const moved = task.moved || {};
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    const due = Object.values(moved).includes(today) || (dow === task.dayOfWeek && !moved[today]);
    return due && !task.completedOccurrences?.[today];
  }
  return false;
}

const TASK_BODY = {
  'recurring-monthly': 'Monthly task due today',
  'recurring-weekly':  'Weekly task due today',
};

async function sendTaskReminders(db, messaging, userDoc, tokens) {
  const tasksSnap = await userDoc.ref.collection('tasks').get();
  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();
    if (!task.notify?.enabled || !task.notify?.time) continue;

    const now = localNow(task.notify.timezone || 'UTC');
    if (!isDue(task.notify.time, now.minutes)) continue;
    if (task.notify.lastSentDate === now.today) continue;
    if (!taskDueToday(task, now)) continue;

    // Mark first so an overlapping run can't double-send
    await taskDoc.ref.update({ 'notify.lastSentDate': now.today });
    await sendPush(db, messaging, userDoc.id, tokens, task.name, TASK_BODY[task.type] || 'Task due today', APP_URL + '?tab=tasks');
  }
}

// One job failing (or a price service hanging) mustn't take the others down
async function guarded(label, uid, fn) {
  try { await fn(); }
  catch (e) { console.error(`${label} for ${uid} failed:`, e); }
}

exports.sendTaskNotifications = onSchedule(
  // Price lookups can be slow; the default 60s timeout cut runs short
  { schedule: 'every 5 minutes', timeoutSeconds: 240 },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const usersSnap = await db.collection('users').get();

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
      const uid    = userDoc.id;
      const tokens = userDoc.data().fcmTokens || [];
      const push   = tokens.length ? (title, body) => sendPush(db, messaging, uid, tokens, title, body, APP_URL + '?tab=investing') : null;

      // Time-sensitive reminders first, before anything that calls outside services
      if (tokens.length) {
        await guarded('Task reminders', uid, () => sendTaskReminders(db, messaging, userDoc, tokens));
        await guarded('Daily review', uid, () => maybeSendDailyReview(db, messaging, userDoc, tokens));
        await guarded('Work texts', uid, () => maybeSendWorkTexts(db, messaging, userDoc, tokens));
      }

      // Portfolio snapshots run even without notifications set up
      await guarded('Investing jobs', uid, () => investing.runInvestingJobs(db, userDoc, push));
    }));
  }
);
