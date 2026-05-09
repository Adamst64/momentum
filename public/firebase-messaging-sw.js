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
  const title = payload.notification?.title || 'Momentum';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  iconBase + '/icon-192.png',
    badge: iconBase + '/icon-192.png',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (wins.length > 0) return wins[0].focus();
      return clients.openWindow(self.location.origin + iconBase + '/');
    })
  );
});
