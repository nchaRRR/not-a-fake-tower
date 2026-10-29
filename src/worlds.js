// Every 25 levels the towers move to a new place. Colours for the scene, the towers,
// the weather particles and the key the music is played in.
export const WORLDS = [
  {
    id: 'meadow', sky: 0xbfe0ff, ground: 0x8fd16a, path: 0xe9cf9a, hills: [0x7cc35a, 0x6fb64e], cloud: 0xffffff,
    wallA: 0xf3dcc0, wallB: 0xe8c9a6, roof: 0xe8453c, slab: 0x9c7a5b, pillar: 0xb88a62, flag: 0xffbe2e,
    hemiGround: 0x9bbf7a, sun: 0xffffff, sunI: 1.9, hemiI: 1.6, weather: null, key: 0,
    // knights and an orc
    enemy: { body: 0xe8453c, head: 0xffc9a8, helmet: 0x8e2620, pack: 0x8e2620, legs: 0x4a2230, extras: ['eyes'] },
    boss: { body: 0x5a2f9e, head: 0x9adf6a, helmet: 0xffbe2e, pack: 0x3a1d6b, legs: 0x2a1745, extras: ['eyes', 'tusks'] },
  },
  {
    id: 'desert', sky: 0xffe0b0, ground: 0xf0c77a, path: 0xe2a95c, hills: [0xe8b366, 0xdba152], cloud: 0xfff4e0,
    wallA: 0xf7e4bd, wallB: 0xebd19c, roof: 0x2a9d8f, slab: 0xb7864f, pillar: 0xc99a5e, flag: 0xe8453c,
    hemiGround: 0xd9b27a, sun: 0xfff1d6, sunI: 2.1, hemiI: 1.6, weather: 'dust', key: 2,
    // mummies and a pharaoh
    enemy: { body: 0xe6dcc3, head: 0xe6dcc3, helmet: 0xd9ccaf, pack: 0xcbbd9c, legs: 0xd2c4a4, extras: ['wraps', 'glowEyesCyan'] },
    boss: { body: 0xffbe2e, head: 0x9a6a44, helmet: 0x2f5fcf, pack: 0xc98a00, legs: 0x2f5fcf, extras: ['nemes', 'band', 'eyes'] },
  },
  {
    id: 'snow', sky: 0xd6eaff, ground: 0xf3f7fd, path: 0xd3e2f1, hills: [0xe7f0fb, 0xd5e3f2], cloud: 0xffffff,
    wallA: 0xeef2f7, wallB: 0xdee5ef, roof: 0x2f7cf6, slab: 0x8a96a8, pillar: 0xa3b3c6, flag: 0xe8453c,
    hemiGround: 0xc9d8e8, sun: 0xffffff, sunI: 1.7, hemiI: 1.7, weather: 'snow', key: -3,
    // yetis and an ice giant
    enemy: { body: 0xf4f8ff, head: 0x9cc3e6, helmet: 0xf4f8ff, pack: 0xe2ecf8, legs: 0xdfe9f6, extras: ['fur', 'eyes'] },
    boss: { body: 0x7cc8f2, head: 0xd8f1ff, helmet: 0x4aa3d8, pack: 0x3f8fc6, legs: 0x2f6f9e, extras: ['icicles', 'glowEyesCyan'] },
  },
  {
    id: 'lava', sky: 0x3b2140, ground: 0x4a3034, path: 0x6e3a28, hills: [0x5c2b2b, 0x401f26], cloud: 0x5a4658,
    wallA: 0x9a8682, wallB: 0x86726f, roof: 0x2b2140, slab: 0x4d3a38, pillar: 0x624c49, flag: 0xff7a2e,
    hemiGround: 0x7a3a2a, sun: 0xffc8a0, sunI: 1.6, hemiI: 1.25, weather: 'embers', key: -5,
    // imps and a fire demon
    enemy: { body: 0xa3201a, head: 0xe8553c, helmet: 0x2b1414, pack: 0x5a1010, legs: 0x2b1414, extras: ['horns', 'glowEyesGold'] },
    boss: { body: 0x2b0f0f, head: 0xff6a2e, helmet: 0x1a0808, pack: 0x1a0808, legs: 0x1a0808, extras: ['horns', 'flame', 'glowEyesGold'] },
  },
  {
    id: 'jungle', sky: 0xbfeccc, ground: 0x4f9a3a, path: 0x9a7444, hills: [0x2f7a32, 0x3f8f3a], cloud: 0xf2fff4,
    wallA: 0xd6c9a0, wallB: 0xc4b88e, roof: 0xe07a2e, slab: 0x6f5a3a, pillar: 0x7a6440, flag: 0xffbe2e,
    hemiGround: 0x4f8a3a, sun: 0xfff6d8, sunI: 1.9, hemiI: 1.6, weather: 'leaves', key: 1,
    // lizardmen and a gorilla king
    enemy: { body: 0x4caf50, head: 0x7ed957, helmet: 0x2e7d32, pack: 0x8d6e3f, legs: 0x2e5e2e, extras: ['glowEyesGold'] },
    boss: { body: 0x3a3a40, head: 0x6a5a50, helmet: 0x2a2a30, pack: 0x2a2a30, legs: 0x2a2a30, extras: ['eyes', 'crown'] },
  },
  {
    id: 'pirate', sky: 0x9fe3ff, ground: 0xf2dca0, path: 0xe0c27a, hills: [0x3fb6c9, 0x2f9fb4], cloud: 0xffffff,
    wallA: 0xd09a60, wallB: 0xbd8750, roof: 0xe8453c, slab: 0x6b4224, pillar: 0x7a4a26, flag: 0x2b2140,
    hemiGround: 0xd9c08a, sun: 0xffffff, sunI: 2.0, hemiI: 1.6, weather: null, key: 4,
    // pirates and their captain
    enemy: { body: 0xe8e2d0, head: 0xffc9a8, helmet: 0xe8453c, pack: 0x6b3f22, legs: 0x2b3a5a, extras: ['eyes', 'eyepatch'] },
    boss: { body: 0x8a1e1e, head: 0xffc9a8, helmet: 0x1a1a22, pack: 0x5a1010, legs: 0x1a1a22, extras: ['tricorn', 'eyes', 'beard'] },
  },
  {
    id: 'haunted', sky: 0x2c2b45, ground: 0x3d4a3a, path: 0x5a5560, hills: [0x2f3a33, 0x26302b], cloud: 0x5a5872,
    wallA: 0x8b8698, wallB: 0x7a7588, roof: 0x4b3a6b, slab: 0x4a4550, pillar: 0x55505e, flag: 0x9b6cff,
    hemiGround: 0x3a3a50, sun: 0xc8c0ff, sunI: 1.5, hemiI: 1.3, weather: 'mist', key: -2,
    // skeletons and a vampire
    enemy: { body: 0xeae6da, head: 0xf2efe6, helmet: 0xd8d3c4, pack: 0xc8c2b0, legs: 0xeae6da, extras: ['glowEyesCyan'] },
    boss: { body: 0x1a1a24, head: 0xd8d8e8, helmet: 0x1a1a24, pack: 0x1a1a24, legs: 0x1a1a24, extras: ['collar', 'glowEyesRed'] },
  },
  {
    id: 'space', sky: 0x14122b, ground: 0x7a7a8a, path: 0x9a9ab0, hills: [0x5a5a6a, 0x4a4a5a], cloud: 0x3a3858,
    wallA: 0xd9dde8, wallB: 0xc6ccda, roof: 0x8a5cf0, slab: 0x5d6878, pillar: 0x8a96a8, flag: 0x3fd6ff,
    hemiGround: 0x5a5a7a, sun: 0xe8f0ff, sunI: 1.8, hemiI: 1.35, weather: 'stars', key: 3,
    // aliens and a robot
    enemy: { body: 0x5fbf8a, head: 0x8ef57a, helmet: 0x8ef57a, pack: 0x3f8f6a, legs: 0x3f8f6a, extras: ['antenna', 'bigEyes'] },
    boss: { body: 0xb9c3d1, head: 0x8a96a8, helmet: 0x6a7488, pack: 0x5d6878, legs: 0x5d6878, extras: ['antenna', 'visor'] },
  },
];

export const worldIndex = (n) => (n <= 0 ? 0 : Math.floor((n - 1) / 25) % WORLDS.length);
export const worldOf = (n) => WORLDS[worldIndex(n)];
