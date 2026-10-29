// Reminders the phone shows while the game is closed. No server: the phone schedules them itself.
// Works through Capacitor's Local Notifications plugin once the app is packaged
// (npm i @capacitor/local-notifications && npx cap sync). In a browser it does nothing.
import { t } from './i18n.js';

const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function at(daysFromNow, hour, minute, base) {
  const d = new Date(base);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// What to remind about, given the save. Pure, so it can be tested.
export function planNotifications(save, now = new Date()) {
  const today = dayKey(now);
  const list = [];
  // daily reward: tomorrow morning if today's is taken, otherwise later today
  const rewardTaken = save.lastDaily === today;
  list.push({ id: 101, at: rewardTaken ? at(1, 10, 0, now) : at(0, 12, 0, now), title: t('note.reward.title'), body: t('note.reward.body') });
  // daily tower: this evening if not solved yet, otherwise tomorrow evening
  const towerDone = save.dtLast === today;
  const towerAt = towerDone ? at(1, 19, 0, now) : at(0, 19, 0, now);
  list.push({ id: 102, at: towerAt > now ? towerAt : at(1, 19, 0, now), title: t('note.tower.title'), body: t('note.tower.body', { n: (save.dtStreak || 0) + 1 }) });
  // come back after a few quiet days
  list.push({ id: 103, at: at(3, 19, 30, now), title: t('note.back.title', { n: save.level || 1 }), body: t('note.back.body', { n: save.level || 1 }) });
  list.push({ id: 104, at: at(7, 19, 30, now), title: t('note.back7.title'), body: t('note.back7.body') });
  return list.filter((n) => n.at > now);
}

export async function scheduleNotifications(save) {
  const ln = plugin();
  if (!ln) return false;
  try {
    const pending = await ln.getPending();
    if (pending && pending.notifications && pending.notifications.length) await ln.cancel({ notifications: pending.notifications });
    if (save.notify === false) return true;
    const list = planNotifications(save).map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } }));
    await ln.schedule({ notifications: list });
    return true;
  } catch (e) {
    return false;
  }
}

// Asked once, at a moment the player is happy (after an early win).
export async function askNotificationPermission() {
  const ln = plugin();
  if (!ln) return 'unavailable';
  try {
    const r = await ln.requestPermissions();
    return r && r.display;
  } catch (e) {
    return 'error';
  }
}
