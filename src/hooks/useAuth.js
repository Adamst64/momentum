import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    // If Firebase auth doesn't resolve within 6s (e.g. very weak connection),
    // fall through to the login screen rather than hanging on the loading dot.
    const timeout = setTimeout(() => setUser(u => u === undefined ? null : u), 6000);
    const unsub = onAuthStateChanged(auth, u => { clearTimeout(timeout); setUser(u); });
    return () => { clearTimeout(timeout); unsub(); };
  }, []);

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logOut = () => signOut(auth);

  const changePassword = async (currentPassword, newPassword) => {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email, {
    url: window.location.origin + import.meta.env.BASE_URL,
    handleCodeInApp: true,
  });

  const applyPasswordReset = (oobCode, newPassword) => confirmPasswordReset(auth, oobCode, newPassword);
  const verifyResetCode    = (oobCode) => verifyPasswordResetCode(auth, oobCode);

  return { user, signIn, signUp, logOut, changePassword, resetPassword, applyPasswordReset, verifyResetCode };
}
