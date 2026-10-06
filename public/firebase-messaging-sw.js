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
  // Older pushes carried a notification that Firebase shows itself; don't double it
  if (payload.notification) return;
  const d = payload.data || {};
  return self.registration.showNotification(d.title || 'Momentum', {
    body:  d.body || '',
    icon:  iconBase + '/icon-192.png',
    badge: iconBase + '/icon-192.png',
    tag:   d.tag || undefined, // the same push arriving twice replaces itself
    data:  { url: d.url || payload.fcmOptions?.link },
  });
});

// Where a tapped notification should take the app. Saved in Cache Storage as well
// as posted, so the app still finds it if iOS resumes it without the message.
const PENDING = 'momentum-pending';
async function savePending(url) {
  const cache = await caches.open(PENDING);
  await cache.put('pending-url', new Response(JSON.stringify({ url, at: Date.now() })));
}

self.addEventListener('notificationclick', (event) => {
  // Notifications Firebase displayed itself are handled by Firebase
  if (event.notification.data?.FCM_MSG) return;
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin + iconBase + '/';
  event.waitUntil((async () => {
    await savePending(url).catch(() => {});
    // This worker doesn't control the app's page, and iOS doesn't always deliver
    // client.postMessage to a page it doesn't control; a BroadcastChannel reaches it
    try { new BroadcastChannel(PENDING).postMessage({ type: 'open-url', url }); } catch { /* unsupported */ }
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length > 0) {
      wins.forEach(w => w.postMessage({ type: 'open-url', url }));
      return wins[0].focus().catch(() => {});
    }
    return clients.openWindow(url);
  })());
});
