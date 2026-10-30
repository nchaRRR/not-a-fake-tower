// Seasonal looks. Christmas runs from 1 December to 6 January on the phone's own clock.
// The remote config can switch it on or off for everyone ('season': 'xmas' | 'off').
export function isXmasDate(now = new Date()) {
  const m = now.getMonth();
  return m === 11 || (m === 0 && now.getDate() <= 6);
}

export function createSeason(remote) {
  let forced = null; // test hook: 'xmas' | 'off' | null
  return {
    xmas() {
      if (forced) return forced === 'xmas';
      const r = remote.get('season', '');
      if (r === 'xmas') return true;
      if (r === 'off') return false;
      return isXmasDate();
    },
    force(v) { forced = v === 'xmas' || v === 'off' ? v : null; },
  };
}
