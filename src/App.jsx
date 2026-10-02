import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { T } from './theme';
import { TAB_DEFS } from './components/BottomNav';
import HomeMenu from './components/HomeMenu';
import { runBack } from './hooks/useBackHandler';
import RoutinesTab from './components/routines/RoutinesTab';
import TasksTab from './components/tasks/TasksTab';
import ShoppingTab from './components/shopping/ShoppingTab';
import BirthdaysTab from './components/birthdays/BirthdaysTab';
import WorkTab from './components/work/WorkTab';
import NotesTab from './components/notes/NotesTab';
import ListsTab from './components/lists/ListsTab';
import InvestingTab from './components/investing/InvestingTab';
import NoteEditor from './components/notes/NoteEditor';
import CreateTaskModal from './components/tasks/CreateTaskModal';
import QuickAddSheet from './components/QuickAddSheet';
import DailyReviewModal from './components/DailyReviewModal';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import { useAuth } from './hooks/useAuth';
import { useRoutines } from './hooks/useRoutines';
import { useCommitments } from './hooks/useCommitments';
import { useTasks } from './hooks/useTasks';
import { useShoppingLists } from './hooks/useShoppingLists';
import { useBirthdays } from './hooks/useBirthdays';
import { useWork } from './hooks/useWork';
import { useNotes } from './hooks/useNotes';
import { usePersonalLists } from './hooks/usePersonalLists';
import { useInvesting } from './hooks/useInvesting';
import { useTabOrder, ALL_TABS } from './hooks/useTabOrder';
import { registerPushToken, getNotificationPermission } from './utils/pushNotifications';

// Last-known features and tab order, so the menu (including the Work tile)
// is right on the first frame instead of waiting on Firestore's cache
const PREFS_KEY = 'momentum:prefs';
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || null; } catch { return null; } };
const writePrefs = v => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// Home-screen shortcuts and links can open the app at ?action=<one of these>
const URL_ACTIONS = ['add-task', 'add-item', 'add-list-item', 'new-note', 'review'];

