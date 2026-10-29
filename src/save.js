// Local progress. Storage can throw in private windows and previews;
// the game keeps running and simply does not remember.
const KEY = 'nfa-tower-v1';
const DEFAULTS = { coins: 0, level: 1, muted: false, seenHow: false, up: { power: 0, income: 0 }, skin: 'blue', skins: ['blue'], hints: 3, music: true, stars: {}, stats: {}, ach: {}, vibrate: true };
const fresh = () => JSON.parse(JSON.stringify(DEFAULTS));
export const freshSave = fresh;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...data, up: { ...base.up, ...(data.up || {}) }, stars: { ...(data.stars || {}) }, stats: { ...(data.stats || {}) }, ach: { ...(data.ach || {}) } };
  } catch (e) {
    return fresh();
  }
}

let onWrite = null;
export function watchSave(fn) { onWrite = fn; }

export function writeSave(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* session only */ }
  if (onWrite) onWrite(state);
}
