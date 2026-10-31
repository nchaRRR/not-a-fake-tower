// Tests for the puzzle update: the rules of the new floors, the fairness rule for fog, order traps,
// goals, share codes (old codes still work) and the level file. Usage: node scripts/test-puzzle.mjs
import { readFileSync } from 'node:fs';
import { step, solve, plan, best, ORDER, naiveBot, goalsMet, decodeLevel, decodeCell, encodeCell, goalRules, buildLevel, levelSpec } from '../src/rules.js';
import { encode, decode } from '../src/codes.js';

let fails = 0;
const ok = (cond, what) => { if (!cond) { fails++; console.log('FAIL', what); } };
const L = (start, towers) => ({ start, towers: towers.map((tw) => tw.map(decodeCell)) });

// growing enemy: v + w per move made, absorbed at that power
ok(step(10, 0, decodeCell('g5+2'), 0).p === 15, 'grow at move 0');
ok(step(10, 0, decodeCell('g5+2'), 3).p === -1, 'grow at move 3 is 11: too strong for 10');
ok(step(12, 0, decodeCell('g5+2'), 3).p === 23, 'grow absorbed at its power of the moment');
// gate: only inside its range, power unchanged
ok(step(24, 0, decodeCell('r24')).p === 24 && step(25, 0, decodeCell('r24')) === null && step(23, 0, decodeCell('r24')) === null, 'exact gate');
ok(step(21, 0, decodeCell('r20-24')).p === 21 && step(19, 0, decodeCell('r20-24')) === null, 'range gate');
// ally: next fight won whatever its power, half the loot, never the boss
const joined = step(10, 0, decodeCell('a'));
ok(joined.a === 1, 'ally joins');
const hit = step(10, 0, decodeCell('e99'), 0, 1);
ok(hit.p === 10 + 49 && hit.a === 0 && hit.ally, 'ally fights, hero gets half');
ok(step(10, 0, decodeCell('b99'), 0, 1).p === -1, 'ally never fights the boss');
// a growing enemy that must be taken first
ok(!!plan(L(10, [['g8+3', 'e20'], ['e5', 'e6', 'b40']])), 'grow level solvable');

// fog fairness: two fogged floors whose contents swap places
const fair = L(10, [['e5', '~s20'], ['e6', '~e30'], ['b60']]);
ok(!!plan(fair) && !!plan(fair, { fair: true }), 'fair fog level');
// here the curse has to be taken before you can see what it hides, and the right call depends on
// whether the 17 or the potion is up there: solvable, but only by guessing
const unfair = L(10, [['h', '~e17'], ['e26', 's7'], ['s14', 't20', '~x', 'b71']]);
ok(!!plan(unfair) && !plan(unfair, { fair: true }), 'unfair fog is caught');
// a sword and a potion hide; which trap to walk into first depends on where they are
const blind = L(10, [['t26', '~s17'], ['x', 'x'], ['t13', '~x', 't11', 'b34']]);
const withSpy = L(10, [['y', 't26', '~s17'], ['x', 'x'], ['t13', '~x', 't11', 'b34']]);
ok(!plan(blind, { fair: true }) && !!plan(withSpy, { fair: true }), 'a spyglass makes it fair');

// order trap: sword before potion
const trap = { start: 10, towers: [[{ kind: 'potion', o: true }, { kind: 'enemy', v: 5 }], [{ kind: 'enemy', v: 8 }, { kind: 'sword', v: 10, o: true }], [{ kind: 'boss', v: 60 }]] };
ok(!!plan(trap) && !plan(trap, { breaks: ORDER.swordPotion }), 'potion before sword never wins');
ok(!naiveBot(trap).won, 'the greedy bot drinks first and loses');

// goals
const g = L(10, [['e5', 'e9', 'q'], ['x', 'b40']]);
ok(best(g, {}, 'moves') === 4, 'fewest moves');
ok(best(g, {}, 'power') === 88, 'most power');
ok(!!plan(g, { princess: true, maxMoves: 5 }) && !plan(g, { princess: true, maxMoves: 4 }), 'princess costs moves');
ok(goalsMet([{ k: 'win' }, { k: 'moves', n: 3 }, { k: 'nopotion' }], { won: true, moves: 3, potion: true }).join() === 'true,true,false', 'goalsMet');

// cells round trip
for (const c of ['e12', 'g12+3', 'r20-24', 'r24', '~x', '~g5+1', 'a', 'y', 'f6', 'q']) ok(encodeCell(decodeCell(c)) === c, 'cell ' + c);

// share codes: codes made before the update decode and re-encode to the same code
const OLD = ['8A90C1RK5540RJ', 'B7JGMD2J55TM8RNT73G', 'FMX2813HDJZ00G2060GMCY23KR'];
for (const c of OLD) { const p = decode(c); ok(p && encode(p) === c, 'old code ' + c); }
ok(decode(OLD[0]).towers[1][1].v === 32 && decode(OLD[1]).towers[2][0].kind === 'fuse', 'old code contents');
// new pieces use version 2
const P = { start: 9, world: 2, towers: [[{ kind: 'grow', v: 4, w: 2 }, { kind: 'enemy', v: 7, fog: true }], [{ kind: 'gate', v: 20, w: 24 }, { kind: 'ally' }, { kind: 'spy' }, { kind: 'boss', v: 90 }]] };
const code = encode(P);
const back = decode(code);
ok(back && back.start === 9 && back.world === 2 && JSON.stringify(back.towers) === JSON.stringify(P.towers) && encode(back) === code, 'v2 round trip');
ok(decode(code.slice(0, -1) + (code.endsWith('0') ? '1' : '0')) === null, 'v2 checksum');

// the level file: what the game ships
const raw = JSON.parse(readFileSync(new URL('../src/levels.json', import.meta.url), 'utf8'));
ok(raw.length >= 200, '200 levels');
const seen = {};
raw.forEach((r, i) => {
  const lv = decodeLevel(r, i + 1);
  for (const c of lv.towers.flat()) { seen[c.kind] = seen[c.kind] || i + 1; if (c.fog) seen.fog = seen.fog || i + 1; }
  if (lv.order) seen.order = seen.order || i + 1;
  ok(i < 3 || lv.goals.length === 2, 'two goals on level ' + (i + 1));
});
ok(seen.grow === 16 && seen.order === 26 && seen.gate === 36 && seen.ally === 46 && seen.fog === 56, 'teaching levels ' + JSON.stringify(seen));
ok(raw.some((r) => r.t.flat().some((c) => c[0] === 'f')), 'bomb levels kept');
// the generator is deterministic
ok(JSON.stringify(buildLevel(37)) === JSON.stringify(buildLevel(37)) && levelSpec(56).fog === 2, 'deterministic');

console.log(fails ? `${fails} failed` : 'OK: all puzzle tests passed');
process.exit(fails ? 1 : 0);
