// Goals with coin rewards. Each reads its progress from the save.
const totalStars = (s) => Object.values(s.stars || {}).reduce((a, b) => a + b, 0);
const st = (k) => (s) => s.stats[k] || 0;
const cleared = (s) => Math.max(0, s.level - 1);

export const ACHIEVEMENTS = [
  { id: 'first', goal: 1, get: cleared, reward: 20 },
  { id: 'lv10', goal: 10, get: cleared, reward: 50 },
  { id: 'lv25', goal: 25, get: cleared, reward: 100 },
  { id: 'lv50', goal: 50, get: cleared, reward: 200 },
  { id: 'lv100', goal: 100, get: cleared, reward: 500 },
  { id: 'lv200', goal: 200, get: cleared, reward: 1000 },
  { id: 'boss10', goal: 10, get: st('bosses'), reward: 80 },
  { id: 'boss50', goal: 50, get: st('bosses'), reward: 250 },
  { id: 'perfect10', goal: 10, get: st('perfect'), reward: 100 },
  { id: 'perfect50', goal: 50, get: st('perfect'), reward: 300 },
  { id: 'princess5', goal: 5, get: st('princesses'), reward: 100 },
  { id: 'doors10', goal: 10, get: st('doors'), reward: 100 },
  { id: 'shields20', goal: 20, get: st('shields'), reward: 120 },
  { id: 'stars100', goal: 100, get: totalStars, reward: 200 },
  { id: 'skins3', goal: 3, get: (s) => s.skins.length, reward: 100 },
  { id: 'streak7', goal: 7, get: (s) => s.streak || 0, reward: 150 },
  { id: 'daily5', goal: 5, get: st('dailyTowers'), reward: 150 },
  { id: 'rich', goal: 5000, get: st('coins'), reward: 200 },
];

export const claimable = (s) => ACHIEVEMENTS.filter((a) => !s.ach[a.id] && a.get(s) >= a.goal).length;
