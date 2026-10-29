// Difficulty report: how often simulated players win each level.
//   random:   taps any tower
//   careful:  never makes a move that kills on the spot (what most real players do)
// Usage: node scripts/balance.mjs [levels.json]
import { readFileSync } from 'node:fs';
import { decodeLevel, solve, step, mulberry32 } from '../src/rules.js';

const file = process.argv[2] || new URL('../src/levels.json', import.meta.url);
const raw = JSON.parse(readFileSync(file, 'utf8'));

export function simulate(level, careful, runs, rng) {
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    const h = level.towers.map(() => 0);
    let p = level.start;
    let k = 0;
    for (;;) {
      const opts = [];
      for (let t = 0; t < h.length; t++) {
        if (h[t] >= level.towers[t].length) continue;
        const ns = step(p, k, level.towers[t][h[t]]);
        if (!ns) continue;
        if (careful && ns.p < 0) continue;
        opts.push([t, ns]);
      }
      if (!opts.length) { if (h.every((v, t) => v >= level.towers[t].length)) wins++; break; }
      const [t, ns] = opts[Math.floor(rng() * opts.length)];
      if (ns.p < 0) break;
      const boss = level.towers[t][h[t]].kind === 'boss';
      h[t]++;
      p = ns.p;
      k = ns.k;
      if (boss) { wins++; break; }
    }
  }
  return wins / runs;
}

const rng = mulberry32(42);
const rows = raw.map((r, i) => {
  const L = decodeLevel(r, i + 1);
  return { n: i + 1, floors: L.towers.flat().length, careful: simulate(L, true, 3000, rng), random: solve(L).ratio };
});
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of rows) console.log(String(r.n).padStart(3), String(r.floors).padStart(3), (r.careful * 100).toFixed(1).padStart(6) + '%', (r.random * 100).toFixed(2).padStart(7) + '%');
}
