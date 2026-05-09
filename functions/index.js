const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const DEFAULT_NOTIFY_HOUR_UTC = 13; // 9 AM Eastern (EDT)

// Runs every hour on the hour
exports.sendBirthdayNotifications = onSchedule(
  { schedule: '0 * * * *', timeZone: 'UTC' },
  async () => {
    const db             = getFirestore();
    const messaging      = getMessaging();
    const currentHourUTC = new Date().getUTCHours();

    const today    = new Date();
    const todayM   = today.getUTCMonth() + 1;
    const todayD   = today.getUTCDate();

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);
    const tomorrowM = tomorrow.getUTCMonth() + 1;
    const tomorrowD = tomorrow.getUTCDate();

    const usersSnap = await db.collection('users').get();

    await Promise.allSettled(usersSnap.docs.map(async (userDoc) => {
      const data           = userDoc.data();
      const userNotifyHour = data.notifyHourUTC ?? DEFAULT_NOTIFY_HOUR_UTC;

      // Only send for users whose preferred hour matches now
      if (userNotifyHour !== currentHourUTC) return;

      const uid    = userDoc.id;
      const tokens = data.fcmTokens || [];
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
);
