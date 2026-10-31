// Not a Fake Ad: Tower — the rules and the level generator. Pure logic, no DOM, runs in Node.
//
// The board is a row of towers. Each tower is a stack of floors, bottom first. The hero may
// only step into the LOWEST floor still occupied in any tower, so a strong enemy at the bottom
// shuts the floors above it until the hero has grown enough. Every step into a floor is one move.
// What each floor does:
//   enemy v   hero power must be GREATER than v, then the hero absorbs it: power += v
//   boss v    same as an enemy (drawn big, always the last floor of its tower)
//   sword v   power += v
//   potion    power *= 2   (timing matters: drink it when you are big)
//   trap v    power -= v   (the hero dies if power drops to 0 or below)
//   princess  nothing; rescuing her (stepping into her floor before the boss) can be a level goal.
//             Old levels and builder towers keep her on top of the boss tower, freed at the end.
//   shield v  a shield bearer: hero power must be MORE THAN TWICE v, then power += v
//   curse     power = floor(power / 2)   (the hero dies if that leaves 0)
//   key       the hero picks up a key
//   lock      a locked door: it can only be entered while carrying a key, which it uses up
//   fuse v    a lit bomb: it must be entered (defused) by move v at the latest. If v floors have been
//             cleared and it is still standing, it goes off and the hero is lost. Power is unchanged.
//   grow v+w  a growing enemy: after m moves its power is v + w*m. It is fought like an enemy at its
//             power of the moment (and that is what the hero absorbs), so the longer it waits, the worse.
//   gate v-w  an exact-power door: it only opens while the hero's power is between v and w (both
//             included; v = w for "exactly v"). Like a locked door, it is simply not allowed otherwise.
//   ally      a friend joins the hero and fights the NEXT enemy, shield bearer or growing enemy the
//             hero steps into, whatever its power. The ally keeps half the loot: the hero only gains
//             floor(v / 2). Allies never fight the boss (the hero must do that himself).
//   spy       a spyglass: power unchanged, it clears the fog from every floor.
// Any floor except bosses, keys, doors, gates, bombs, allies, spyglasses and the princess can be
// fogged (`fog: true`): the player sees a cloud until the floor below it is cleared (the floor you
// are about to step into is never hidden) or a spyglass clears it. The level lists WHAT is in the
// fog, never WHERE (see `plan` with `fair: true` for the fairness rule).
// The level is won the moment the boss is beaten (levels without a boss: when every floor is cleared).

export const KINDS = ['enemy', 'shield', 'boss', 'sword', 'potion', 'trap', 'princess', 'curse', 'key', 'lock', 'fuse', 'grow', 'ally', 'gate', 'spy'];
// One letter per kind in levels.json: e12 enemy, b80 boss, s5 sword, x potion (x2), t9 trap, q princess,
// h curse (half), k key, l lock, d12 shield bearer, f6 bomb (defuse by move 6), g12+3 growing enemy
// (12, +3 every move), r24 gate (exactly 24) or r20-24 (20 to 24), a ally, y spyglass. A leading ~ is fog.
export const CODE = { shield: 'd', enemy: 'e', boss: 'b', sword: 's', potion: 'x', trap: 't', princess: 'q', curse: 'h', key: 'k', lock: 'l', fuse: 'f', grow: 'g', ally: 'a', gate: 'r', spy: 'y' };
const DECODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
export const FOGGABLE = new Set(['enemy', 'shield', 'grow', 'sword', 'potion', 'trap', 'curse']);
export const FIGHTS = new Set(['enemy', 'shield', 'grow']);

export function decodeCell(c) {
  const fog = c[0] === '~';
  if (fog) c = c.slice(1);
  const cell = { kind: DECODE[c[0]] };
  const m = /^(\d+)(?:[+-](\d+))?$/.exec(c.slice(1));
  if (m) {
    cell.v = Number(m[1]);
    if (m[2] !== undefined) cell.w = Number(m[2]);
  }
  if (cell.kind === 'gate' && cell.w === undefined) cell.w = cell.v;
  if (fog) cell.fog = true;
  return cell;
}
export function encodeCell(c, withFog = true) {
  let s = (withFog && c.fog ? '~' : '') + CODE[c.kind] + (c.v ?? '');
  if (c.kind === 'grow') s += '+' + c.w;
  if (c.kind === 'gate' && c.w !== c.v) s += '-' + c.w;
  return s;
}

// Goals (the stars). In levels.json: m9 finish in at most 9 moves, p120 end with at least 120 power,
// q rescue the princess, x drink no potion, n no hints, undo or boosters. Beating the level is always the
// first goal; a level with no goals listed gives its 3 stars the old way (no hints, no undo).
export function decodeGoals(list) {
  return (list || []).map((g) => {
    const k = { m: 'moves', p: 'power', q: 'princess', x: 'nopotion', n: 'noaid' }[g[0]];
    const [a, b] = g.slice(1).split('/');
    return { k, n: a ? Number(a) : undefined, best: b ? Number(b) : undefined };
  });
}
export const encodeGoal = (g) => ({ moves: 'm', power: 'p', princess: 'q', nopotion: 'x', noaid: 'n' })[g.k] + (g.n ?? '') + (g.best ? '/' + g.best : '');

