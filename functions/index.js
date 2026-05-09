const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// Runs every day at 9:00 AM Eastern time
exports.sendBirthdayNotifications = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/New_York' },
  async () => {
    const db        = getFirestore();
    const messaging = getMessaging();

    const today    = new Date();
    const todayM   = today.getMonth() + 1;
    const todayD   = today.getDate();

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowM = tomorrow.getMonth() + 1;
    const tomorrowD = tomorrow.getDate();

    const usersSnap = await db.collection('users').get();

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
      const uid      = userDoc.id;
      const tokens   = userDoc.data().fcmTokens || [];
      if (!tokens.length) return;

      const birthdaysSnap = await db.collection('users').doc(uid).collection('birthdays').get();

      for (const bDoc of birthdaysSnap.docs) {
        const b = bDoc.data();
        let title, body;

        if (b.month === todayM && b.day === todayD) {
          title = `🎂 ${b.name}'s Birthday!`;
          body  = `Today is ${b.name}'s birthday — don't forget to reach out!`;
        } else if (b.month === tomorrowM && b.day === tomorrowD) {
          title = '🎂 Birthday Tomorrow';
          body  = `${b.name}'s birthday is tomorrow!`;
        } else {
          continue;
        }

        const staleTokens = [];

        await Promise.allSettled(tokens.map(async (token) => {
          try {
            await messaging.send({
              token,
              notification: { title, body },
              webpush: {
                notification: {
                  icon: 'https://adamst64.github.io/momentum/icon-192.png',
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
);
