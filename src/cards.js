// The card album: 24 cards in 4 sets of 6. Each set has 3 common, 2 rare and 1 epic card.
// Cards drop after won levels; a duplicate turns into coins; a full set pays a big reward.
// The art is plain SVG in the series look (thick ink outline, flat colours).
import { WORLDS } from './worlds.js';
import { SKINS } from './shop.js';

const skin = (id) => SKINS.find((k) => k.id === id);
const W = (id) => WORLDS.find((w) => w.id === id);

export const CARD_SETS = [
  { id: 'heroes', bg: '#bfe0ff', reward: { coins: 300, hints: 2 } },
  { id: 'enemies', bg: '#ffd9cf', reward: { coins: 400 } },
  { id: 'items', bg: '#fff2b8', reward: { coins: 400, hints: 3 } },
  { id: 'bosses', bg: '#e6dcff', reward: { coins: 800, skin: 'warlord' } },
];

// fig: colours of a figure, x: accessories; item: an item drawing
export const CARDS = [
  { id: 'hero', set: 'heroes', rar: 'c', fig: skin('blue'), x: ['sword'] },
  { id: 'ranger', set: 'heroes', rar: 'c', fig: skin('ranger'), x: ['sword'] },
  { id: 'knight', set: 'heroes', rar: 'c', fig: skin('knight'), x: ['sword', 'plume'] },
  { id: 'ninja', set: 'heroes', rar: 'r', fig: skin('ninja'), x: ['mask'] },
  { id: 'princess', set: 'heroes', rar: 'r', fig: { body: 0xff7eb6, head: 0xffd2b0, helmet: 0xffbe2e, legs: 0xff7eb6 }, x: ['dress', 'crown'] },
  { id: 'golden', set: 'heroes', rar: 'e', fig: skin('golden'), x: ['sword', 'shine'] },
  { id: 'redknight', set: 'enemies', rar: 'c', fig: W('meadow').enemy, x: [] },
  { id: 'mummy', set: 'enemies', rar: 'c', fig: W('desert').enemy, x: ['wraps', 'glowCyan'] },
  { id: 'lizard', set: 'enemies', rar: 'c', fig: W('jungle').enemy, x: ['glowGold'] },
  { id: 'skeleton', set: 'enemies', rar: 'r', fig: W('haunted').enemy, x: ['ribs', 'glowCyan'] },
  { id: 'imp', set: 'enemies', rar: 'r', fig: W('lava').enemy, x: ['horns', 'glowGold'] },
  { id: 'alien', set: 'enemies', rar: 'e', fig: W('space').enemy, x: ['antenna', 'bigEyes'] },
  { id: 'sword', set: 'items', rar: 'c', item: 'sword' },
  { id: 'potion', set: 'items', rar: 'c', item: 'potion' },
  { id: 'trap', set: 'items', rar: 'c', item: 'trap' },
  { id: 'key', set: 'items', rar: 'r', item: 'key' },
  { id: 'curse', set: 'items', rar: 'r', item: 'curse' },
  { id: 'bomb', set: 'items', rar: 'e', item: 'bomb' },
  { id: 'orc', set: 'bosses', rar: 'c', fig: W('meadow').boss, x: ['tusks', 'crown'] },
  { id: 'pharaoh', set: 'bosses', rar: 'c', fig: W('desert').boss, x: ['nemes'] },
  { id: 'icegiant', set: 'bosses', rar: 'c', fig: W('snow').boss, x: ['icicles', 'glowCyan'] },
  { id: 'captain', set: 'bosses', rar: 'r', fig: W('pirate').boss, x: ['tricorn', 'beard', 'patch'] },
  { id: 'demon', set: 'bosses', rar: 'r', fig: W('lava').boss, x: ['horns', 'flame', 'glowGold'] },
  { id: 'robot', set: 'bosses', rar: 'e', fig: W('space').boss, x: ['antenna', 'visor'] },
];
export const cardById = (id) => CARDS.find((c) => c.id === id);
export const DUP_COINS = { c: 15, r: 40, e: 100 };
export const DROP_CHANCE = 0.35;

// Rarity first (62% common, 28% rare, 10% epic), then a card of that rarity; missing cards are
// favoured so the album fills at a fair pace.
export function rollCard(owned, rng = Math.random) {
  const r = rng();
  const rar = r < 0.1 ? 'e' : r < 0.38 ? 'r' : 'c';
  const pool = CARDS.filter((c) => c.rar === rar);
  const missing = pool.filter((c) => !owned[c.id]);
  const from = missing.length && rng() < 0.7 ? missing : pool;
  return from[Math.floor(rng() * from.length)];
}
export const setCards = (setId) => CARDS.filter((c) => c.set === setId);
export const setDone = (owned, setId) => setCards(setId).every((c) => owned[c.id]);