export function decodeLevel(raw, n) {
  return {
    n,
    start: raw.s,
    towers: raw.t.map((tw) => tw.map(decodeCell)),
    solution: raw.sol,
    ratio: raw.r,
    goals: decodeGoals(raw.g),
    order: raw.o || null,
    teach: raw.k || null,
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weekly event that bends the numbers, always in the player's favour (so every level stays
// solvable): 'potion3' potions triple, 'sword2' swords count double, 'trapHalf' traps take half.
// Levels with an exact-power gate are played without it (more power can shut a gate).
let EVENT = null;
export function setEvent(id) { EVENT = id; }
// The solver without the weekly event: what the player builds must stay solvable every week.
export function solvePlain(level) {
  const e = EVENT;
  EVENT = null;
  try { return solve(level); } finally { EVENT = e; }
}
export const potionMult = () => (EVENT === 'potion3' ? 3 : 2);
export const swordValue = (cell) => (EVENT === 'sword2' ? cell.v * 2 : cell.v);
export const trapValue = (cell) => (EVENT === 'trapHalf' ? Math.ceil(cell.v / 2) : cell.v);
// a growing enemy's power after m moves
export const growPower = (cell, m) => cell.v + cell.w * m;
// the power a fight is about (what the hero must beat and what he absorbs), after m moves
export const fightValue = (cell, m = 0) => (cell.kind === 'grow' ? growPower(cell, m) : cell.v);
export const hasGate = (towers) => towers.some((tw) => tw.some((c) => c.kind === 'gate'));

// Applies one floor to a power. Returns the new power, or -1 when the hero dies.
export function apply(power, cell, m = 0) {
  switch (cell.kind) {
    case 'enemy':
    case 'boss':
    case 'grow':
      return power > fightValue(cell, m) ? power + fightValue(cell, m) : -1;
    case 'sword': return power + swordValue(cell);
    case 'potion': return power * potionMult();
    case 'trap': return power - trapValue(cell) > 0 ? power - trapValue(cell) : -1;
    case 'shield': return power > 2 * cell.v ? power + cell.v : -1;
    case 'curse': return Math.floor(power / 2) > 0 ? Math.floor(power / 2) : -1;
    default: return power;
  }
}

// Whole step with keys and allies, at move m (moves made before this one), with a allies along.
// Returns { p, k, a } after entering the floor (ally: true when an ally fought), null when the
// move is not allowed (a locked door without a key, a gate at the wrong power), or { p: -1 } when
// the hero dies.
export function step(p, k, cell, m = 0, a = 0) {
  switch (cell.kind) {
    case 'lock': return k > 0 ? { p, k: k - 1, a } : null;
    case 'key': return { p, k: k + 1, a };
    case 'gate': return p >= cell.v && p <= cell.w ? { p, k, a } : null;
    case 'ally': return { p, k, a: a + 1 };
    case 'enemy':
    case 'shield':
    case 'grow':
      if (a > 0) return { p: p + Math.floor(fightValue(cell, m) / 2), k, a: a - 1, ally: true };
      return { p: apply(p, cell, m), k, a };
    default: return { p: apply(p, cell, m), k, a };
  }
}

// Bombs: with h floors cleared per tower and `moves` floors cleared in all, does a bomb that is
// still standing go off? (Deadlines count from the start of the level.)
export function fuseOut(towers, h, moves) {
  for (let t = 0; t < towers.length; t++) {
    const tw = towers[t];
    for (let k = h[t]; k < tw.length; k++) if (tw[k].kind === 'fuse' && tw[k].v <= moves) return true;
  }
  return false;
}
const hasFuse = (towers) => towers.some((tw) => tw.some((c) => c.kind === 'fuse'));
const hasBossIn = (towers) => towers.some((tw) => tw.some((c) => c.kind === 'boss'));

// Exhaustive search over every order. Returns how many orders win, how many orders exist,
// and one winning order (tower indexes) if there is one. The solver sees through fog.
export function solve(level) {
  const towers = level.towers;
  const memo = new Map();
  const fuses = hasFuse(towers);
  const moves0 = level.moves || 0; // floors already cleared before this position (hints mid-level)
  const place = placeValues(towers);
  // memo: heights, keys and allies make one number, the power a second level
  function count(h, p, keys, a, m) {
    const mk = (hcode(h, place) * 8 + Math.min(7, keys)) * 8 + Math.min(7, a);
    let byP = memo.get(mk);
    if (!byP) memo.set(mk, (byP = new Map()));
    const seen = byP.get(p);
    if (seen) return seen;
    let wins = 0;
    let total = 0;
    let best = null;
    let done = true;
    let moved = false;
    for (let t = 0; t < towers.length; t++) {
      if (h[t] >= towers[t].length) continue;
      done = false;
      const ns = step(p, keys, towers[t][h[t]], moves0 + m, a);
      if (!ns) continue; // locked, not allowed
      moved = true;
      if (ns.p < 0) {
        // every continuation from here is a loss; count those orders
        total += orders(h, t);
        continue;
      }
      if (towers[t][h[t]].kind === 'boss') {
        // beating the boss ends the level
        wins += 1;
        total += 1;
        if (!best) best = [t];
        continue;
      }
      h[t]++;
      if (fuses && fuseOut(towers, h, moves0 + m + 1)) {
        // a bomb went off: a loss, like dying
        h[t]--;
        total += orders(h, t);
        continue;
      }
      const r = count(h, ns.p, ns.k, ns.a, m + 1);
      h[t]--;
      wins += r.wins;
      total += r.total;
      if (r.wins > 0 && !best) best = [t, ...r.path];
    }
    const res = done ? { wins: 1, total: 1, path: [] } : !moved ? { wins: 0, total: 1, path: [] } : { wins, total, path: best || [] };
    byP.set(p, res);
    return res;
  }
  // number of complete orders that start by taking tower t from heights h
  function orders(h, t) {
    const left = towers.map((tw, i) => tw.length - h[i] - (i === t ? 1 : 0));
    return multinomial(left);
  }
  const r = count(towers.map(() => 0), level.start, level.keys || 0, level.allies || 0, 0);
  return { wins: r.wins, total: r.total, ratio: r.total ? r.wins / r.total : 0, path: r.path };
}

// Tower heights as one number (mixed radix: each tower counts up to its own height).
function placeValues(towers) {
  const out = [];
  let x = 1;
  for (const tw of towers) { out.push(x); x *= tw.length + 1; }
  return out;
}
function hcode(h, place) {
  let x = 0;
  for (let i = 0; i < h.length; i++) x += h[i] * place[i];
  return x;
}

const factCache = [1];
function fact(n) {
  for (let i = factCache.length; i <= n; i++) factCache[i] = factCache[i - 1] * i;
  return factCache[n];
}
function multinomial(parts) {
  const n = parts.reduce((a, b) => a + b, 0);
  return parts.reduce((acc, k) => acc / fact(k), fact(n));
}

// ---------------------------------------------------------------- goals, order traps and fog
// Flags carried through the searches below.
const F_PRINCESS = 1;
const F_POTION = 2;
const F_CURSE = 4;
const F_SPY = 8;
const F_SWORD = 16; // a sword has been taken
const F_BROKE = 32; // the order rule in o.breaks was broken
const F_OPOT = 64; // the potion of an order trap has been drunk
const flagOf = (cell) => (({ princess: F_PRINCESS, potion: F_POTION, curse: F_CURSE, spy: F_SPY, sword: F_SWORD })[cell.kind] || 0) | (cell.o && cell.kind === 'potion' ? F_OPOT : 0);
// Order traps: a rule the winning order must keep. rule(cell, h, flags, towers) says a move would
// break it; a level is an order trap when NO win exists that breaks it (plan with o.breaks finds none).
// The rule is about the two floors the generator marked (cell.o), not about every potion or trap.
const swordLeft = (towers, h) => towers.some((tw, t) => tw.some((c, k) => k >= h[t] && c.kind === 'sword' && c.o));
export const ORDER = {
  // the potion is only worth drinking after the sword
  swordPotion: (c, h, f, T) => c.kind === 'potion' && c.o && swordLeft(T, h),
  // the curse has to be taken while the hero is small, before the potion doubles him
  cursePotion: (c, h, f) => c.kind === 'curse' && c.o && (f & F_OPOT) !== 0,
  // the trap has to wait until the potion has made the hero big
  potionTrap: (c, h, f) => c.kind === 'trap' && c.o && (f & F_OPOT) === 0,
};

// Is there a win that meets every goal in o? Returns the winning order (tower indexes) or null.
//   o.princess  rescue the princess (step into her floor) before beating the boss
//   o.noPotion  never drink a potion
//   o.maxMoves  win in at most this many moves (the boss move included)
//   o.minPower  end with at least this power
//   o.veto      an order rule the win must keep (see ORDER)
//   o.breaks    an order rule the win must break at least once (to prove an order trap is one)
//   o.budget    give up (return null) after looking at this many positions (for the phone)
//   o.fair      the fairness rule for fog. The player is shown WHAT is in the fog but not WHERE.
//               A fogged floor shows itself once it is the lowest floor of its tower (or when a
//               spyglass is taken). With fair set, the search is a game against an opponent who
//               may shuffle the fogged contents among the fogged floors in any way, deciding each
//               one only when it shows: the level is fair when the player has ONE plan that wins
//               (and meets the goals) whatever the shuffle. The real level is one of the shuffles,
//               so a fair level is always solvable, and no guess is ever needed.
export function plan(level, o = {}) {
  const T = level.towers;
  const moves0 = level.moves || 0;
  const fuses = hasFuse(T);
  const boss = hasBossIn(T);
  const fogAt = T.map((tw) => tw.map(() => -1));
  const pool = [];
  if (o.fair) T.forEach((tw, t) => tw.forEach((c, j) => { if (c.fog) { fogAt[t][j] = pool.length; pool.push({ ...c, fog: false }); } }));
  const poolKey = pool.map((c) => encodeCell(c));
  const memo = new Map();
  const place = placeValues(T);
  let budget = o.budget || Infinity;
  const ok = (p, m, f) => (!o.princess || (f & F_PRINCESS)) && (!o.maxMoves || m <= o.maxMoves) && (!o.minPower || p >= o.minPower) && (!o.breaks || (f & F_BROKE));
  function go(h, p, k, a, f, asg, m) {
    if (pool.length) {
      // a fogged floor that shows now is decided by the opponent
      for (let t = 0; t < T.length; t++) {
        const i = h[t] < T[t].length ? fogAt[t][h[t]] : -1;
        if (i >= 0 && asg[i] < 0) return nature(i, h, p, k, a, f, asg, m);
      }
      if (f & F_SPY) { const i = asg.indexOf(-1); if (i >= 0) return nature(i, h, p, k, a, f, asg, m); }
    }
    const mk = (((hcode(h, place) * 8 + Math.min(7, k)) * 8 + Math.min(7, a)) * 128 + f) + (pool.length ? '|' + asg.join(',') : '');
    let byP = memo.get(mk);
    if (!byP) memo.set(mk, (byP = new Map()));
    if (byP.has(p)) return byP.get(p);
    if (--budget < 0) throw OUT_OF_TIME;
    byP.set(p, null);
    let res = null;
    for (let t = 0; t < T.length && !res; t++) {
      if (h[t] >= T[t].length) continue;
      const i = fogAt[t][h[t]];
      const cell = i >= 0 ? pool[asg[i]] : T[t][h[t]];
      const ns = step(p, k, cell, moves0 + m, a);
      if (!ns || ns.p < 0) continue;
      if (o.noPotion && cell.kind === 'potion') continue;
      if (o.veto && o.veto(cell, h, f, T)) continue;
      const nf = f | flagOf(cell) | (o.breaks && o.breaks(cell, h, f, T) ? F_BROKE : 0);
      if (cell.kind === 'boss') { if (ok(ns.p, m + 1, nf)) res = [t]; continue; }
      if (o.maxMoves && boss && m + 1 >= o.maxMoves) continue; // no move left for the boss
      h[t]++;
      if (!(fuses && fuseOut(T, h, moves0 + m + 1))) {
        if (!boss && h.every((x, q) => x >= T[q].length)) { if (ok(ns.p, m + 1, nf)) res = [t]; }
        else { const r = go(h, ns.p, ns.k, ns.a, nf, asg, m + 1); if (r) res = [t, ...r]; }
      }
      h[t]--;
    }
    byP.set(p, res);
    return res;
  }
  // the opponent picks what fogged floor i turns out to be; the player must win against every pick
  function nature(i, h, p, k, a, f, asg, m) {
    const tried = new Set();
    let any = null;
    for (let q = 0; q < pool.length; q++) {
      if (asg.includes(q) || tried.has(poolKey[q])) continue;
      tried.add(poolKey[q]);
      const next = asg.slice();
      next[i] = q;
      const r = go(h, p, k, a, f, next, m);
      if (!r) return null;
      any = any || r;
    }
    return any;
  }
  try {
    return go(T.map(() => 0), level.start, level.keys || 0, level.allies || 0, 0, pool.map(() => -1), 0);
  } catch (e) {
    if (e === OUT_OF_TIME) return null;
    throw e;
  }
}
const OUT_OF_TIME = new Error('plan: out of time');

// plan without the weekly event (the builder's fog check)
export function planPlain(level, o) {
  const e = EVENT;
  EVENT = null;
  try { return plan(level, o); } finally { EVENT = e; }
}

// Best value over all wins that keep o's rules (designer's view, no fog): mode 'moves' gives the
// fewest moves, 'power' the highest final power. Returns Infinity / -1 when there is no such win.
export function best(level, o, mode) {
  const T = level.towers;
  const moves0 = level.moves || 0;
  const fuses = hasFuse(T);
  const boss = hasBossIn(T);
  const memo = new Map();
  const worst = mode === 'moves' ? Infinity : -1;
  const place = placeValues(T);
  const better = (x, y) => (mode === 'moves' ? Math.min(x, y) : Math.max(x, y));
  const value = (p, m, f) => (o.princess && !(f & F_PRINCESS)) || (o.maxMoves && m > o.maxMoves) ? worst : mode === 'moves' ? m : p;
  function go(h, p, k, a, f, m) {
    const mk = ((hcode(h, place) * 8 + Math.min(7, k)) * 8 + Math.min(7, a)) * 128 + f;
    let byP = memo.get(mk);
    if (!byP) memo.set(mk, (byP = new Map()));
    if (byP.has(p)) return byP.get(p);
    let res = worst;
    for (let t = 0; t < T.length; t++) {
      if (h[t] >= T[t].length) continue;
      const cell = T[t][h[t]];
      const ns = step(p, k, cell, moves0 + m, a);
      if (!ns || ns.p < 0) continue;
      if (o.noPotion && cell.kind === 'potion') continue;
      if (o.veto && o.veto(cell, h, f, T)) continue;
      const nf = f | flagOf(cell);
      if (cell.kind === 'boss') { res = better(res, value(ns.p, m + 1, nf)); continue; }
      if (o.maxMoves && boss && m + 1 >= o.maxMoves) continue;
      h[t]++;
      if (!(fuses && fuseOut(T, h, moves0 + m + 1))) {
        if (!boss && h.every((x, q) => x >= T[q].length)) res = better(res, value(ns.p, m + 1, nf));
        else res = better(res, go(h, ns.p, ns.k, ns.a, nf, m + 1));
      }
      h[t]--;
    }
    byP.set(p, res);
    return res;
  }
  return go(T.map(() => 0), level.start, level.keys || 0, level.allies || 0, 0, 0);
}

// The goals of a level as the searches above read them (noaid is not about the order).
export function goalRules(goals) {
  const o = {};
  for (const g of goals || []) {
    if (g.k === 'moves') o.maxMoves = g.n;
    if (g.k === 'power') o.minPower = g.n;
    if (g.k === 'princess') o.princess = true;
    if (g.k === 'nopotion') o.noPotion = true;
  }
  return o;
}

// What a careless player does: always take the weakest-looking floor they can survive.
export function greedy(level) {
  const towers = level.towers;
  const h = towers.map(() => 0);
  let p = level.start;
  let k = 0;
  let a = 0;
  for (;;) {
    const m = h.reduce((x, y) => x + y, 0);
    const options = [];
    for (let t = 0; t < towers.length; t++) if (h[t] < towers[t].length && step(p, k, towers[t][h[t]], m, a)) options.push(t);
    if (h.every((v, t) => v >= towers[t].length)) return true;
    if (!options.length) return false;
    const score = (c) => (c.kind === 'enemy' || c.kind === 'boss' || c.kind === 'grow' ? fightValue(c, m) : c.kind === 'shield' ? c.v * 2 : c.kind === 'trap' || c.kind === 'curse' ? 1e9 : -1);
    options.sort((x, y) => score(towers[x][h[x]]) - score(towers[y][h[y]]));
    const ns = step(p, k, towers[options[0]][h[options[0]]], m, a);
    if (ns.p < 0) return false;
    if (towers[options[0]][h[options[0]]].kind === 'boss') return true;
    p = ns.p;
    k = ns.k;
    a = ns.a;
    h[options[0]]++;
    if (fuseOut(towers, h, h.reduce((x, y) => x + y, 0))) return false;
  }
}

// The greedy bot of the depth test: take any helpful floor it sees (sword, potion, key, door it can
// open, gate that opens, ally, spyglass, bomb, princess), otherwise attack the weakest enemy it can
// beat, and only step on a trap or curse when nothing else is left. It only looks at the floors it
// can step into, so fog makes no difference to it. Returns what happened, for the goals.
const NAIVE_GOOD = new Set(['sword', 'potion', 'key', 'lock', 'gate', 'ally', 'spy', 'fuse', 'princess']);
export function naiveBot(level) {
  const T = level.towers;
  const h = T.map(() => 0);
  let p = level.start;
  let k = 0;
  let a = 0;
  let f = 0;
  const path = [];
  const end = (won) => ({ won, moves: h.reduce((x, y) => x + y, 0), power: p, princess: !!(f & F_PRINCESS), potion: !!(f & F_POTION), path });
  for (let guard = 0; guard < 200; guard++) {
    const m = h.reduce((x, y) => x + y, 0);
    const opts = [];
    for (let t = 0; t < T.length; t++) if (h[t] < T[t].length && step(p, k, T[t][h[t]], m, a)) opts.push(t);
    if (!opts.length) return end(!hasBossIn(T) && h.every((v, t) => v >= T[t].length));
    const need = (c) => (c.kind === 'shield' ? 2 * c.v : fightValue(c, m));
    const fight = (c) => FIGHTS.has(c.kind) || c.kind === 'boss';
    let pick = opts.find((t) => NAIVE_GOOD.has(T[t][h[t]].kind));
    if (pick === undefined) pick = opts.filter((t) => fight(T[t][h[t]]) && (p > need(T[t][h[t]]) || (a > 0 && T[t][h[t]].kind !== 'boss'))).sort((x, y) => need(T[x][h[x]]) - need(T[y][h[y]]))[0];
    if (pick === undefined) pick = opts.find((t) => !fight(T[t][h[t]]) && step(p, k, T[t][h[t]], m, a).p > 0);
    if (pick === undefined) return end(false);
    const c = T[pick][h[pick]];
    const ns = step(p, k, c, m, a);
    if (ns.p < 0) return end(false);
    p = ns.p;
    k = ns.k;
    a = ns.a;
    f |= flagOf(c);
    h[pick]++;
    path.push(pick);
    if (c.kind === 'boss') return end(true);
    if (fuseOut(T, h, m + 1)) return end(false);
  }
  return end(false);
}
// Which goals a finished run met: { won, moves, power, princess, potion, aids }.
export function goalsMet(goals, run) {
  return (goals || []).map((g) => run.won && (g.k === 'moves' ? run.moves <= g.n : g.k === 'power' ? run.power >= g.n : g.k === 'princess' ? run.princess
    : g.k === 'nopotion' ? !run.potion : g.k === 'noaid' ? !run.aids : true));
}

// ---------------------------------------------------------------- levels
// Size and features grow with the level number.
// Levels past 100: every world of 25 has its own flavour.
function lateSpec(n) {
  const w = Math.floor((n - 101) / 25) % 4;
  const base = { towers: 4, floors: 5, boss: true, princess: n % 5 === 0, ratio: [0.001, 0.08], mustFoolGreedy: n % 3 !== 1 };
  const flavour = [
    { potions: 2, traps: 3, swords: 1, curses: 0, shields: 1, keys: 1 }, // jungle: traps everywhere
    { potions: 1, traps: 1, swords: 1, curses: 0, shields: 1, keys: 2 }, // pirate cove: keys and doors
    { potions: 2, traps: 1, swords: 1, curses: 2, shields: 2, keys: 0 }, // haunted castle: curses
    { potions: 2, traps: 2, swords: 1, curses: 1, shields: 2, keys: 1 }, // space: a bit of everything
  ][w];
  return { ...base, ...flavour };
}

// Bomb levels: from level 42, every 6th level has a lit bomb (two from level 120) that must be
// defused in time. They replace the plain levels that were there before.
export const fuseLevel = (n) => n >= 42 && (n - 42) % 6 === 0;
const fuseCount = (n) => (fuseLevel(n) ? (n >= 120 ? 2 : 1) : 0);

// The level mix before the puzzle update (still used for the daily towers already played).
export function legacySpec(n) {
  if (n > 100) return { ...lateSpec(n), fuses: fuseCount(n) };
  const towers = n <= 1 ? 1 : n <= 3 ? 2 : n <= 12 ? 3 : 4;
  const floors = n <= 1 ? 3 : n <= 3 ? 2 + (n - 1) : n <= 6 ? 3 : n <= 15 ? 4 : 5;
  return {
    towers,
    floors,
    potions: n >= 6 ? (n >= 20 ? 2 : 1) : 0,
    traps: n >= 4 ? Math.min(3, 1 + Math.floor((n - 4) / 8)) : 0,
    swords: n >= 2 ? 1 + (n >= 10 ? 1 : 0) : 0,
    curses: n >= 14 && n % 2 === 0 ? (n >= 40 && n % 4 === 0 ? 2 : 1) : 0,
    shields: n >= 32 ? (n >= 60 ? 2 : 1) : 0,
    keys: n >= 22 && n % 3 !== 0 ? (n >= 50 && n % 3 === 1 ? 2 : 1) : 0,
    boss: n >= 3,
    princess: n % 5 === 0,
    // share of random orders that may win: lower is harder
    ratio: n <= 2 ? [0.3, 1] : n <= 5 ? [0.12, 0.6] : n <= 12 ? [0.04, 0.3] : n <= 25 ? [0.01, 0.15] : [0.002, 0.08],
    mustFoolGreedy: n >= 8 && n % 3 !== 1,
    fuses: fuseCount(n),
  };
}

// The puzzle pieces added in the update, in the order they are taught. Each one gets an easy
// teaching level of its own, then joins the mix three levels later.
export const MECHANICS = [
  { id: 'grow', at: 16 },
  { id: 'order', at: 26 },
  { id: 'gate', at: 36 },
  { id: 'ally', at: 46 },
  { id: 'fog', at: 56 },
];
export const teachOf = (n) => (MECHANICS.find((m) => m.at === n) || {}).id || null;
const ORDER_MODES = ['swordPotion', 'cursePotion', 'potionTrap'];
// Which new pieces a level uses: its teaching piece, or up to two from the ones already taught
// (one on bomb levels), picked by a fixed pattern so neighbouring levels feel different.
export function mechanicsOf(n) {
  const teach = teachOf(n);
  if (teach) return [teach];
  const open = MECHANICS.filter((m) => n >= m.at + 3);
  const cap = fuseLevel(n) ? 1 : 2;
  const out = [];
  for (let i = 0; i < open.length && out.length < cap; i++) {
    const m = open[(n * 3 + i) % open.length];
    if ((n * 7 + MECHANICS.indexOf(m) * 3) % 5 < 2 || (i === 0 && n % 4 === 0)) out.push(m.id);
  }
  return out;
}

export function levelSpec(n) {
  const spec = { ...legacySpec(n), grows: 0, gates: 0, allies: 0, fog: 0, spy: 0, order: null, teach: teachOf(n) };
  const mech = mechanicsOf(n);
  if (spec.teach) {
    // a small, friendly tower so the new piece is the whole story
    Object.assign(spec, { towers: 3, floors: 4, curses: 0, shields: 0, keys: 0, fuses: 0, princess: false, traps: 1, swords: 1, potions: 1, ratio: [0.01, 0.6], mustFoolGreedy: false });
  }
  for (const id of mech) {
    if (id === 'grow') spec.grows = spec.teach ? 1 : n > 80 ? 2 : 1;
    if (id === 'gate') spec.gates = 1;
    if (id === 'ally') spec.allies = 1;
    if (id === 'fog') { spec.fog = spec.teach ? 2 : n > 100 ? 3 : 2; spec.spy = spec.teach || n % 3 !== 0 ? 1 : 0; }
    if (id === 'order') {
      spec.order = spec.teach ? 'swordPotion' : ORDER_MODES[n % 3];
      spec.potions = 1;
      if (spec.order === 'swordPotion') spec.swords = Math.max(1, spec.swords);
      if (spec.order === 'cursePotion') spec.curses = Math.max(1, spec.curses);
      if (spec.order === 'potionTrap') spec.traps = Math.max(1, spec.traps);
      spec.mustFoolGreedy = false;
    }
  }
  // the princess waits on top of a side tower: rescuing her is an optional goal
  spec.sidePrincess = true;
  // "no potion" levels: one more potion sits on top of a side tower, outside the winning order, so the
  // level can be won without it, but it is right there and it helps
  spec.sparePotion = n >= 20 && n % 4 === 1 && !spec.order && !spec.princess && !spec.teach && spec.towers > 1;
  if (spec.sparePotion) spec.potions = 0;
  return spec;
}
// The daily tower: the old mix plus, on some days, a growing enemy or an exact-power gate.
export function dailySpec(n, seed) {
  const d = Math.floor(seed / 7) % 4;
  return { ...legacySpec(n), fuses: 0, grows: d === 1 || d === 3 ? 1 : 0, gates: d >= 2 ? 1 : 0, allies: 0, fog: 0, spy: 0, order: null, teach: null, sidePrincess: false };
}

const round = (x) => Math.max(1, Math.round(x));

// Builds a hidden winning order first, then spreads it over the towers (each tower keeps the
// order of its floors), then checks with the solver that the level is as hard as it should be.
// How often a careful player (one who never taps a move that kills on the spot, but otherwise
// guesses) should win, by level. Each world starts easier than the last one ended, and every
// 5th level (the princess levels) is a breather.
export function carefulTarget(n) {
  if (n <= 3) return null;
  const w = Math.min(7, Math.floor((n - 1) / 25));
  const i = (n - 1) % 25;
  const start = [0.92, 0.7, 0.58, 0.48, 0.6, 0.52, 0.45, 0.4][w];
  const end = [0.4, 0.3, 0.2, 0.12, 0.25, 0.2, 0.15, 0.1][w];
  let tgt = start + (end - start) * (i / 24);
  if (n % 5 === 0) tgt = Math.min(0.92, tgt + 0.18);
  return tgt;
}

// Plays a level many times with random choices; careful players skip moves that kill at once.
export function simulate(level, careful, runs, rng) {
  let wins = 0;
  const fuses = hasFuse(level.towers);
  for (let r = 0; r < runs; r++) {
    const h = level.towers.map(() => 0);
    let p = level.start;
    let k = 0;
    let a = 0;
    let m = 0;
    for (;;) {
      const opts = [];
      for (let t = 0; t < h.length; t++) {
        if (h[t] >= level.towers[t].length) continue;
        const ns = step(p, k, level.towers[t][h[t]], m, a);
        if (!ns) continue;
        if (careful && ns.p < 0) continue;
        if (careful && fuses && level.towers[t][h[t]].kind !== 'boss') {
          h[t]++;
          const blown = fuseOut(level.towers, h, m + 1);
          h[t]--;
          if (blown) continue;
        }
        opts.push(t);
      }
      if (!opts.length) { if (h.every((v, t) => v >= level.towers[t].length)) wins++; break; }
      const t = opts[Math.floor(rng() * opts.length)];
      const cell = level.towers[t][h[t]];
      const ns = step(p, k, cell, m, a);
      if (ns.p < 0) break;
      h[t]++;
      m++;
      p = ns.p;
      k = ns.k;
      a = ns.a;
      if (cell.kind === 'boss') { wins++; break; }
      if (fuses && fuseOut(level.towers, h, m)) break;
    }
  }
  return wins / runs;
}

// The generator before the puzzle update, kept as it was so that the daily towers already
// played can be rebuilt exactly. seed: for levels that are not part of the numbered list.
export function buildLegacy(n, seed = null) {
  // the daily tower keeps its own mix (no bombs)
  const spec = seed === null ? legacySpec(n) : { ...legacySpec(n), fuses: 0 };
  const target = carefulTarget(n);
  for (let attempt = 0; attempt < 900; attempt++) {
    // relax step by step if a level is hard to hit
    const relax = attempt >= 600 ? 2 : attempt >= 300 ? 1 : 0;
    const rng = mulberry32((seed ?? n * 7919) + attempt * 104729 + 13);
    const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const total = spec.towers * spec.floors - (spec.princess ? 0 : 0);
    let p = ri(3, 8) + Math.floor(n / 4);
    const start = p;
    const steps = [];
    const extras = [
      ...Array(spec.potions).fill('potion'),
      ...Array(spec.traps).fill('trap'),
      ...Array(spec.swords).fill('sword'),
      ...Array(spec.curses).fill('curse'),
      ...Array(spec.shields).fill('shield'),
    ];
    const slots = total - (spec.boss ? 1 : 0) - (spec.princess ? 1 : 0);
    // positions for the extras inside the hidden order (never the very first step)
    const where = new Map();
    const free = () => { let i; do { i = ri(1, slots - 1); } while (where.has(i)); return i; };
    for (const e of extras) where.set(free(), e);
    // each key comes before its door in the hidden order
    for (let q = 0; q < spec.keys; q++) {
      const a = free();
      where.set(a, 'key');
      let b;
      let tries = 0;
      do { b = ri(a + 1, slots - 1); tries++; } while (where.has(b) && tries < 40);
      if (where.has(b) || b <= a) { where.delete(a); continue; }
      where.set(b, 'lock');
    }
    // bombs: somewhere in the first half of the hidden order; the deadline is set below
    for (let q = 0; q < spec.fuses; q++) {
      let a;
      let tries = 0;
      do { a = ri(2, Math.max(2, Math.floor(slots * 0.6))); tries++; } while (where.has(a) && tries < 40);
      if (!where.has(a)) where.set(a, 'fuse');
    }
    let ok = true;
    for (let i = 0; i < slots; i++) {
      const e = where.get(i);
      let cell;
      if (e === 'potion') cell = { kind: 'potion' };
      else if (e === 'sword') cell = { kind: 'sword', v: round(p * (0.2 + rng() * 0.4)) };
      else if (e === 'trap') cell = { kind: 'trap', v: round(p * (0.25 + rng() * 0.35)) };
      else if (e === 'curse') cell = { kind: 'curse' };
      else if (e === 'shield') cell = { kind: 'shield', v: Math.max(1, ri(Math.floor(p * 0.22), Math.max(1, Math.floor((p - 1) / 2)))) };
      else if (e === 'key') cell = { kind: 'key' };
      else if (e === 'lock') cell = { kind: 'lock' };
      else if (e === 'fuse') cell = { kind: 'fuse', v: i + 1 + ri(0, 2) };
      else {
        // enemies: mostly a good bite, sometimes just under the hero's power
        const lo = Math.max(1, Math.floor(p * 0.3));
        const v = rng() < 0.3 ? p - ri(1, Math.max(1, Math.floor(p * 0.08))) : ri(lo, Math.max(lo, p - 1));
        cell = { kind: 'enemy', v: Math.max(1, Math.min(p - 1, v)) };
      }
      const np = apply(p, cell);
      if (np < 0 || (cell.kind === 'curse' && p < 4)) { ok = false; break; }
      steps.push(cell);
      p = np;
    }
    if (!ok) continue;
    if (spec.boss) {
      const v = p - ri(1, Math.max(1, Math.floor(p * 0.06)));
      steps.push({ kind: 'boss', v });
    }
    // spread the hidden order over the towers
    const towers = Array.from({ length: spec.towers }, () => []);
    const quota = Array(spec.towers).fill(spec.floors);
    const bossTower = ri(0, spec.towers - 1);
    if (spec.princess) quota[bossTower] -= 1;
    let fits = true;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      let t;
      if (s.kind === 'boss') t = bossTower;
      else {
        const open = [];
        for (let k = 0; k < spec.towers; k++) {
          const room = quota[k] - towers[k].length - (k === bossTower && spec.boss ? 1 : 0);
          if (room > 0) open.push(k);
        }
        if (!open.length) { fits = false; break; }
        // a door in the same tower as its key would be no puzzle at all
        const keyTowers = s.kind === 'lock' ? towers.map((tw, k) => (tw.some((c) => c.kind === 'key') ? k : -1)).filter((k) => k >= 0) : [];
        const away = open.filter((k) => !keyTowers.includes(k));
        const pick = away.length ? away : open;
        t = pick[ri(0, pick.length - 1)];
      }
      towers[t].push(s);
    }
    if (!fits || towers.some((tw) => !tw.length)) continue;
    if (spec.princess) towers[bossTower].push({ kind: 'princess' });
    const level = { n, start, towers };
    const sol = solve(level);
    if (!sol.wins) continue;
    const lo = spec.ratio[0] / (relax ? 3 : 1);
    const hi = Math.min(1, spec.ratio[1] * (relax === 2 ? 2 : 1));
    if (sol.ratio > hi && !(lo > hi)) continue;
    if (spec.mustFoolGreedy && relax < 2 && greedy(level)) continue;
    if (target !== null) {
      const tol = [0.08, 0.13, 0.2][relax];
      const c = simulate(level, true, 400, mulberry32(attempt + 7));
      if (Math.abs(c - target) > tol) continue;
      level.careful = c;
    }
    level.ratio = sol.ratio;
    level.solution = sol.path;
    return level;
  }
  // Should not happen; fall back to an easy level so the game never blocks.
  return { n, start: 10, towers: [[{ kind: 'enemy', v: 3 }, { kind: 'enemy', v: 9 }]], solution: [0, 0], ratio: 1 };
}

// ---------------------------------------------------------------- the generator (puzzle update)
// Rounds a power goal down to a number that is easy to read.
export function niceFloor(x) {
  if (x < 50) return x;
  const step = x < 200 ? 5 : x < 1000 ? 10 : x < 5000 ? 50 : 100;
  return Math.floor(x / step) * step;
}

// The two goals next to "beat the level" (levels 4 and up), by level number and what is on the board.
function goalKinds(level, spec, n) {
  const potion = level.towers.some((tw) => tw.some((c) => c.kind === 'potion'));
  const princess = level.towers.some((tw, t) => tw.some((c) => c.kind === 'princess') && !tw.some((c) => c.kind === 'boss'));
  if (n <= 12) return princess ? ['princess', 'noaid'] : ['noaid', n % 2 ? 'moves' : 'power'];
  if (princess) return ['princess', n % 10 === 0 ? 'power' : 'moves'];
  // an order trap is about the potion: "no potion" would only dodge it
  if (spec.order) return ['moves', 'power'];
  if (spec.sparePotion) return [n % 8 === 1 ? 'nopotion' : 'moves', n % 8 === 1 ? 'power' : 'nopotion'];
  return ['moves', 'power'];
}

// Sets the numbers of the goals so that all of them can be met in ONE run (and, with fog, by the
// fair plan). Returns the goals, or null when this board cannot carry them.
function makeGoals(level, spec, n) {
  if (n <= 3) return [];
  let kinds = goalKinds(level, spec, n);
  const fogged = level.towers.some((tw) => tw.some((c) => c.fog));
  const full = level.towers.flat().filter((c) => c.kind !== 'princess').length;
  const rules = {};
  // "no potion" only where the level can be won without one
  if (kinds.includes('nopotion') && !Number.isFinite(best(level, { noPotion: true }, 'moves'))) {
    kinds = kinds.map((k) => (k !== 'nopotion' ? k : kinds.includes('moves') ? 'power' : 'moves'));
  }
  if (kinds.includes('princess')) rules.princess = true;
  if (kinds.includes('nopotion')) rules.noPotion = true;
  if (kinds.includes('moves')) {
    const mm = best(level, rules, 'moves');
    if (!Number.isFinite(mm)) return null;
    // "clear everything" is no goal: ask for the most power instead
    if (mm >= full && !kinds.includes('power')) kinds = kinds.map((k) => (k === 'moves' ? 'power' : k));
    else rules.maxMoves = Math.min(Math.max(mm, full - 1), mm + (n < 12 ? 2 : n < 30 ? 1 : 0));
  }
  let top = 0;
  if (kinds.includes('power')) {
    top = best(level, rules, 'power');
    if (top < 0) return null;
    rules.minPower = niceFloor(Math.floor(top * (n < 15 ? 0.85 : n < 40 ? 0.92 : 0.97)));
  }
  if (!plan(level, rules)) return null;
  // with fog the goals must be reachable without peeking too: loosen them a little if needed
  for (let tries = 0; fogged && !plan(level, { ...rules, fair: true }); tries++) {
    if (tries >= 4) return null;
    if (rules.maxMoves) rules.maxMoves++;
    if (rules.minPower) rules.minPower = niceFloor(Math.floor(rules.minPower * 0.92));
  }
  return kinds.map((k) => (k === 'moves' ? { k, n: rules.maxMoves } : k === 'power' ? { k, n: rules.minPower } : { k }));
}

// Why attempts were thrown away (for scripts/levels.mjs to report).
export const REJECTS = {};
const reject = (why) => { REJECTS[why] = (REJECTS[why] || 0) + 1; };
// seed: optional, for levels that are not part of the numbered list (the daily tower).
export function buildLevel(n, seed = null, specIn = null) {
  const spec = specIn || (seed === null ? levelSpec(n) : dailySpec(n, seed));
  const base = carefulTarget(n);
  // teaching levels are friendlier than their neighbours
  const target = spec.teach && base !== null ? Math.max(base, 0.5) : base;
  for (let attempt = 0; attempt < 1200; attempt++) {
    // relax step by step if a level is hard to hit
    const relax = attempt >= 800 ? 2 : attempt >= 400 ? 1 : 0;
    const rng = mulberry32((seed ?? n * 7919) + attempt * 104729 + 17);
    const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const side = spec.sidePrincess && spec.princess && spec.towers > 1;
    const total = spec.towers * spec.floors;
    let p = ri(3, 8) + Math.floor(n / 4);
    const start = p;
    const steps = [];
    const slots = total - (spec.boss ? 1 : 0) - (spec.princess ? 1 : 0) - (spec.sparePotion ? 1 : 0);
    const extras = [
      ...Array(spec.potions).fill('potion'),
      ...Array(spec.traps).fill('trap'),
      ...Array(spec.swords).fill('sword'),
      ...Array(spec.curses).fill('curse'),
      ...Array(spec.shields).fill('shield'),
      ...Array(spec.grows).fill('grow'),
      ...Array(spec.gates).fill('gate'),
    ];
    // positions for the extras inside the hidden order (never the very first step)
    const where = new Map();
    const marked = new Set(); // the floors of an order trap
    const free = (lo = 1, hi = slots - 1) => { let i; let tries = 0; do { i = ri(lo, hi); tries++; } while (where.has(i) && tries < 60); return where.has(i) ? -1 : i; };
    // an order trap: the two pieces it is about, in the order that works
    // (late in the order, so that the wrong order costs more than the boss leaves to spare)
    if (spec.order) {
      const [first, second] = { swordPotion: ['sword', 'potion'], cursePotion: ['curse', 'potion'], potionTrap: ['potion', 'trap'] }[spec.order];
      const a = spec.order === 'cursePotion' ? free(1, Math.max(1, Math.floor(slots / 2))) : free(Math.floor(slots * 0.4), slots - 2);
      const b = a < 0 ? -1 : free(Math.max(a + 1, slots - 2), slots - 1);
      if (a < 0 || b < 0) { reject('order slots'); continue; }
      where.set(a, first);
      where.set(b, second);
      marked.add(a).add(b);
      extras.splice(extras.indexOf(first), 1);
      extras.splice(extras.indexOf(second), 1);
    }
    if (spec.spy) { const a = free(1, Math.min(3, slots - 1)); if (a >= 0) where.set(a, 'spy'); }
    // an ally needs fights after it, and the boss is not one
    for (let q = 0; q < spec.allies; q++) { const a = free(1, Math.max(1, slots - 3)); if (a >= 0) where.set(a, 'ally'); }
    for (const e of extras) { const i = free(); if (i >= 0) where.set(i, e); }
    // each key comes before its door in the hidden order
    for (let q = 0; q < spec.keys; q++) {
      const a = free();
      if (a < 0) continue;
      where.set(a, 'key');
      let b;
      let tries = 0;
      do { b = ri(a + 1, slots - 1); tries++; } while (where.has(b) && tries < 40);
      if (where.has(b) || b <= a) { where.delete(a); continue; }
      where.set(b, 'lock');
    }
    // bombs: somewhere in the first half of the hidden order; the deadline is set below
    for (let q = 0; q < spec.fuses; q++) {
      let a;
      let tries = 0;
      do { a = ri(2, Math.max(2, Math.floor(slots * 0.6))); tries++; } while (where.has(a) && tries < 40);
      if (!where.has(a)) where.set(a, 'fuse');
    }
    let ok = true;
    let keys = 0;
    let allies = 0;
    // an enemy the hero could take on his own: mostly a good bite, sometimes just under his power
    const bite = () => {
      const lo = Math.max(1, Math.floor(p * 0.3));
      const v = rng() < 0.3 ? p - ri(1, Math.max(1, Math.floor(p * 0.08))) : ri(lo, Math.max(lo, p - 1));
      return Math.max(1, Math.min(p - 1, v));
    };
    // what the ally takes on: clearly too strong for the hero right now
    const brute = () => p + ri(1, Math.max(2, Math.floor(p * 0.7)));
    for (let i = 0; i < slots; i++) {
      const e = where.get(i);
      let cell;
      if (e === 'potion') cell = { kind: 'potion' };
      else if (e === 'sword') cell = { kind: 'sword', v: round(p * (0.2 + rng() * 0.4)) };
      else if (e === 'trap') cell = { kind: 'trap', v: round(p * (0.25 + rng() * 0.35)) };
      else if (e === 'curse') cell = { kind: 'curse' };
      else if (e === 'shield') cell = allies ? { kind: 'shield', v: ri(Math.ceil(p / 2), p) } : { kind: 'shield', v: Math.max(1, ri(Math.floor(p * 0.22), Math.max(1, Math.floor((p - 1) / 2)))) };
      else if (e === 'key') cell = { kind: 'key' };
      else if (e === 'lock') cell = { kind: 'lock' };
      else if (e === 'fuse') cell = { kind: 'fuse', v: i + 1 + ri(0, 2) };
      else if (e === 'ally') cell = { kind: 'ally' };
      else if (e === 'spy') cell = { kind: 'spy' };
      else if (e === 'gate') {
        // exactly the power the hidden order has here, or a narrow band around it
        const exact = spec.teach || rng() < 0.5;
        const lo = exact ? p : Math.max(1, p - ri(0, Math.max(1, Math.floor(p * 0.08))));
        cell = { kind: 'gate', v: lo, w: exact ? p : p + ri(1, Math.max(1, Math.floor(p * 0.12))) };
      } else if (e === 'grow') {
        // its power at this point of the hidden order, minus what it gains on the way here
        const now = allies ? brute() : bite();
        let w = ri(1, Math.max(1, Math.round(p * 0.07)));
        w = Math.max(1, Math.min(w, Math.floor((now - 1) / i)));
        const v = now - w * i;
        cell = v >= 1 ? { kind: 'grow', v, w } : { kind: 'enemy', v: now };
      } else cell = { kind: 'enemy', v: allies ? brute() : bite() };
      if (marked.has(i)) cell.o = true;
      const ns = step(p, keys, cell, i, allies);
      if (!ns || ns.p < 0 || (cell.kind === 'curse' && p < 4)) { ok = false; break; }
      steps.push(cell);
      p = ns.p;
      keys = ns.k;
      allies = ns.a;
    }
    if (!ok || allies) { reject('hidden order'); continue; }
    if (spec.boss) {
      // order traps leave the boss a thinner margin
      const v = p - ri(1, Math.max(1, Math.floor(p * (spec.order ? 0.02 : 0.06))));
      steps.push({ kind: 'boss', v });
    }
    // spread the hidden order over the towers
    const towers = Array.from({ length: spec.towers }, () => []);
    const quota = Array(spec.towers).fill(spec.floors);
    const bossTower = ri(0, spec.towers - 1);
    let princessTower = bossTower;
    if (side) { princessTower = ri(0, spec.towers - 2); if (princessTower >= bossTower) princessTower++; }
    if (spec.princess) quota[princessTower] -= 1;
    let spareTower = -1;
    if (spec.sparePotion) { spareTower = ri(0, spec.towers - 2); if (spareTower >= bossTower) spareTower++; quota[spareTower] -= 1; }
    let fits = true;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      let t;
      if (s.kind === 'boss') t = bossTower;
      else {
        const open = [];
        for (let k = 0; k < spec.towers; k++) {
          const room = quota[k] - towers[k].length - (k === bossTower && spec.boss ? 1 : 0);
          if (room > 0) open.push(k);
        }
        if (!open.length) { fits = false; break; }
        // a door in the same tower as its key would be no puzzle at all
        const keyTowers = s.kind === 'lock' ? towers.map((tw, k) => (tw.some((c) => c.kind === 'key') ? k : -1)).filter((k) => k >= 0) : [];
        const away = open.filter((k) => !keyTowers.includes(k));
        const pick = away.length ? away : open;
        t = pick[ri(0, pick.length - 1)];
      }
      towers[t].push(s);
    }
    if (!fits || towers.some((tw) => !tw.length)) { reject('spread'); continue; }
    if (spec.princess) towers[princessTower].push({ kind: 'princess' });
    if (spec.sparePotion) towers[spareTower].push({ kind: 'potion' });
    // fog over a few floors that are not at the bottom
    if (spec.fog) {
      const spots = [];
      towers.forEach((tw, t) => tw.forEach((c, k) => { if (k > 0 && FOGGABLE.has(c.kind)) spots.push(c); }));
      if (spots.length < spec.fog) { reject('fog spots'); continue; }
      for (let q = 0; q < spec.fog; q++) spots.splice(ri(0, spots.length - 1), 1)[0].fog = true;
    }
    const level = { n, start, towers };
    // cheap checks first, the solvers last
    if (spec.mustFoolGreedy && relax < 2 && greedy(level)) { reject('greedy wins'); continue; }
    if (spec.order && relax < 2 && naiveBot(level).won) { reject('order: bot wins'); continue; }
    // the new piece has to matter on its teaching level
    if (spec.teach === 'gate' || spec.teach === 'grow' || spec.teach === 'ally') { if (relax < 2 && naiveBot(level).won) { reject('teach: bot wins'); continue; } }
    if (target !== null) {
      const tol = [0.08, 0.13, 0.2][relax];
      const c = simulate(level, true, 400, mulberry32(attempt + 7));
      if (Math.abs(c - target) > tol) { reject('careful target'); continue; }
      level.careful = c;
    }
    const sol = solve(level);
    if (!sol.wins) { reject('unsolvable'); continue; }
    const lo = spec.ratio[0] / (relax ? 3 : 1);
    const hi = Math.min(1, spec.ratio[1] * (relax === 2 ? 2 : 1));
    if (sol.ratio > hi && !(lo > hi)) { reject('too easy'); continue; }
    // an order trap must really be one: no win may break its rule, and the bot that grabs
    // everything it sees falls for it
    if (spec.order && plan(level, { breaks: ORDER[spec.order] })) { reject('order not forced'); continue; }
    // fog must be fair (see plan)
    if (spec.fog && !plan(level, { fair: true })) { reject('fog unfair'); continue; }
    const goals = seed === null ? makeGoals(level, spec, n) : [];
    if (!goals) { reject('goals'); continue; }
    level.goals = goals;
    level.order = spec.order;
    level.teach = spec.teach;
    level.ratio = sol.ratio;
    level.solution = sol.path;
    return level;
  }
  // Should not happen; fall back to an easy level so the game never blocks.
  return { n, start: 10, towers: [[{ kind: 'enemy', v: 3 }, { kind: 'enemy', v: 9 }]], solution: [0, 0], ratio: 1, goals: [] };
}
