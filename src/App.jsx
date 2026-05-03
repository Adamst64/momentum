import React, { useState } from 'react';
import { T } from './theme';
import BottomNav from './components/BottomNav';
import RoutinesTab from './components/routines/RoutinesTab';
import AllRoutinesTab from './components/routines/AllRoutinesTab';
import TasksTab from './components/tasks/TasksTab';
import ShoppingTab from './components/shopping/ShoppingTab';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './hooks/useAuth';
import { useRoutines } from './hooks/useRoutines';
import { useTasks } from './hooks/useTasks';
import { useEndDay } from './hooks/useEndDay';
import { useShoppingList } from './hooks/useShoppingList';

const TAB_LABELS = { routines: 'Routines', weekly: 'Weekly', tasks: 'Tasks', shopping: 'Shopping' };

export default function App() {
  const { user, signIn, signUp, logOut, changePassword } = useAuth();
  const [tab, setTab] = useState('routines');
  const [showSettings, setShowSettings] = useState(false);

  const userId = user?.uid ?? null;
  const routinesHook  = useRoutines(userId);
  const tasksHook     = useTasks(userId);
  const endDayHook    = useEndDay(userId);
  const shoppingHook  = useShoppingList(userId);

  // Still determining auth state
  if (user === undefined) {
    return (
      <div style={{ background: T.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.olive }} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="8"  cy="6"  r="2" fill={T.bg} stroke={T.muted} strokeWidth="1.8" />
                <circle cx="16" cy="12" r="2" fill={T.bg} stroke={T.muted} strokeWidth="1.8" />
                <circle cx="10" cy="18" r="2" fill={T.bg} stroke={T.muted} strokeWidth="1.8" />
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
        {tab === 'routines'  && <RoutinesTab    hook={routinesHook} endDayHook={endDayHook} />}
        {tab === 'weekly'    && <AllRoutinesTab hook={routinesHook} />}
        {tab === 'tasks'     && <TasksTab       hook={tasksHook} />}
        {tab === 'shopping'  && <ShoppingTab    hook={shoppingHook} />}

        {showSettings && (
          <SettingsModal
            user={user}
            onChangePassword={changePassword}
            onSignOut={() => { logOut(); setShowSettings(false); }}
            onClose={() => setShowSettings(false)}
            routines={routinesHook.routines}
            tasks={tasksHook.tasks}
            shopping={shoppingHook.items}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
