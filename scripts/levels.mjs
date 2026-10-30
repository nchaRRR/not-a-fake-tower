// Precomputes the levels (the solver is too slow to run on a phone for big ones).
// Usage: node scripts/levels.mjs [count]   → src/levels.json
import { writeFileSync, readFileSync } from 'node:fs';
import { buildLevel, solve, CODE, fuseLevel } from '../src/rules.js';
// node scripts/levels.mjs 200 101  → keeps levels 1-100 from the existing file, builds 101-200
// node scripts/levels.mjs 200 --bombs → keeps every level in the file, rebuilds only the bomb levels
const bombsOnly = process.argv.includes('--bombs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const count = Number(args[0] || 100);
const from = Number(args[1] || 1);
const old = from > 1 || bombsOnly ? JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8')) : [];
const out = bombsOnly ? old.slice(0, count) : old.slice(0, from - 1);
let fallbacks = 0;
let built = 0;
for (let n = bombsOnly ? 1 : from; n <= count; n++) {
  if (bombsOnly && out[n - 1] && !fuseLevel(n)) continue;
  const L = buildLevel(n);
  if (!L.solution || !solve(L).wins) throw new Error('unsolvable ' + n);
  if (L.towers.length === 1 && n > 1) fallbacks++;
  out[n - 1] = { s: L.start, t: L.towers.map((tw) => tw.map((c) => CODE[c.kind] + (c.v ?? ''))), sol: L.solution, r: +L.ratio.toFixed(4), c: L.careful ?? 1 };
  built++;
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} levels (${built} built), fallbacks ${fallbacks}`);
