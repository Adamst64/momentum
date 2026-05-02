import React, { useState } from 'react';
import { T } from './theme';
import BottomNav from './components/BottomNav';
import RoutinesTab from './components/routines/RoutinesTab';
import AllRoutinesTab from './components/routines/AllRoutinesTab';
import TasksTab from './components/tasks/TasksTab';
import { useRoutines } from './hooks/useRoutines';
import { useTasks } from './hooks/useTasks';
import { useEndDay } from './hooks/useEndDay';

const TAB_LABELS = { routines: 'Routines', weekly: 'Weekly', tasks: 'Tasks' };

export default function App() {
  const [tab, setTab]  = useState('routines');
  const routinesHook   = useRoutines();
  const tasksHook      = useTasks();
  const endDayHook     = useEndDay();

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
          <div style={{
            fontSize: 12, fontWeight: 600, color: T.khaki,
            background: '#2A3A1A', padding: '4px 10px', borderRadius: 20,
          }}>
            {TAB_LABELS[tab]}
          </div>
        </div>
      </header>

      <main style={{
        paddingTop: 20,
        paddingBottom: `calc(${T.navH}px + env(safe-area-inset-bottom) + 12px)`,
        overflowY: 'auto',
      }}>
        {tab === 'routines' && <RoutinesTab    hook={routinesHook} endDayHook={endDayHook} />}
        {tab === 'weekly'   && <AllRoutinesTab hook={routinesHook} />}
        {tab === 'tasks'    && <TasksTab       hook={tasksHook} />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
