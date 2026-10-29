// Precomputes the levels (the solver is too slow to run on a phone for big ones).
// Usage: node scripts/levels.mjs [count]   → src/levels.json
import { writeFileSync, readFileSync } from 'node:fs';
import { buildLevel, solve, CODE } from '../src/rules.js';
// node scripts/levels.mjs 200 101  → keeps levels 1-100 from the existing file, builds 101-200
const count = Number(process.argv[2] || 100);
const from = Number(process.argv[3] || 1);
const out = from > 1 ? JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8')).slice(0, from - 1) : [];
let fallbacks = 0;
for (let n = from; n <= count; n++) {
  const L = buildLevel(n);
  if (!L.solution || !solve(L).wins) throw new Error('unsolvable ' + n);
  if (L.towers.length === 1 && n > 1) fallbacks++;
  out.push({ s: L.start, t: L.towers.map((tw) => tw.map((c) => CODE[c.kind] + (c.v ?? ''))), sol: L.solution, r: +L.ratio.toFixed(4), c: L.careful ?? 1 });
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} levels, fallbacks ${fallbacks}`);
