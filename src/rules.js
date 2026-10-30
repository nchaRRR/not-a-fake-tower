// Not a Fake Ad: Tower — the rules and the level generator. Pure logic, no DOM, runs in Node.
//
// The board is a row of towers. Each tower is a stack of floors, bottom first. The hero may
// only step into the LOWEST floor still occupied in any tower, so a strong enemy at the bottom
// shuts the floors above it until the hero has grown enough. What each floor does:
//   enemy v   hero power must be GREATER than v, then the hero absorbs it: power += v
//   boss v    same as an enemy (drawn big, always the last floor of its tower)
//   sword v   power += v
//   potion    power *= 2   (timing matters: drink it when you are big)
//   trap v    power -= v   (the hero dies if power drops to 0 or below)
//   princess  nothing; she waits on top of a tower and is rescued when the tower is cleared
//   shield v  a shield bearer: hero power must be MORE THAN TWICE v, then power += v
//   curse     power = floor(power / 2)   (the hero dies if that leaves 0)
//   key       the hero picks up a key
//   lock      a locked door: it can only be entered while carrying a key, which it uses up
//   fuse v    a lit bomb: it must be entered (defused) by move v at the latest. If v floors have been
//             cleared and it is still standing, it goes off and the hero is lost. Power is unchanged.
// The level is won the moment the boss is beaten (levels without a boss: when every floor is cleared).

export const KINDS = ['enemy', 'shield', 'boss', 'sword', 'potion', 'trap', 'princess', 'curse', 'key', 'lock', 'fuse'];
// One letter per kind in levels.json: e12 enemy, b80 boss, s5 sword, x potion (x2), t9 trap, q princess,
// h curse (half), k key, l lock, d12 shield bearer, f6 bomb (defuse by move 6)
export const CODE = { shield: 'd', enemy: 'e', boss: 'b', sword: 's', potion: 'x', trap: 't', princess: 'q', curse: 'h', key: 'k', lock: 'l', fuse: 'f' };
const DECODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
export function decodeLevel(raw, n) {
  return {
    n,
    start: raw.s,
    towers: raw.t.map((tw) => tw.map((c) => (c.length > 1 ? { kind: DECODE[c[0]], v: Number(c.slice(1)) } : { kind: DECODE[c] }))),
    solution: raw.sol,
    ratio: raw.r,
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

// Applies one floor to a power. Returns the new power, or -1 when the hero dies.
export function apply(power, cell) {
  switch (cell.kind) {
    case 'enemy':
    case 'boss':
      return power > cell.v ? power + cell.v : -1;
    case 'sword': return power + swordValue(cell);
    case 'potion': return power * potionMult();
    case 'trap': return power - trapValue(cell) > 0 ? power - trapValue(cell) : -1;
    case 'shield': return power > 2 * cell.v ? power + cell.v : -1;
    case 'curse': return Math.floor(power / 2) > 0 ? Math.floor(power / 2) : -1;
    default: return power;
  }
}

// Whole step with keys. Returns { p, k } after entering the floor, null when the door is locked
// and the hero has no key (the move is simply not allowed), or { p: -1 } when the hero dies.
export function step(p, k, cell) {
  if (cell.kind === 'lock') return k > 0 ? { p, k: k - 1 } : null;
  if (cell.kind === 'key') return { p, k: k + 1 };
  return { p: apply(p, cell), k };
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

// Exhaustive search over every order. Returns how many orders win, how many orders exist,
// and one winning order (tower indexes) if there is one.
export function solve(level) {
  const towers = level.towers;
  const memo = new Map();
  const fuses = hasFuse(towers);
  const moves0 = level.moves || 0; // floors already cleared before this position (hints mid-level)
  const mkey = (h, p, keys) => h.join(',') + '|' + p + '|' + keys;
  function count(h, p, keys, m) {
    const mk = mkey(h, p, keys);
    if (memo.has(mk)) return memo.get(mk);
    let wins = 0;
    let total = 0;
    let best = null;
    let done = true;
    let moved = false;
    for (let t = 0; t < towers.length; t++) {
      if (h[t] >= towers[t].length) continue;
      done = false;
      const ns = step(p, keys, towers[t][h[t]]);
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
      const r = count(h, ns.p, ns.k, m + 1);
      h[t]--;
      wins += r.wins;
      total += r.total;
      if (r.wins > 0 && !best) best = [t, ...r.path];
    }
    const res = done ? { wins: 1, total: 1, path: [] } : !moved ? { wins: 0, total: 1, path: [] } : { wins, total, path: best || [] };
    memo.set(mk, res);
    return res;
  }
  // number of complete orders that start by taking tower t from heights h
  function orders(h, t) {
    const left = towers.map((tw, i) => tw.length - h[i] - (i === t ? 1 : 0));
    return multinomial(left);
  }
  const r = count(towers.map(() => 0), level.start, level.keys || 0, 0);
  return { wins: r.wins, total: r.total, ratio: r.total ? r.wins / r.total : 0, path: r.path };
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

// What a careless player does: always take the weakest-looking floor they can survive.
export function greedy(level) {
  const towers = level.towers;
  const h = towers.map(() => 0);
  let p = level.start;
  let k = 0;
  for (;;) {
    const options = [];
    for (let t = 0; t < towers.length; t++) if (h[t] < towers[t].length && step(p, k, towers[t][h[t]])) options.push(t);
    if (h.every((v, t) => v >= towers[t].length)) return true;
    if (!options.length) return false;
    const score = (c) => (c.kind === 'enemy' || c.kind === 'boss' ? c.v : c.kind === 'shield' ? c.v * 2 : c.kind === 'trap' || c.kind === 'curse' ? 1e9 : -1);
    options.sort((a, b) => score(towers[a][h[a]]) - score(towers[b][h[b]]));
    const ns = step(p, k, towers[options[0]][h[options[0]]]);
    if (ns.p < 0) return false;
    if (towers[options[0]][h[options[0]]].kind === 'boss') return true;
    p = ns.p;
    k = ns.k;
    h[options[0]]++;
    if (fuseOut(towers, h, h.reduce((a, b) => a + b, 0))) return false;
  }
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

export function levelSpec(n) {
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
    let m = 0;
    for (;;) {
      const opts = [];
      for (let t = 0; t < h.length; t++) {
        if (h[t] >= level.towers[t].length) continue;
        const ns = step(p, k, level.towers[t][h[t]]);
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
      const ns = step(p, k, cell);
      if (ns.p < 0) break;
      h[t]++;
      m++;
      p = ns.p;
      k = ns.k;
      if (cell.kind === 'boss') { wins++; break; }
      if (fuses && fuseOut(level.towers, h, m)) break;
    }
  }
  return wins / runs;
}

// seed: optional, for levels that are not part of the numbered list (the daily tower).
export function buildLevel(n, seed = null) {
  // the daily tower keeps its own mix (no bombs)
  const spec = seed === null ? levelSpec(n) : { ...levelSpec(n), fuses: 0 };
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
