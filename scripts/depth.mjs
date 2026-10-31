// The depth test: plays every level with the greedy bot of src/rules.js (naiveBot: grab every helpful
// floor it sees, then hit the weakest enemy it can beat, traps and curses only when nothing else is
// left) and counts how often it loses or misses a star. The puzzles should beat it on most levels
// past level 20. Usage: node scripts/depth.mjs [levels.json] [--list]
//   A file without goals (the levels before the puzzle update) is scored the old way: a win with no
//   hints or undo is 3 stars, which is what the bot always gets.
import { readFileSync } from 'node:fs';
import { decodeLevel, naiveBot, goalsMet, solve, plan, goalRules } from '../src/rules.js';

const file = process.argv.slice(2).find((a) => !a.startsWith('--')) || new URL('../src/levels.json', import.meta.url);
const raw = JSON.parse(readFileSync(file, 'utf8'));
const rows = raw.map((r, i) => {
  const L = decodeLevel(r, i + 1);
  const run = naiveBot(L);
  const goals = L.goals.length ? [{ k: 'win' }, ...L.goals] : [];
  const met = goals.length ? goalsMet(goals, { ...run, aids: 0 }) : [run.won, run.won, run.won];
  return { n: i + 1, won: run.won, stars: met.filter(Boolean).length, goals: goals.length };
});
function report(from, to) {
  const set = rows.filter((r) => r.n >= from && r.n <= to);
  const lost = set.filter((r) => !r.won).length;
  const short = set.filter((r) => r.stars < 3).length;
  const pct = (x) => ((100 * x) / set.length).toFixed(1) + '%';
  console.log(`levels ${from}-${to}: bot loses ${lost}/${set.length} (${pct(lost)}), misses a star or loses ${short}/${set.length} (${pct(short)}), average stars ${(set.reduce((a, r) => a + r.stars, 0) / set.length).toFixed(2)}`);
  return short / set.length;
}
report(1, 20);
const deep = report(21, rows.length);
report(1, rows.length);
if (process.argv.includes('--list')) for (const r of rows) console.log(r.n, r.won ? 'won' : 'lost', r.stars + '★');
// the test passes when the bot is beaten (loses or misses stars) on most levels past 20
if (process.argv.includes('--check')) {
  if (deep <= 0.5) { console.error('FAIL: the greedy bot gets 3 stars on most levels past 20'); process.exit(1); }
  // and every goal set really is reachable in one run
  for (const [i, r] of raw.entries()) {
    const L = decodeLevel(r, i + 1);
    if (!solve(L).wins || (L.goals.length && !plan(L, goalRules(L.goals)))) { console.error('FAIL: level ' + (i + 1)); process.exit(1); }
  }
  console.log('OK: depth test passed');
}
