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
    const tomorrow  = new Date();
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
    const db      = getFirestore();
    const messaging = getMessaging();
    const today   = new Date();
    await sendToUsers(db, messaging, today.getMonth() + 1, today.getDate(),
      (name) => `🎂 ${name}'s Birthday!`,
      (name) => `Today is ${name}'s birthday — wish them well!`
    );
  }
);
