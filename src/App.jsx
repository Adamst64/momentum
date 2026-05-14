import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { T } from './theme';
import BottomNav from './components/BottomNav';
import RoutinesTab from './components/routines/RoutinesTab';
import TasksTab from './components/tasks/TasksTab';
import ShoppingTab from './components/shopping/ShoppingTab';
import BirthdaysTab from './components/birthdays/BirthdaysTab';
import WorkTab from './components/work/WorkTab';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './hooks/useAuth';
import { useRoutines } from './hooks/useRoutines';
import { useCommitments } from './hooks/useCommitments';
import { useTasks } from './hooks/useTasks';
import { useShoppingLists } from './hooks/useShoppingLists';
import { useBirthdays } from './hooks/useBirthdays';
import { useWork } from './hooks/useWork';
import { useTabOrder, ALL_TABS } from './hooks/useTabOrder';
import { registerPushToken, getNotificationPermission } from './utils/pushNotifications';

const TAB_LABELS = { routines: 'Routines', tasks: 'Tasks', shopping: 'Shopping', birthdays: 'Birthdays', work: 'Work' };

export default function App() {
  const { user, signIn, signUp, logOut, changePassword, resetPassword } = useAuth();
  const [tab, setTab] = useState('routines');
  const [showSettings, setShowSettings] = useState(false);

  const userId = user?.uid ?? null;
  const [features, setFeatures]         = useState({});
  const [tabOrder, setTabOrderState]    = useTabOrder();

  useEffect(() => {
    if (!userId) { setFeatures({}); return; }
    getDoc(doc(db, 'users', userId))
      .then(snap => {
        const data = snap.data() || {};
        setFeatures(data.features || {});
        const stored = data.preferences?.tabOrder;
        if (Array.isArray(stored) && stored.length > 0) {
          const valid = [
            ...stored.filter(t => ALL_TABS.includes(t)),
            ...ALL_TABS.filter(t => !stored.includes(t)),
          ];
          setTabOrderState(valid);
        }
      })
      .catch(() => {});
  }, [userId]);

  const handleUnlockFeature = async (featureKey) => {
    const updated = { ...features, [featureKey]: true };
    await setDoc(doc(db, 'users', userId), { features: updated }, { merge: true });
    setFeatures(updated);
  };

  const setTabOrder = (newOrder) => {
    setTabOrderState(newOrder);
    setDoc(doc(db, 'users', userId), { preferences: { tabOrder: newOrder } }, { merge: true }).catch(() => {});
  };

  const showWork    = features.workTab === true;
  const visibleTabs = tabOrder.filter(id => id !== 'work' || showWork);

  const routinesHook     = useRoutines(userId);
  const commitmentsHook  = useCommitments(userId);
  const tasksHook        = useTasks(userId);
  const shoppingHook  = useShoppingLists(userId);
  const birthdaysHook = useBirthdays(userId);
  const workHook      = useWork(showWork ? userId : null);

  // Re-register push token on load if permission was already granted
  useEffect(() => {
    if (userId && getNotificationPermission() === 'granted') {
      registerPushToken(userId).catch(() => {});
    }
  }, [userId]);

  // Still determining auth state
  if (user === undefined) {
    return (
      <div style={{ background: T.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive }} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} onResetPassword={resetPassword} />;
  }

  return (
    <div style={{ background: T.bg, minHeight: '100dvh', maxWidth: 430, margin: '0 auto', position: 'relative' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        padding: '52px 20px 14px',
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        background: T.bg,
        borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Momentum</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive, marginBottom: 2 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: T.khaki,
              background: '#2A3A1A', padding: '4px 10px', borderRadius: 20,
            }}>
              {TAB_LABELS[tab]}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke={T.olive} strokeWidth="1.8" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={T.olive} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main style={{
        paddingTop: 20,
        paddingBottom: `calc(${T.navH}px + env(safe-area-inset-bottom) + 12px)`,
        overflowY: 'auto',
      }}>
        {tab === 'routines'  && <RoutinesTab hook={routinesHook} commitmentsHook={commitmentsHook} />}
        {tab === 'tasks'     && <TasksTab    hook={tasksHook} userId={userId} />}
        {tab === 'shopping'  && <ShoppingTab    hook={shoppingHook} userId={userId} />}
        {tab === 'birthdays' && <BirthdaysTab   hook={birthdaysHook} userId={userId} />}
        {tab === 'work'      && showWork && <WorkTab hook={workHook} />}

        {showSettings && (
          <SettingsModal
            user={user}
            onChangePassword={changePassword}
            onSignOut={() => { logOut(); setShowSettings(false); }}
            onClose={() => setShowSettings(false)}
            routines={routinesHook.routines}
            tasks={tasksHook.tasks}
            shoppingLists={shoppingHook.lists}
            features={features}
            onUnlockFeature={handleUnlockFeature}
            tabOrder={tabOrder}
            setTabOrder={setTabOrder}
            showWork={showWork}
          />
        )}

      </main>

      <BottomNav active={tab} onChange={setTab} tabOrder={visibleTabs} />
    </div>
  );
}
