const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

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

      const staleTokens = [];
      await Promise.allSettled(tokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: { title: notifTitle, body: notifBody },
            webpush: {
              notification: {
                icon:  'https://adamst64.github.io/momentum/icon-192.png',
                badge: 'https://adamst64.github.io/momentum/icon-192.png',
              },
            },
          });
        } catch (err) {
          if (err.code === 'messaging/registration-token-not-registered') {
            staleTokens.push(token);
          }
        }
      }));

      if (staleTokens.length) {
        await db.collection('users').doc(uid).update({
          fcmTokens: FieldValue.arrayRemove(...staleTokens),
        });
      }
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

// 7:30 AM Eastern — day-of reminder
exports.sendDayOfReminders = onSchedule(
  { schedule: '30 7 * * *', timeZone: 'America/New_York' },
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

// ── Task push notifications (every 15 minutes) ────────────────────────────────

exports.sendTaskNotifications = onSchedule(
  { schedule: 'every 15 minutes' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const usersSnap = await db.collection('users').get();

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
      const uid    = userDoc.id;
      const tokens = userDoc.data().fcmTokens || [];
      if (!tokens.length) return;

      const tasksSnap = await db.collection('users').doc(uid).collection('tasks').get();

      for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.notify?.enabled || !task.notify?.time) continue;

        const tz = task.notify.timezone || 'UTC';

        // Get current local date/time in the task's timezone
        const nowInTz     = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        const nowHour     = nowInTz.getHours();
        const nowMin      = nowInTz.getMinutes();
        const ymLocal     = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, '0')}`;
        const domLocal    = nowInTz.getDate();
        const todayLocal  = `${ymLocal}-${String(domLocal).padStart(2, '0')}`;

        // Check if this 15-minute slot matches the task's notify time
        const [notifyHour, notifyMin] = task.notify.time.split(':').map(Number);
        if (nowHour !== notifyHour) continue;
        if (Math.floor(nowMin / 15) !== Math.floor(notifyMin / 15)) continue;

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

        const staleTokens = [];
        await Promise.allSettled(tokens.map(async (token) => {
          try {
            await messaging.send({
              token,
              notification: { title: notifTitle, body: notifBody },
              webpush: {
                notification: {
                  icon:  'https://adamst64.github.io/momentum/icon-192.png',
                  badge: 'https://adamst64.github.io/momentum/icon-192.png',
                },
                headers: { TTL: '86400' },
              },
            });
          } catch (err) {
            if (err.code === 'messaging/registration-token-not-registered') {
              staleTokens.push(token);
            }
          }
        }));

        if (staleTokens.length) {
          await db.collection('users').doc(uid).update({
            fcmTokens: FieldValue.arrayRemove(...staleTokens),
          });
        }
      }
    }));
  }
);
