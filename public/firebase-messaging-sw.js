importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD4d4hiV0Zn0OaXxuLgYTP99rlg54VnBeg',
  authDomain: 'momentum-4acf1.firebaseapp.com',
  projectId: 'momentum-4acf1',
  storageBucket: 'momentum-4acf1.firebasestorage.app',
  messagingSenderId: '737833970070',
  appId: '1:737833970070:web:c7963a9ec9b219b5e0d5b7',
});

const messaging = firebase.messaging();

const iconBase = self.location.hostname === 'localhost' ? '' : '/momentum';

messaging.onBackgroundMessage((payload) => {
  // Firebase already shows messages that carry a notification (and opens their
  // link when tapped); showing it here too would make a duplicate
  if (payload.notification) return;
  const title = payload.notification?.title || 'Momentum';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  iconBase + '/icon-192.png',
    badge: iconBase + '/icon-192.png',
    data:  { url: payload.fcmOptions?.link || payload.data?.url },
  });
});

// Open the notification's link (e.g. ?action=review opens the Daily Review).
// If the app is already open, tell it instead of reloading it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin + iconBase + '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (wins.length > 0) {
        wins[0].postMessage({ type: 'open-url', url });
        return wins[0].focus();
      }
      return clients.openWindow(url);
    })
  );
});
