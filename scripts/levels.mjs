// Precomputes the levels (the solver is too slow to run on a phone for big ones).
// Usage: node scripts/levels.mjs [count] [from]   → src/levels.json
//   node scripts/levels.mjs          → builds levels 1-200 from scratch (always the same file)
//   node scripts/levels.mjs 200 101  → keeps levels 1-100 from the existing file, builds 101-200
// Every level is checked before it is written: it can be won, one run can meet all of its goals,
// an order trap cannot be won in the wrong order, and fog is fair (see plan in src/rules.js).
import { writeFileSync, readFileSync } from 'node:fs';
import { buildLevel, solve, plan, goalRules, encodeCell, encodeGoal, ORDER, REJECTS } from '../src/rules.js';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const count = Number(args[0] || 200);
const from = Number(args[1] || 1);
const old = from > 1 ? JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8')) : [];
const out = old.slice(0, from - 1);
let fallbacks = 0;
let built = 0;
const t0 = Date.now();
for (let n = from; n <= count; n++) {
  const t1 = Date.now();
  const L = buildLevel(n);
  if (!L.solution || !solve(L).wins) throw new Error('unsolvable ' + n);
  if (L.goals.length && !plan(L, goalRules(L.goals))) throw new Error('goals out of reach ' + n);
  const fog = L.towers.some((tw) => tw.some((c) => c.fog));
  if (fog && !plan(L, { ...goalRules(L.goals), fair: true })) throw new Error('unfair fog ' + n);
  if (L.order && plan(L, { breaks: ORDER[L.order] })) throw new Error('order trap that is not one ' + n);
  if (L.towers.length === 1 && n > 1) fallbacks++;
  const row = { s: L.start, t: L.towers.map((tw) => tw.map((c) => encodeCell(c))), sol: L.solution, r: +L.ratio.toFixed(4), c: L.careful ?? 1 };
  if (L.goals.length) row.g = L.goals.map(encodeGoal);
  if (L.order) row.o = L.order;
  if (L.teach) row.k = L.teach;
  out[n - 1] = row;
  built++;
  if (process.argv.includes('--verbose')) console.log(n, Date.now() - t1 + 'ms', JSON.stringify(row));
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} levels (${built} built) in ${((Date.now() - t0) / 1000).toFixed(0)} s, fallbacks ${fallbacks}`);
if (process.argv.includes('--verbose')) console.log('attempts thrown away:', JSON.stringify(REJECTS));
