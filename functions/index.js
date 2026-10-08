const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const investing = require('./investing');

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
exports.searchSymbols = onCall(request => investing.searchSymbols(getFirestore(), request));
exports.priceHistory  = onCall(request => investing.priceHistory(getFirestore(), request));

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

// Evening review reminder: users/{uid}.preferences.dailyReview = { enabled, time, timezone, lastSentDate }
async function maybeSendDailyReview(db, messaging, userDoc, tokens) {
  const pref = userDoc.data().preferences?.dailyReview;
  if (!pref?.enabled || !pref.time) return;
  const now = localNow(pref.timezone || 'UTC');
  if (!isDue(pref.time, now.minutes) || pref.lastSentDate === now.today) return;

  // Mark first so an overlapping run can't double-send
  await userDoc.ref.update({ 'preferences.dailyReview.lastSentDate': now.today });
  await sendPush(db, messaging, userDoc.id, tokens,
    '🌙 Daily review', 'Take a minute to look back on today and plan tomorrow.',
    APP_URL + '?action=review');
}

// ── Task push notifications (every 5 minutes) ─────────────────────────────────

exports.sendTaskNotifications = onSchedule(
  { schedule: 'every 5 minutes' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const usersSnap = await db.collection('users').get();

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
      const uid    = userDoc.id;
      const tokens = userDoc.data().fcmTokens || [];

      // Portfolio snapshots run even without notifications set up
      await investing.runInvestingJobs(db, userDoc,
        tokens.length ? (title, body) => sendPush(db, messaging, uid, tokens, title, body, APP_URL + '?tab=investing') : null);

      if (!tokens.length) return;

      await maybeSendDailyReview(db, messaging, userDoc, tokens);

      const tasksSnap = await db.collection('users').doc(uid).collection('tasks').get();

      for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.notify?.enabled || !task.notify?.time) continue;

        const { minutes, ym: ymLocal, dom: domLocal, today: todayLocal } = localNow(task.notify.timezone || 'UTC');
        if (!isDue(task.notify.time, minutes)) continue;

        // Check if task is due today
        let dueToday = false;
        if (task.type === 'one-time') {
          dueToday = task.date === todayLocal;
        } else if (task.type === 'recurring-monthly') {
          const effectiveDay = task.monthOverrides?.[ymLocal] ?? task.dayOfMonth;
          dueToday = effectiveDay === domLocal;
        }
        if (!dueToday) continue;

        // Avoid duplicate sends
        if (task.notify.lastSentDate === todayLocal) continue;

        const isMonthly   = task.type === 'recurring-monthly';
        const notifTitle  = task.name;
        const notifBody   = isMonthly ? 'Monthly task due today' : 'Task due today';

        // Update lastSentDate before sending to minimise duplicates
        await taskDoc.ref.update({ 'notify.lastSentDate': todayLocal });

        await sendPush(db, messaging, uid, tokens, notifTitle, notifBody, APP_URL + '?tab=tasks');
      }
    }));
  }
);
