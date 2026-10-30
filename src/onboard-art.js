// Pictures for the first-launch pages (flat SVG, 300 x 300).
const INK = '#2b2140';
const badge = (x, y, n, c) => `<g transform="translate(${x} ${y})"><rect x="-22" y="-14" width="44" height="26" rx="13" fill="${c}" stroke="${INK}" stroke-width="3"/><text y="7" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="18" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">${n}</text></g>`;
const hero = (x, y, n, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-12" y="-34" width="24" height="28" rx="9" fill="#2f7cf6" stroke="${INK}" stroke-width="3"/><circle cy="-44" r="11" fill="#ffd2b0" stroke="${INK}" stroke-width="3"/><path d="M-12 -50 q12 -14 24 0" fill="#c9893b" stroke="${INK}" stroke-width="3"/><path d="M14 -30 l12 -16" stroke="#9aa6b8" stroke-width="5" stroke-linecap="round"/><rect x="-10" y="-8" width="8" height="10" rx="3" fill="${INK}"/><rect x="2" y="-8" width="8" height="10" rx="3" fill="${INK}"/></g>${n != null ? badge(x, y - 74 * s, n, '#2f7cf6') : ''}`;
const mob = (x, y, n, c = '#2eb872', s = 1, crown = false) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0 C-18 -30 -10 -42 0 -42 C10 -42 18 -30 16 0 Z" fill="${c}" stroke="${INK}" stroke-width="3"/><circle cx="-6" cy="-26" r="4" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="6" cy="-26" r="4" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-6 -14 l4 -3 l4 3 l4 -3" fill="none" stroke="${INK}" stroke-width="2.5"/>${crown ? `<path d="M-12 -40 l3 -12 l6 8 l3 -10 l3 10 l6 -8 l3 12 Z" fill="#ffbe2e" stroke="${INK}" stroke-width="2.5"/>` : ''}</g>${n != null ? badge(x, y - 60 * s, n, '#e8453c') : ''}`;
const floor = (y, w = 180) => `<rect x="${150 - w / 2}" y="${y}" width="${w}" height="10" fill="#b58a5a" stroke="${INK}" stroke-width="3"/>`;
const towerBg = (bg) => `<rect width="300" height="300" fill="${bg}"/><rect x="60" y="30" width="180" height="270" fill="#e6dcd4" stroke="${INK}" stroke-width="4"/><path d="M50 30 L150 -10 L250 30 Z" fill="#8a78f0" stroke="${INK}" stroke-width="4"/>`;

export function towerArt() {
  const p1 = `<svg viewBox="0 0 300 300">${towerBg('#bfe0ff')}${floor(110)}${floor(190)}${floor(270)}
    ${mob(150, 110, 50, '#e8453c', 1, true)}${mob(110, 190, 8)}${mob(190, 190, 30)}${hero(150, 270, 12)}
    <rect x="14" y="14" width="44" height="24" rx="6" fill="#ffbe2e" stroke="${INK}" stroke-width="3"/><text x="36" y="32" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="15" fill="${INK}">AD</text></svg>`;
  const p2 = `<svg viewBox="0 0 300 300"><rect width="300" height="300" fill="#ffe0c4"/><rect y="230" width="300" height="70" fill="#b58a5a"/>
    ${hero(80, 230, 12, 1.4)}${mob(220, 230, 8, '#2eb872', 1.4)}
    <path d="M118 150 h60" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M178 150 l-14 -10 M178 150 l-14 10" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <text x="150" y="58" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="40" fill="#2eb872" stroke="#fff" stroke-width="6" paint-order="stroke">12 + 8 = 20</text></svg>`;
  const item = (x, label, color, icon) => `<g transform="translate(${x} 150)"><rect x="-40" y="-56" width="80" height="112" rx="18" fill="#fff" stroke="${INK}" stroke-width="4"/>${icon}<text y="44" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="24" fill="${color}" stroke="${INK}" stroke-width="1" paint-order="stroke">${label}</text></g>`;
  const p3 = `<svg viewBox="0 0 300 300"><rect width="300" height="300" fill="#d8f4d0"/>
    ${item(58, '+5', '#2eb872', `<path d="M0 -44 l8 10 v38 h-16 v-38 Z" fill="#dfe6ef" stroke="${INK}" stroke-width="3"/><rect x="-16" y="2" width="32" height="7" rx="3" fill="#ffbe2e" stroke="${INK}" stroke-width="3"/><rect x="-4" y="9" width="8" height="12" rx="2" fill="#6b3f22" stroke="${INK}" stroke-width="2"/>`)}
    ${item(150, '×2', '#8a78f0', `<path d="M-8 -44 h16 v12 q18 8 18 28 q0 22 -26 22 q-26 0 -26 -22 q0 -20 18 -28 Z" fill="#c9b8ff" stroke="${INK}" stroke-width="3"/><path d="M-24 -6 q24 10 48 0 v8 q-4 14 -24 14 q-20 0 -24 -14 Z" fill="#8a78f0"/>`)}
    ${item(242, '-10', '#e8453c', `<path d="M-26 10 l8 -34 l8 34 l8 -34 l8 34 l8 -34 l8 34 Z" fill="#9aa6b8" stroke="${INK}" stroke-width="3"/>`)}</svg>`;
  const p4 = `<svg viewBox="0 0 300 300">${towerBg('#ffd9c4')}${floor(150)}${floor(270)}${mob(150, 150, 99, '#e8453c', 1.5, true)}${hero(150, 270, 120, 1.2)}
    <text x="236" y="230" font-size="34">🏆</text></svg>`;
  return [p1, p2, p3, p4];
}