export default function App() {
  const { user, signIn, signUp, logOut, changePassword, resetPassword, applyPasswordReset, verifyResetCode } = useAuth();
  // 'home' = the main menu; notification links can open a section with ?tab=<id>
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return ALL_TABS.includes(t) ? t : 'home';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [quickAdd, setQuickAdd]         = useState(null); // null | { mode }
  const [newTask, setNewTask]           = useState(false);
  const [newNote, setNewNote]           = useState(false);
  const [showReview, setShowReview]     = useState(false);
  const [dailyReview, setDailyReview]   = useState(null);
  const [urlAction] = useState(() => {
    const a = new URLSearchParams(window.location.search).get('action');
    return URL_ACTIONS.includes(a) ? a : null;
  });
  const [resetCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('mode') === 'resetPassword' ? p.get('oobCode') : null;
  });

  const userId = user?.uid ?? null;
  const [cachedPrefs] = useState(readPrefs);
  const [features, setFeatures]         = useState(() => cachedPrefs?.features || {});
  const [tabOrder, setTabOrderState]    = useTabOrder(cachedPrefs?.tabOrder);

  useEffect(() => {
    // user is undefined while auth is still loading: keep the saved prefs then,
    // and clear them only on an actual sign-out
    if (!userId) { if (user === null) setFeatures({}); return; }
    if (cachedPrefs && cachedPrefs.uid !== userId) { setFeatures({}); setTabOrderState([...ALL_TABS]); }
    // onSnapshot answers from the offline cache right away; getDoc would wait
    // on the server, keeping the Work tab hidden for a second or more on launch
    return onSnapshot(doc(db, 'users', userId), snap => {
        const data = snap.data() || {};
        setFeatures(data.features || {});
        setDailyReview(data.preferences?.dailyReview || null);
        const stored = data.preferences?.tabOrder;
        if (Array.isArray(stored) && stored.length > 0) {
          const valid = [
            ...stored.filter(t => ALL_TABS.includes(t)),
            ...ALL_TABS.filter(t => !stored.includes(t)),
          ];
          setTabOrderState(valid);
        }
      }, () => {});
  }, [userId]);

  useEffect(() => {
    if (userId) writePrefs({ uid: userId, features, tabOrder });
  }, [userId, features, tabOrder]);

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
  const notesHook     = useNotes(userId);
  const listsHook     = usePersonalLists(userId);
  const investingHook = useInvesting(userId);

  // Open whatever a shortcut link asked for, once signed in
  useEffect(() => {
    if (!userId || !urlAction) return;
    if (urlAction === 'add-task')      setNewTask(true);
    if (urlAction === 'new-note')      setNewNote(true);
    if (urlAction === 'review')        setShowReview(true);
    if (urlAction === 'add-item')      setQuickAdd({ mode: 'shopping' });
    if (urlAction === 'add-list-item') setQuickAdd({ mode: 'list' });
    window.history.replaceState(null, '', window.location.pathname);
  }, [userId, urlAction]);

  // Drop ?tab= from the address once it has opened its section
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tab') && !urlAction) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [urlAction]);

  // Tapping a notification while the app is already open: the service worker
  // sends us its link (our own message, or Firebase's notification-clicked one)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e) => {
      const d = e.data || {};
      const url = d.type === 'open-url' ? d.url
        : d.messageType === 'notification-clicked' ? (d.fcmOptions?.link || d.data?.url) : null;
      if (!url) return;
      const p = new URL(url, window.location.href).searchParams;
      if (p.get('action') === 'review') setShowReview(true);
      if (ALL_TABS.includes(p.get('tab'))) setTab(p.get('tab'));
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const saveDailyReview = async (prefs) => {
    await setDoc(doc(db, 'users', userId), { preferences: { dailyReview: prefs } }, { merge: true });
    setDailyReview(d => ({ ...d, ...prefs }));
  };

  const handleQuickTask = (data) => {
    tasksHook.addTask(data);
    if (data.notify?.enabled) registerPushToken(userId);
  };

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

  if (resetCode) {
    return <ResetPasswordScreen oobCode={resetCode} verifyResetCode={verifyResetCode} applyPasswordReset={applyPasswordReset} />;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.5 }}>Momentum</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive, marginBottom: 2 }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {TAB_DEFS[tab] && (
              <div style={{
                fontSize: 12, fontWeight: 600, color: T.khaki,
                background: '#2A3A1A', padding: '4px 10px', borderRadius: 20,
              }}>
                {TAB_DEFS[tab].label}
              </div>
            )}
            <button
              onClick={() => setShowReview(true)}
              aria-label="Daily review"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20,
                background: '#2A3A1A', border: `1px solid ${T.olive}`, color: T.khaki, fontSize: 13, fontWeight: 700,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" stroke={T.khaki} strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Review
            </button>
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
        // Room for the floating menu button on section pages
        paddingBottom: tab === 'home' ? 'calc(env(safe-area-inset-bottom) + 12px)' : 'calc(env(safe-area-inset-bottom) + 96px)',
        overflowY: 'auto',
      }}>
        {tab === 'home'      && <HomeMenu tabs={visibleTabs} onOpen={setTab} />}
        {tab === 'routines'  && <RoutinesTab hook={routinesHook} commitmentsHook={commitmentsHook} />}
        {tab === 'tasks'     && <TasksTab    hook={tasksHook} userId={userId} />}
        {tab === 'shopping'  && <ShoppingTab    hook={shoppingHook} userId={userId} />}
        {tab === 'birthdays' && <BirthdaysTab   hook={birthdaysHook} userId={userId} />}
        {tab === 'work'      && showWork && <WorkTab hook={workHook} />}
        {tab === 'notes'     && <NotesTab hook={notesHook} />}
        {tab === 'lists'     && <ListsTab hook={listsHook} />}
        {tab === 'investing' && <InvestingTab hook={investingHook} userId={userId} />}

        {quickAdd && (
          <QuickAddSheet
            initialMode={quickAdd.mode}
            shoppingHook={shoppingHook}
            listsHook={listsHook}
            onPick={key => { setQuickAdd(null); key === 'task' ? setNewTask(true) : setNewNote(true); }}
            onClose={() => setQuickAdd(null)}
          />
        )}
        {newTask && <CreateTaskModal onSave={handleQuickTask} onClose={() => setNewTask(false)} />}
        {newNote && <NoteEditor onSave={notesHook.addNote} onClose={() => setNewNote(false)} />}
        {showReview && (
          <DailyReviewModal
            routinesHook={routinesHook}
            tasksHook={tasksHook}
            birthdays={birthdaysHook.birthdays}
            onClose={() => setShowReview(false)}
          />
        )}

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
            notes={notesHook.notes}
            personalLists={listsHook.lists}
            dailyReview={dailyReview}
            onSaveDailyReview={saveDailyReview}
            userId={userId}
          />
        )}

      </main>

      <SwipeBack onBack={() => { if (!runBack() && tab !== 'home') setTab('home'); }} />

      {/* Main menu button: bottom-right, within thumb reach */}
      {tab !== 'home' && (
        <button
          onClick={() => setTab('home')}
          aria-label="Main menu"
          style={{
            position: 'fixed', zIndex: 46,
            right: 'max(20px, calc(50vw - 195px))', bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            width: 58, height: 58, borderRadius: 29,
            background: T.card, border: `1px solid ${T.subtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.5)', cursor: 'pointer',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke={T.khaki} strokeWidth="1.8" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke={T.khaki} strokeWidth="1.8" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke={T.khaki} strokeWidth="1.8" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" stroke={T.khaki} strokeWidth="1.8" />
          </svg>
        </button>
      )}

    </div>
  );
}

// Swipe in from the left edge to go back: closes the newest sheet or sub-screen,
// otherwise returns to the main menu. An arrow follows the finger.
const EDGE = 28, TRIGGER = 80;
function SwipeBack({ onBack }) {
  const [dx, setDx] = useState(0);
  const back = React.useRef(onBack);
  back.current = onBack;

  useEffect(() => {
    let start = null; // { x, y, active }
    const onStart = e => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t.clientX <= EDGE ? { x: t.clientX, y: t.clientY, active: false, dead: false } : null;
    };
    const onMove = e => {
      if (!start || start.dead) return;
      const t = e.touches[0];
      const mx = t.clientX - start.x, my = Math.abs(t.clientY - start.y);
      if (!start.active) {
        if (my > 12 && my > mx) { start.dead = true; return; } // vertical scroll, not a swipe
        if (mx > 10) start.active = true;
      }
      if (start.active) {
        if (e.cancelable) e.preventDefault();
        setDx(Math.max(0, Math.min(140, mx)));
      }
    };
    const onEnd = e => {
      if (start?.active) {
        const t = e.changedTouches[0];
        if (t.clientX - start.x >= TRIGGER) back.current();
      }
      start = null;
      setDx(0);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (!dx) return null;
  const ready = dx >= TRIGGER;
  return (
    <div style={{
      position: 'fixed', zIndex: 1000, top: '50%', left: 0, pointerEvents: 'none',
      transform: `translate(${Math.min(dx, TRIGGER) - 44}px, -50%)`,
      width: 40, height: 40, borderRadius: 20,
      background: ready ? T.olive : T.card, border: `1px solid ${T.subtle}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)', transition: 'background 0.15s',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}
