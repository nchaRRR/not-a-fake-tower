// What the shop sells. Everything is bought with coins earned by clearing levels.
export const UPGRADES = {
  // +5% starting power per level. More power never makes a level harder, so every level stays solvable.
  power: { max: 10, pct: 5, cost: (l) => Math.round((60 * Math.pow(1.55, l)) / 10) * 10 },
  // +10% coins per cleared level.
  income: { max: 10, pct: 10, cost: (l) => Math.round((80 * Math.pow(1.6, l)) / 10) * 10 },
};

export const SKINS = [
  { id: 'blue', cost: 0, body: 0x2f7cf6, head: 0xffd2b0, helmet: 0x1d5bc4, pack: 0x1d5bc4, legs: 0x23366b },
  { id: 'ranger', cost: 150, body: 0x2eb872, head: 0xffd2b0, helmet: 0x1f6b3a, pack: 0x8a5a2b, legs: 0x2d3b22 },
  { id: 'ninja', cost: 300, body: 0x2b2b38, head: 0xffd2b0, helmet: 0x16161e, pack: 0x16161e, legs: 0x16161e },
  { id: 'knight', cost: 500, body: 0xb9c3d1, head: 0xffd2b0, helmet: 0xdfe6ef, pack: 0x8a96a8, legs: 0x5d6878 },
  { id: 'blaze', cost: 800, body: 0xff8c3a, head: 0xffd2b0, helmet: 0xffbe2e, pack: 0xc95a1a, legs: 0x5a2a10 },
  { id: 'golden', cost: 1500, body: 0xffbe2e, head: 0xffd2b0, helmet: 0xffe07a, pack: 0xc98a00, legs: 0x8a5e00 },
];

export const HINT_PACKS = [
  { n: 3, cost: 60 },
  { n: 10, cost: 180 },
];

export const startPower = (base, lvl) => (lvl ? Math.max(base + lvl, Math.round(base * (1 + (UPGRADES.power.pct * lvl) / 100))) : base);
export const coinReward = (n, lvl) => Math.round((20 + n * 2) * (1 + (UPGRADES.income.pct * lvl) / 100));
