// The daily tower: which puzzle belongs to which day.
// Day 0 is 25 October 2026 (local calendar days are mapped through UTC noon to avoid DST edges).
export const DAILY_EPOCH = Date.UTC(2026, 9, 25, 12);

export function dayIndex(date = new Date()) {
  const noon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return Math.round((noon - DAILY_EPOCH) / 864e5);
}
// Harder towards the weekend: Monday plays like level 14, Sunday like level 60.
export function dailySpecN(date) {
  return [60, 14, 20, 27, 34, 42, 50][date.getDay()];
}
export const dailySeed = (d) => 500009 + d * 7717;
