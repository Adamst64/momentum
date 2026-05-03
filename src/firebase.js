import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD4d4hiV0Zn0OaXxuLgYTP99rlg54VnBeg",
  authDomain: "momentum-4acf1.firebaseapp.com",
  projectId: "momentum-4acf1",
  storageBucket: "momentum-4acf1.firebasestorage.app",
  messagingSenderId: "737833970070",
  appId: "1:737833970070:web:c7963a9ec9b219b5e0d5b7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
