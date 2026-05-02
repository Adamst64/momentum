const SENT_KEY = 'momentum_notifs_sent';

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const r = await Notification.requestPermission();
  return r === 'granted';
}

export function notify(title, body, tag) {
  if (typeof window !== 'undefined' && Notification?.permission === 'granted') {
    new Notification(title, { body, tag, icon: '/icon-192.png' });
  }
}

export function checkRecurringNotifications(tasks) {
  const today = new Date();
  const dd = today.getDate();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch {}

  tasks.forEach(task => {
    if (task.type !== 'recurring-monthly') return;
    const daysUntil = task.dayOfMonth - dd;
    if (daysUntil === 3) {
      const key = `${task.id}-${ym}-3d`;
      if (!sent[key]) {
        notify(
          'Upcoming task in 3 days',
          `"${task.name}" is due on the ${task.dayOfMonth}${ordinal(task.dayOfMonth)}`,
          key
        );
        sent[key] = true;
        localStorage.setItem(SENT_KEY, JSON.stringify(sent));
      }
    }
  });
}

function ordinal(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
