// Weekly events: one rule per calendar week (Monday to Sunday), the same for everyone.
// Week 0 starts on Monday 26 October 2026.
export const EVENTS = ['potion3', 'sword2', 'trapHalf', 'coins2'];
export const WEEK_GOAL = 15;
export const WEEK_REWARD = 300;
const EPOCH = Date.UTC(2026, 9, 26, 12);

export function currentEvent(now = new Date()) {
  const noon = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const days = Math.round((noon - EPOCH) / 864e5);
  const week = Math.floor(days / 7);
  const id = EVENTS[((week % EVENTS.length) + EVENTS.length) % EVENTS.length];
  const daysLeft = 7 - (((days % 7) + 7) % 7);
  return { id, week, daysLeft };
}