// ---------------------------------------------------------------- art
const INK = '#2b2140';
const hx = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const S = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;

function figure(f, x) {
  const has = (k) => x.includes(k);
  const body = hx(f.body);
  const head = hx(f.head);
  const helm = hx(f.helmet);
  const legs = hx(f.legs);
  let back = '';
  let front = '';
  if (has('shine')) back += `<g opacity="0.55">${[0, 45, 90, 135].map((a) => `<rect x="47" y="2" width="6" height="116" rx="3" fill="#fff" transform="rotate(${a} 50 60)"/>`).join('')}</g>`;
  if (has('flame')) back += `<path d="M50 4c10 10 12 18 6 26 6-2 8-8 7-12 6 8 3 18-13 20-16-2-19-12-13-20-1 4 1 10 7 12-6-8-4-16 6-26z" fill="#ffa23a" ${S}/>`;
  if (has('sword')) back += `<g transform="rotate(28 76 70)"><rect x="73" y="26" width="7" height="42" rx="2" fill="#dfe6ef" ${S}/><rect x="66" y="66" width="21" height="6" rx="3" fill="#ffbe2e" ${S}/><rect x="73.5" y="72" width="6" height="11" rx="2" fill="#6b3f22" ${S}/></g>`;
  // legs, body, head, helmet
  let s = back;
  s += `<rect x="38" y="86" width="10" height="22" rx="4" fill="${legs}" ${S}/><rect x="52" y="86" width="10" height="22" rx="4" fill="${legs}" ${S}/>`;
  if (has('dress')) s += `<path d="M38 58h24l9 36H29z" fill="${body}" ${S}/>`;
  else s += `<rect x="32" y="56" width="36" height="38" rx="15" fill="${body}" ${S}/>`;
  if (has('ribs')) s += `<path d="M42 66h16M41 73h18M42 80h16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  if (has('wraps')) s += `<path d="M34 66l32-4M33 76l34 3M35 86l30-4" stroke="#bfae8a" stroke-width="3.5" stroke-linecap="round"/>`;
  if (has('nemes')) s += `<path d="M28 34q22-22 44 0l4 34-12-8V40H36v20l-12 8z" fill="#2f5fcf" ${S}/><path d="M30 46h40" stroke="#ffd34d" stroke-width="4"/>`;
  s += `<circle cx="50" cy="42" r="17" fill="${head}" ${S}/>`;
  if (!has('nemes') && !has('tricorn')) s += `<path d="M31 40a19 19 0 0 1 38 0z" fill="${helm}" ${S}/>`;
  if (has('mask')) s += `<rect x="33" y="40" width="34" height="11" rx="5" fill="${INK}"/><circle cx="44" cy="45.5" r="2.6" fill="#fff"/><circle cx="56" cy="45.5" r="2.6" fill="#fff"/>`;
  // eyes
  const eye = has('glowCyan') ? '#9ff3ff' : has('glowGold') ? '#ffe07a' : INK;
  if (has('bigEyes')) s += `<ellipse cx="43" cy="46" rx="5" ry="6.5" fill="#111118"/><ellipse cx="57" cy="46" rx="5" ry="6.5" fill="#111118"/><circle cx="44.5" cy="44" r="1.6" fill="#fff"/><circle cx="58.5" cy="44" r="1.6" fill="#fff"/>`;
  else if (has('visor')) s += `<rect x="37" y="42" width="26" height="7" rx="3.5" fill="#ff5a5a" ${S}/>`;
  else if (!has('mask')) {
    const glow = eye !== INK ? ` stroke="${INK}" stroke-width="1.5"` : '';
    s += `<circle cx="44" cy="46" r="${glow ? 3.4 : 2.8}" fill="${eye}"${glow}/><circle cx="56" cy="46" r="${glow ? 3.4 : 2.8}" fill="${eye}"${glow}/>`;
  }
  if (has('patch')) s += `<circle cx="56" cy="46" r="4.5" fill="#111118"/><path d="M34 38l30 10" stroke="#111118" stroke-width="2.5"/>`;
  if (has('tusks')) s += `<path d="M44 54l1.5 5 1.5-5zM53 54l1.5 5 1.5-5z" fill="#fff6dc" stroke="${INK}" stroke-width="1.5"/>`;
  if (has('beard')) s += `<path d="M38 50q12 18 24 0v6q-12 14-24 0z" fill="#1a1a22" ${S}/>`;
  // on top of the head
  if (has('plume')) front += `<path d="M50 23q4-14 16-12-6 4-8 14z" fill="#e8453c" ${S}/>`;
  if (has('crown')) front += `<path d="M38 28l3-12 5 7 4-9 4 9 5-7 3 12z" fill="#ffbe2e" ${S}/>`;
  if (has('horns')) front += `<path d="M37 30q-8-6-6-18 6 6 11 10zM63 30q8-6 6-18-6 6-11 10z" fill="#f2e6d0" ${S}/>`;
  if (has('antenna')) front += `<path d="M50 25V10" ${S}/><circle cx="50" cy="9" r="4.5" fill="#ff5a5a" ${S}/>`;
  if (has('icicles')) front += `<path d="M40 26l3-14 3 14zM47 25l3-18 3 18zM54 26l3-14 3 14z" fill="#bfeaff" ${S}/>`;
  if (has('tricorn')) front += `<path d="M24 36q26-26 52 0q-26-8-52 0z" fill="#1a1a22" ${S}/><circle cx="50" cy="22" r="3.5" fill="#ffbe2e"/>`;
  return s + front;
}

const ITEMS = {
  sword: `<g transform="rotate(-35 50 60)"><path d="M45 14h10v58H45z" fill="#dfe6ef" ${S}/><path d="M45 14l5-8 5 8z" fill="#dfe6ef" ${S}/><path d="M50 18v50" stroke="#fff" stroke-width="2.5"/><rect x="32" y="70" width="36" height="9" rx="4.5" fill="#ffbe2e" ${S}/><rect x="45" y="79" width="10" height="20" rx="3" fill="#6b3f22" ${S}/><circle cx="50" cy="102" r="5" fill="#ffbe2e" ${S}/></g>`,
  potion: `<circle cx="50" cy="72" r="26" fill="#a77bff" ${S}/><path d="M30 76q20 10 40 0" stroke="#7a52e0" stroke-width="5" fill="none"/><rect x="42" y="30" width="16" height="22" fill="#a77bff" ${S}/><rect x="40" y="20" width="20" height="12" rx="3" fill="#c49a6c" ${S}/><circle cx="40" cy="64" r="5" fill="#fff" opacity="0.8"/>`,
  trap: `<rect x="14" y="78" width="72" height="14" rx="4" fill="#ff8c3a" ${S}/>${[24, 42, 60, 78].map((x) => `<path d="M${x - 8} 80l8-34 8 34z" fill="#cfd4dc" ${S}/>`).join('')}`,
  key: `<g transform="rotate(-30 50 60)"><circle cx="30" cy="60" r="15" fill="#ffbe2e" ${S}/><circle cx="30" cy="60" r="6" fill="#fff2b8" ${S}/><rect x="44" y="55" width="40" height="10" rx="3" fill="#ffbe2e" ${S}/><rect x="70" y="63" width="7" height="12" rx="2" fill="#ffbe2e" ${S}/><rect x="60" y="63" width="6" height="9" rx="2" fill="#ffbe2e" ${S}/></g>`,
  curse: `<ellipse cx="50" cy="62" rx="36" ry="12" fill="none" stroke="#c58bff" stroke-width="5"/><path d="M50 26l22 34-22 34-22-34z" fill="#6a2fb0" ${S}/><path d="M50 26l8 34-8 34" fill="#9b3cff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 62a36 12 0 0 0 72 0" fill="none" stroke="#c58bff" stroke-width="5"/>`,
  bomb: `<circle cx="46" cy="70" r="28" fill="${INK}" ${S}/><circle cx="36" cy="60" r="6" fill="#fff" opacity="0.35"/><rect x="38" y="36" width="16" height="10" rx="3" fill="#8a96a8" ${S}/><path d="M46 36q4-14 18-16" fill="none" stroke="#c49a6c" stroke-width="5" stroke-linecap="round"/><path d="M66 8l3 8 8-2-5 7 7 5-9 1 1 9-6-6-6 6 1-9-9-1 7-5-5-7 8 2z" fill="#ffb000" ${S}/>`,
};

// hidden: a card not found yet is drawn as a flat silhouette
export function cardArt(card, hidden = false) {
  const set = CARD_SETS.find((s) => s.id === card.set);
  let inner = card.item ? ITEMS[card.item] : figure(card.fig, card.x || []);
  if (hidden) {
    inner = `<g opacity="0.3">${inner.replace(/(fill|stroke)="#[0-9a-fA-F]{3,6}"/g, '$1="' + INK + '"')}</g>`;
  }
  return `<svg viewBox="0 0 100 120" aria-hidden="true"><rect width="100" height="120" fill="${hidden ? '#e6dfd8' : set.bg}"/>`
    + `<ellipse cx="50" cy="110" rx="26" ry="5" fill="${INK}" opacity="0.15"/>${inner}</svg>`;
}
