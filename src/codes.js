// Share codes for towers built in the editor. Pure logic, runs in Node too.
//
// A tower becomes a short bit string: version, world, start power, then each tower's floors
// (kind + value), and a 10-bit checksum at the end. It is written in Crockford base32
// (0-9 A-Z without I L O U): case doesn't matter, O/0 and I/L/1 are read the same, and dashes
// or spaces are ignored, so a code read out loud or typed by hand still works.
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;
// order is part of the format: never reorder, only append
const KINDS = ['enemy', 'shield', 'boss', 'sword', 'potion', 'trap', 'princess', 'curse', 'key', 'lock', 'fuse'];
export const VALUED = new Set(['enemy', 'shield', 'boss', 'sword', 'trap', 'fuse']);
export const LIMITS = { towers: 4, floors: 5, maxV: 99999, maxStart: 9999 };

function hash10(bits) {
  // FNV-1a over the bit string, folded to 10 bits
  let x = 0x811c9dc5;
  for (let i = 0; i < bits.length; i++) { x ^= bits.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return (x ^ (x >>> 10) ^ (x >>> 20)) & 1023;
}
const put = (n, w) => n.toString(2).padStart(w, '0');
// numbers: groups of 4 bits, each with a "more follows" bit in front
function putNum(v) {
  let s = '';
  const groups = [];
  do { groups.unshift(v & 15); v = Math.floor(v / 16); } while (v > 0);
  groups.forEach((g, i) => { s += (i < groups.length - 1 ? '1' : '0') + put(g, 4); });
  return s;
}

// puzzle: { start, towers: [[{ kind, v }]], world }
export function encode(puzzle) {
  const towers = puzzle.towers.filter((tw) => tw.length);
  let b = put(VERSION, 2) + put((puzzle.world || 0) & 7, 3) + putNum(puzzle.start) + put(towers.length - 1, 2);
  for (const tw of towers) {
    b += put(tw.length - 1, 3);
    for (const c of tw) {
      b += put(KINDS.indexOf(c.kind), 4);
      if (VALUED.has(c.kind)) b += putNum(c.v);
    }
  }
  b += put(hash10(b), 10);
  while (b.length % 5) b += '0';
  let out = '';
  for (let i = 0; i < b.length; i += 5) out += ALPHA[parseInt(b.slice(i, i + 5), 2)];
  return out;
}

// "ABCDE-FGHIJ-..." for showing; groups of 5
export const pretty = (code) => code.replace(/(.{5})(?=.)/g, '$1-');

// Returns the puzzle, or null when the code is not a valid tower code.
export function decode(text) {
  const clean = String(text || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length < 4 || clean.length > 200) return null;
  let b = '';
  for (const ch of clean) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) return null;
    b += put(i, 5);
  }
  let at = 0;
  const take = (w) => { if (at + w > b.length) throw new Error('short'); const v = parseInt(b.slice(at, at + w), 2); at += w; return v; };
  const num = () => { let v = 0; let more = 1; let n = 0; while (more) { if (++n > 6) throw new Error('long'); more = take(1); v = v * 16 + take(4); } return v; };
  try {
    if (take(2) !== VERSION) return null;
    const world = take(3);
    const start = num();
    const nt = take(2) + 1;
    const towers = [];
    for (let t = 0; t < nt; t++) {
      const nf = take(3) + 1;
      if (nf > LIMITS.floors) return null;
      const tw = [];
      for (let k = 0; k < nf; k++) {
        const kind = KINDS[take(4)];
        if (!kind) return null;
        const c = { kind };
        if (VALUED.has(kind)) { c.v = num(); if (c.v < 1 || c.v > LIMITS.maxV) return null; }
        tw.push(c);
      }
      towers.push(tw);
    }
    const body = b.slice(0, at);
    if (take(10) !== hash10(body)) return null;
    if (/1/.test(b.slice(at))) return null; // padding must be zeros
    if (start < 1 || start > LIMITS.maxStart) return null;
    if (towers.flat().filter((c) => c.kind === 'boss').length > 1) return null;
    return { start, towers, world };
  } catch (e) {
    return null;
  }
}
