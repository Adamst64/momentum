const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

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

// 2:00 PM Eastern — day-before reminder
exports.sendDayBeforeReminders = onSchedule(
  { schedule: '0 14 * * *', timeZone: 'America/New_York' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const m = tomorrow.getMonth() + 1;
    const d = tomorrow.getDate();

    await sendToUsers(
      db, messaging, m, d,
      '🎂 Birthday Tomorrow',
      (name) => `${name}'s birthday is tomorrow — don't forget to reach out!`
    );
  }
);

// 8:00 AM Eastern — day-of reminder
exports.sendDayOfReminders = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/New_York' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const today = new Date();
    const m = today.getMonth() + 1;
    const d = today.getDate();

    await sendToUsers(
      db, messaging, m, d,
      (name) => `🎂 ${name}'s Birthday!`,
      (name) => `Today is ${name}'s birthday — wish them well!`
    );
  }
);
