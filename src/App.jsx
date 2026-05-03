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
  const [showManageRoutines, setShowManageRoutines] = useState(false);

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
            onManageRoutines={() => setShowManageRoutines(true)}
            routines={routinesHook.routines}
            tasks={tasksHook.tasks}
            shopping={shoppingHook.items}
          />
        )}

        {showManageRoutines && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: T.bg,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 'calc(52px + env(safe-area-inset-top)) 20px 14px',
              borderBottom: `1px solid ${T.cardBorder}`,
              background: T.bg, flexShrink: 0,
            }}>
              <button
                onClick={() => setShowManageRoutines(false)}
                style={{ color: T.khaki, fontSize: 22, lineHeight: 1, padding: '2px 0' }}
              >
                ←
              </button>
              <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Manage Routines</span>
            </div>
            <div style={{
              flex: 1, overflowY: 'auto',
              paddingTop: 16,
              paddingBottom: `calc(env(safe-area-inset-bottom) + 16px)`,
            }}>
              <AllRoutinesTab hook={routinesHook} />
            </div>
          </div>
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
