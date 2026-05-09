import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

// Get this from: Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate key pair
const VAPID_KEY = 'BOxQQ4ccpPF8I1moQs1nOAjBVCw3Zx4GtoQOqu5uVl-IlVzbUnCd6s4bvgNdnhiLzDRkuGb4B_ZH7RC6aRKwJ94';

export async function registerPushToken(userId) {
  if (!userId) return false;
  if (typeof Notification === 'undefined') return false;
  if (!(await isSupported())) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const base = import.meta.env.BASE_URL;
    const swReg = await navigator.serviceWorker.register(
      `${base}firebase-messaging-sw.js`,
      { scope: `${base}firebase-cloud-messaging-push-scope` }
    );

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

    if (token) {
      await setDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token) }, { merge: true });
    }
    return !!token;
  } catch (e) {
    console.error('Push registration failed:', e);
    return false;
  }
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
