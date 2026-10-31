// Precomputes the daily towers: one puzzle per calendar day, the same for every player.
// Usage: node scripts/daily.mjs [days]   → src/daily.json (index 0 = DAILY_EPOCH in src/daily.js)
// Days before DAILY_V2 were already played with the old generator and are rebuilt with it, exactly
// as they were; from DAILY_V2 on, some days bring a growing enemy or a power gate.
import { writeFileSync } from 'node:fs';
import { buildLevel, buildLegacy, encodeCell } from '../src/rules.js';
import { DAILY_EPOCH, DAILY_V2, dailySpecN, dailySeed } from '../src/daily.js';

const days = Number(process.argv[2] || 440);
const out = [];
for (let d = 0; d < days; d++) {
  const date = new Date(DAILY_EPOCH + d * 864e5);
  const L = d < DAILY_V2 ? buildLegacy(dailySpecN(date), dailySeed(d)) : buildLevel(dailySpecN(date), dailySeed(d));
  out.push({ s: L.start, t: L.towers.map((tw) => tw.map((c) => encodeCell(c))), sol: L.solution, r: +L.ratio.toFixed(4), c: L.careful ?? 1 });
}
writeFileSync(new URL('../src/daily.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} daily towers`);
