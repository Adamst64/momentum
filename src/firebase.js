import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// On launch Firebase checks the saved session with Google's servers before it
// reports who is signed in. With no signal at all that check fails at once and
// the saved session is kept, but on a barely-working connection it hangs for up
// to 30s, long enough to land on the login screen. Cap those startup checks at
// a few seconds: a timed-out check counts as "offline" and the session is kept.
const AUTH_HOSTS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'];
const nativeFetch = window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  if (!AbortSignal.timeout || !AUTH_HOSTS.some(h => url.includes(h))) return nativeFetch(input, init);
  return nativeFetch(input, { ...init, signal: AbortSignal.timeout(3000) });
};

export const auth = getAuth(app);
auth.authStateReady().finally(() => { window.fetch = nativeFetch; });
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
