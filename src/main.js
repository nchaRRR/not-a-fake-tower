// Not a Fake Ad: Tower — the hero-in-the-tower game from the ads, made playable.
// Scene: a row of towers seen from the front. Tap a tower and the hero jumps into its lowest
// occupied floor, then fights, drinks, picks up or steps on what is there.
import * as THREE from 'three';
import { FigureSet } from './figures.js';
import { makeCountLabel } from './labels.js';
import { sfx, unlockAudio, setMuted } from './audio.js';
import { loadSave, writeSave, freshSave as loadSaveFresh } from './save.js';
import { track } from './analytics.js';
import { startTelemetry } from './telemetry.js';
import { t, getLang, setLang, applyStatic, nextLang, LANG_NAMES } from './i18n.js';
import { apply, solve, step, decodeLevel, buildLevel, setEvent, potionMult, swordValue, trapValue } from './rules.js';
import { currentEvent, WEEK_GOAL, WEEK_REWARD } from './events.js';
// anonymous play statistics (phone app only)
startTelemetry({ game: 'tower', version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev', enabled: typeof __CLOUD__ !== 'undefined' && __CLOUD__, lang: () => document.documentElement.lang });

const EVENT = currentEvent();
setEvent(EVENT.id);
import RAW_LEVELS from './levels.json';
import { UPGRADES, SKINS, HINT_PACKS, startPower, coinReward } from './shop.js';
import { startMusic, setMusicEnabled, setSong } from './music.js';
import { createAds } from './ads.js';
import { createAccount } from './account.js';
import { storeLink, openLink } from './promo.js';
import { runOpening } from './opening.js';
import { towerArt } from './onboard-art.js';
import promoIcon from '../assets/promo-nfa-128.webp';
import promoIcon2 from '../assets/promo-choices-128.webp';
import { createRemote } from './remote.js';
import { createPayments, PRODUCTS } from './payments.js';
import { createReview } from './review.js';
import { makeCard, shareCanvas } from './share.js';
import { createLeaderboard } from './leaderboard.js';
import { createCrossRewards } from './crossreward.js';
import { createInterstitials } from './interstitial.js';
import { adPrivacy as admobApi } from './ads.js';
const CLOUD = typeof __CLOUD__ !== 'undefined' && __CLOUD__;
const remote = createRemote('tower', { enabled: CLOUD, defaults: { coin_mult: 1 } });
remote.refresh();
import { scheduleNotifications, askNotificationPermission, planNotifications } from './notify.js';
import { dayIndex, dailySpecN, dailySeed } from './daily.js';
import DAILY_TOWERS from './daily.json';
import { ACHIEVEMENTS, claimable } from './achievements.js';
import { WORLDS, worldOf, worldIndex } from './worlds.js';
import { setSongKey } from './music.js';
const ads = createAds({ skipAds: () => (save.iap || []).includes('no_ads') });
const payments = createPayments();

const $ = (id) => document.getElementById(id);
const save = loadSave();
setMuted(save.muted);

// ---------------------------------------------------------------- sizes
const FH = 2.1; // floor height
const RW = 2.1; // room width
const RD = 1.7; // room depth
const GAP = 2.42; // tower spacing
const SLAB = 0.18;

// ---------------------------------------------------------------- renderer & scene
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe0ff);
scene.fog = new THREE.Fog(0xbfe0ff, 60, 120);
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9bbf7a, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(-8, 18, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -4, near: 1, far: 60 });
scene.add(sun, sun.target);

// ground, hills and clouds
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), mat(0x8fd16a));
ground.rotation.x = -Math.PI / 2;
ground.position.z = 10;
ground.receiveShadow = true;
scene.add(ground);
const path = new THREE.Mesh(new THREE.PlaneGeometry(200, 2.2), mat(0xe9cf9a));
path.rotation.x = -Math.PI / 2;
path.position.set(0, 0.01, 1.6);
path.receiveShadow = true;
scene.add(path);
const hills = [];
for (let i = 0; i < 7; i++) {
  const hill = new THREE.Mesh(new THREE.SphereGeometry(6 + (i % 3) * 2, 20, 12), mat(i % 2 ? 0x7cc35a : 0x6fb64e));
  hill.position.set(-30 + i * 10, -3, -18 - (i % 2) * 4);
  scene.add(hill);
  hills.push(hill);
}
const cloudMat = mat(0xffffff, { roughness: 1 });
const clouds = [];
for (let i = 0; i < 6; i++) {
  const c = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 14, 10), cloudMat);
    s.position.set(k * 1.1 - 1.6, Math.random() * 0.5, Math.random() * 0.4);
    c.add(s);
  }
  c.position.set(-24 + i * 9, 14 + (i % 3) * 3, -14);
  c.userData.speed = 0.2 + Math.random() * 0.25;
  scene.add(c);
  clouds.push(c);
}

// ---------------------------------------------------------------- shared geometry
const G = {
  wall: new THREE.BoxGeometry(RW, FH, 0.2),
  slab: new THREE.BoxGeometry(RW + 0.3, SLAB, RD + 0.2),
  pillar: new THREE.BoxGeometry(0.22, FH, 0.26),
  window: new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2),
  windowLow: new THREE.BoxGeometry(0.52, 0.4, 0.05),
  roof: new THREE.ConeGeometry(RW * 0.82, 1.7, 4).rotateY(Math.PI / 4),
  pole: new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6),
  flag: new THREE.BoxGeometry(0.55, 0.32, 0.03),
  blade: new THREE.BoxGeometry(0.1, 0.72, 0.035).translate(0, 0.5, 0),
  guard: new THREE.BoxGeometry(0.36, 0.07, 0.08).translate(0, 0.13, 0),
  grip: new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8).translate(0, 0.0, 0),
  flask: new THREE.SphereGeometry(0.24, 16, 12).translate(0, 0.26, 0),
  neck: new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10).translate(0, 0.56, 0),
  cork: new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10).translate(0, 0.7, 0),
  spike: new THREE.ConeGeometry(0.11, 0.42, 6).translate(0, 0.21, 0),
  plate: new THREE.BoxGeometry(1.1, 0.06, 0.9).translate(0, 0.03, 0),
  crown: new THREE.CylinderGeometry(0.12, 0.1, 0.1, 8, 1, true),
  heart: new THREE.SphereGeometry(0.12, 10, 8),
  frame: new THREE.BoxGeometry(1, 1, 1),
  orb: new THREE.OctahedronGeometry(0.3, 0),
  shieldDisc: new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20),
  shieldRim: new THREE.TorusGeometry(0.34, 0.04, 8, 24),
  shieldBoss: new THREE.SphereGeometry(0.07, 10, 8),
  halo: new THREE.TorusGeometry(0.42, 0.035, 8, 28),
  keyRing: new THREE.TorusGeometry(0.15, 0.05, 10, 20),
  keyShaft: new THREE.BoxGeometry(0.42, 0.07, 0.06).translate(0.33, 0, 0),
  keyTooth: new THREE.BoxGeometry(0.06, 0.13, 0.06),
  door: new THREE.BoxGeometry(RW - 0.36, FH - 0.36, 0.12),
  plank: new THREE.BoxGeometry(RW - 0.4, 0.05, 0.03),
  padlock: new THREE.BoxGeometry(0.38, 0.32, 0.14),
  shackle: new THREE.TorusGeometry(0.12, 0.04, 8, 16, Math.PI),
};
const M = {
  wallA: mat(0xf3dcc0), wallB: mat(0xe8c9a6), cleared: mat(0xd8c7b6),
  slab: mat(0x9c7a5b), pillar: mat(0xb88a62), window: mat(0x8fc4f0, { emissive: 0x3d6f9e, emissiveIntensity: 0.3 }),
  roof: mat(0xe8453c), roofBoss: mat(0x6d3fb8), pole: mat(0x6b5a4a), flag: mat(0xffbe2e),
  blade: mat(0xdfe6ef, { metalness: 0.6, roughness: 0.3 }), gold: mat(0xffbe2e, { metalness: 0.4, roughness: 0.4 }),
  grip: mat(0x6b3f22), flask: mat(0xa77bff, { roughness: 0.25, transparent: true, opacity: 0.92, emissive: 0x3a1a80, emissiveIntensity: 0.4 }),
  cork: mat(0xc49a6c), spike: mat(0xcfd4dc, { metalness: 0.5, roughness: 0.35 }), plate: mat(0xff8c3a),
  hint: new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9 }),
  danger: new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85 }),
  bubble: new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.28, depthWrite: false }),
  pedestal: mat(0x9aa6b8),
  curse: mat(0x4a1f7a, { emissive: 0x9b3cff, emissiveIntensity: 0.55, roughness: 0.3 }),
  halo: new THREE.MeshBasicMaterial({ color: 0xc58bff }),
  door: mat(0x8a5a32), plank: mat(0x6b4224),
  shield: mat(0x6a7f9e, { metalness: 0.4, roughness: 0.4 }),
};
function makeKey(parent, s = 1) {
  const g = new THREE.Group();
  addMesh(G.keyRing, M.gold, 0, 0, 0, g);
  addMesh(G.keyShaft, M.gold, 0, 0, 0, g);
  addMesh(G.keyTooth, M.gold, 0.46, -0.08, 0, g);
  addMesh(G.keyTooth, M.gold, 0.36, -0.08, 0, g);
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

// characters (instanced)
const heroSet = new FigureSet(scene, 1, { body: 0x2f7cf6, head: 0xffd2b0, helmet: 0x1d5bc4, pack: 0x1d5bc4, legs: 0x23366b });
// trialSkin: a look borrowed for one level by watching an ad
let trialSkin = null;
let trialLevel = null;
function applySkin() {
  const k = SKINS.find((x) => x.id === (trialSkin || save.skin)) || SKINS[0];
  heroSet.setColors(k);
}
applySkin();
const enemySet = new FigureSet(scene, 30, { body: 0xe8453c, head: 0xffc9a8, helmet: 0x8e2620, pack: 0x8e2620, legs: 0x4a2230 });
const bossSet = new FigureSet(scene, 2, { body: 0x5a2f9e, head: 0x9adf6a, helmet: 0xffbe2e, pack: 0x3a1d6b, legs: 0x2a1745 });
const princessSet = new FigureSet(scene, 2, { body: 0xff7eb6, head: 0xffd2b0, helmet: 0xffbe2e, pack: 0xff9ac8, legs: 0xff7eb6 });

// ---------------------------------------------------------------- worlds & weather
const WEATHER_N = 260;
const weatherGeo = new THREE.BufferGeometry();
const weatherPos = new Float32Array(WEATHER_N * 3);
const weatherVel = new Float32Array(WEATHER_N * 3);
weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPos, 3));
const weatherMat = new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
const weather = new THREE.Points(weatherGeo, weatherMat);
weather.frustumCulled = false;
weather.visible = false;
scene.add(weather);
let weatherKind = null;
function seedFlake(i, anywhere) {
  const k = weatherKind;
  weatherPos[i * 3] = (Math.random() - 0.5) * 34;
  weatherPos[i * 3 + 1] = anywhere ? Math.random() * 24 - 2 : k === 'embers' ? -2 : 22;
  weatherPos[i * 3 + 2] = Math.random() * 6 - 1;
  if (k === 'snow') { weatherVel[i * 3] = (Math.random() - 0.5) * 0.4; weatherVel[i * 3 + 1] = -0.8 - Math.random() * 0.8; }
  else if (k === 'leaves') { weatherVel[i * 3] = 0.6 + Math.random() * 0.8; weatherVel[i * 3 + 1] = -0.6 - Math.random() * 0.5; }
  else if (k === 'mist') { weatherVel[i * 3] = 0.3 + Math.random() * 0.4; weatherVel[i * 3 + 1] = (Math.random() - 0.5) * 0.15; }
  else if (k === 'stars') { weatherVel[i * 3] = 0; weatherVel[i * 3 + 1] = 0; weatherPos[i * 3 + 2] = -6; }
  else if (k === 'dust') { weatherVel[i * 3] = 1.5 + Math.random() * 2; weatherVel[i * 3 + 1] = (Math.random() - 0.5) * 0.3; }
  else { weatherVel[i * 3] = (Math.random() - 0.5) * 0.5; weatherVel[i * 3 + 1] = 0.8 + Math.random() * 1.4; }
}
function updateWeather(dt) {
  if (!weather.visible) return;
  for (let i = 0; i < WEATHER_N; i++) {
    weatherPos[i * 3] += weatherVel[i * 3] * dt;
    weatherPos[i * 3 + 1] += weatherVel[i * 3 + 1] * dt;
    const y = weatherPos[i * 3 + 1];
    if (y < -2 || y > 24 || weatherPos[i * 3] > 18) {
      seedFlake(i, false);
      if (weatherKind === 'dust' || weatherKind === 'mist') { weatherPos[i * 3] = -18; weatherPos[i * 3 + 1] = Math.random() * 16; }
    }
  }
  weatherGeo.attributes.position.needsUpdate = true;
}
let worldNow = -1;
function applyWorld(n) {
  const wi = worldIndex(n);
  if (wi === worldNow) return;
  worldNow = wi;
  const w = WORLDS[wi];
  scene.background.setHex(w.sky);
  scene.fog.color.setHex(w.sky);
  document.body.style.background = '#' + w.sky.toString(16).padStart(6, '0');
  ground.material.color.setHex(w.ground);
  path.material.color.setHex(w.path);
  hills.forEach((hl, i) => hl.material.color.setHex(w.hills[i % 2]));
  cloudMat.color.setHex(w.cloud);
  hemi.groundColor.setHex(w.hemiGround);
  hemi.intensity = w.hemiI;
  sun.color.setHex(w.sun);
  sun.intensity = w.sunI;
  M.wallA.color.setHex(w.wallA);
  M.wallB.color.setHex(w.wallB);
  M.roof.color.setHex(w.roof);
  M.slab.color.setHex(w.slab);
  M.pillar.color.setHex(w.pillar);
  M.flag.color.setHex(w.flag);
  weatherKind = w.weather;
  weather.visible = !!w.weather;
  weatherMat.color.setHex({ embers: 0xff8a3a, dust: 0xd9a35a, leaves: 0x6fcf5a, mist: 0xb9a6e8, stars: 0xffffff }[w.weather] || 0xffffff);
  weatherMat.size = ({ snow: 5, leaves: 5, mist: 7, stars: 2.5 }[w.weather] || 3.5) * Math.min(2, window.devicePixelRatio || 1);
  weatherMat.opacity = w.weather === 'mist' ? 0.35 : 0.85;
  if (w.weather) for (let i = 0; i < WEATHER_N; i++) seedFlake(i, true);
  setSongKey(w.key);
  enemySet.setColors(w.enemy);
  enemySet.setExtras(w.enemy.extras.flatMap((k) => ACCESSORY[k]));
  bossSet.setColors(w.boss);
  bossSet.setExtras(w.boss.extras.flatMap((k) => ACCESSORY[k]));
}

// Accessory parts for the world creatures, in figure space (the face looks along -z).
const ACCESSORY = (() => {
  const eye = (x, y = 0.615) => new THREE.SphereGeometry(0.022, 8, 6).translate(x, y, -0.093);
  const eyes = (color, emissive) => [{ geo: eye(-0.038), color, emissive }, { geo: eye(0.038), color, emissive }];
  const horn = (side, size = 1) => new THREE.ConeGeometry(0.035 * size, 0.16 * size, 8).rotateZ(-side * 0.5).translate(side * 0.075, 0.74, 0);
  const ring = (y, r) => new THREE.TorusGeometry(r, 0.018, 6, 18).rotateX(Math.PI / 2).translate(0, y, 0);
  const icicle = (x, z, hgt) => new THREE.ConeGeometry(0.03, hgt, 6).translate(x, 0.72 + hgt / 2, z);
  return {
    eyes: eyes(0x2b2140),
    glowEyesCyan: eyes(0x9ff3ff, 0x3fd6ff),
    glowEyesGold: eyes(0xffe07a, 0xffb000),
    tusks: [
      { geo: new THREE.ConeGeometry(0.015, 0.06, 6).translate(-0.03, 0.57, -0.09), color: 0xfff6dc },
      { geo: new THREE.ConeGeometry(0.015, 0.06, 6).translate(0.03, 0.57, -0.09), color: 0xfff6dc },
    ],
    wraps: [
      { geo: ring(0.3, 0.127), color: 0xbfae8a },
      { geo: ring(0.42, 0.127), color: 0xbfae8a },
      { geo: ring(0.6, 0.103), color: 0xbfae8a },
    ],
    nemes: [{ geo: new THREE.BoxGeometry(0.27, 0.24, 0.2).translate(0, 0.58, 0.04), color: 0x2f5fcf }],
    band: [{ geo: ring(0.66, 0.11), color: 0xffd34d }],
    fur: [{ geo: new THREE.SphereGeometry(0.13, 12, 10).translate(0, 0.64, 0.02), color: 0xffffff }],
    icicles: [
      { geo: icicle(-0.06, 0, 0.12), color: 0xbfeaff, emissive: 0x3fb0ff },
      { geo: icicle(0, -0.03, 0.17), color: 0xbfeaff, emissive: 0x3fb0ff },
      { geo: icicle(0.06, 0, 0.12), color: 0xbfeaff, emissive: 0x3fb0ff },
    ],
    horns: [{ geo: horn(-1), color: 0xf2e6d0 }, { geo: horn(1), color: 0xf2e6d0 }],
    flame: [{ geo: new THREE.ConeGeometry(0.07, 0.2, 8).translate(0, 0.8, 0.02), color: 0xffa23a, emissive: 0xff5a00 }],
    glowEyesRed: eyes(0xff7070, 0xff0000),
    bigEyes: [
      { geo: new THREE.SphereGeometry(0.036, 10, 8).translate(-0.042, 0.62, -0.085), color: 0x111118 },
      { geo: new THREE.SphereGeometry(0.036, 10, 8).translate(0.042, 0.62, -0.085), color: 0x111118 },
    ],
    crown: [
      { geo: new THREE.CylinderGeometry(0.1, 0.09, 0.07, 10, 1, true).translate(0, 0.75, 0), color: 0xffbe2e },
      ...[-0.06, 0, 0.06].map((x) => ({ geo: new THREE.ConeGeometry(0.022, 0.07, 6).translate(x, 0.81, -0.06), color: 0xffbe2e })),
    ],
    eyepatch: [
      { geo: new THREE.BoxGeometry(0.045, 0.04, 0.02).translate(0.038, 0.615, -0.098), color: 0x111118 },
      { geo: new THREE.TorusGeometry(0.104, 0.008, 6, 20).rotateX(Math.PI / 2 - 0.25).translate(0, 0.635, 0), color: 0x111118 },
    ],
    tricorn: [
      { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.035, 3).translate(0, 0.74, 0), color: 0x1a1a22 },
      { geo: new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10).translate(0, 0.79, 0), color: 0x1a1a22 },
    ],
    beard: [{ geo: new THREE.BoxGeometry(0.15, 0.09, 0.07).translate(0, 0.53, -0.08), color: 0x1a1a22 }],
    collar: [{ geo: new THREE.CylinderGeometry(0.2, 0.11, 0.2, 12, 1, true).translate(0, 0.56, 0.03), color: 0x9b1c2c }],
    antenna: [
      { geo: new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6).translate(0, 0.8, 0), color: 0x2b2140 },
      { geo: new THREE.SphereGeometry(0.03, 8, 6).translate(0, 0.89, 0), color: 0xff5a5a, emissive: 0xff2020 },
    ],
    visor: [{ geo: new THREE.BoxGeometry(0.18, 0.045, 0.03).translate(0, 0.62, -0.1), color: 0xff5a5a, emissive: 0xff2020 }],
  };
})();

// ---------------------------------------------------------------- level state
let level = null; // decoded level
let cells = []; // cells[t][k] = { kind, v, x, y, obj, label, gone, anim }
let towerX = [];
let h = []; // floors cleared per tower
let power = 0;
let shownPower = 0;
let history = []; // [{ h, power, keys, at }]
let keys = 0;
let shieldArmed = false;
let scopeOn = false;
let bombMode = false;
let dangerFrames = [];
let armed = false;
let swing = 0;
let freeUndo = true;
let lastReward = 0;
let startP = 1;
let introAd = false;
let busy = false;
let state = 'home'; // home | play | won | lost
let board = new THREE.Group();
scene.add(board);
const hero = { x: 0, y: 0, z: 0.25, facing: Math.PI, mult: 1, stride: 0, phase: 0, flash: 0, alive: true, at: null, spin: 0 };
const heroLabel = makeCountLabel(0.95, '#ffffff');
const heroSword = new THREE.Group();
const heroSwordPivot = new THREE.Group();
heroSword.add(heroSwordPivot);
scene.add(heroSword);
for (const [g, m] of [[G.blade, M.blade], [G.guard, M.gold], [G.grip, M.grip]]) addMesh(g, m, 0, 0, 0, heroSwordPivot);
const heroBubble = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), M.bubble);
heroBubble.renderOrder = 3;
scene.add(heroBubble);
const keyCarry = new THREE.Group();
scene.add(keyCarry);
makeKey(keyCarry, 0.9).position.x = -0.25;
scene.add(heroLabel);
let startX = 0;
let hintFrame = null;
let hintTower = -1;
let confetti = [];

// Level 0 is the tutorial: first the "ad" plays it wrong, then the player plays it for real.
const INTRO = { s: 10, t: [['e7', 'e20'], ['e12']], sol: [0, 1, 0], r: 0.33 };
function levelData(n) {
  if (n === 0) return decodeLevel(INTRO, 0);
  if (n <= RAW_LEVELS.length) return decodeLevel(RAW_LEVELS[n - 1], n);
  return buildLevel(n);
}

const fmt = (v) => Math.round(v).toLocaleString('en-US');
function buzz(pattern) {
  try { if (save.vibrate !== false && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* no vibration */ }
}

function clearBoard() {
  scene.remove(board);
  board.traverse((o) => {
    if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); }
  });
  board = new THREE.Group();
  scene.add(board);
  hintFrame = null;
  hintTower = -1;
}

function addMesh(geo, m, x, y, z, parent = board) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

function buildBoard() {
  clearBoard();
  applyWorld(level.n);
  const nt = level.towers.length;
  const maxV = Math.max(1, ...level.towers.flat().filter((c) => c.v && (c.kind === 'enemy')).map((c) => c.v));
  // hero pedestal on the left, towers to the right of it
  const span = nt * GAP;
  startX = -span / 2 - 0.4;
  towerX = level.towers.map((_, i) => startX + 0.55 + GAP * (i + 0.5));
  // centre everything around x = 0
  const shift = -(startX - 0.8 + towerX[nt - 1] + RW / 2) / 2;
  startX += shift;
  towerX = towerX.map((x) => x + shift);
  addMesh(new THREE.CylinderGeometry(0.6, 0.75, 0.35, 16), M.pedestal, startX, 0.175, 0.2);

  cells = level.towers.map((tw, ti) => {
    const x = towerX[ti];
    const hasBoss = tw.some((c) => c.kind === 'boss');
    tw.forEach((_, k) => {
      const y = k * FH;
      addMesh(G.slab, M.slab, x, y + SLAB / 2, 0);
      addMesh(G.wall, k % 2 ? M.wallB : M.wallA, x, y + SLAB + FH / 2 - 0.09, -RD / 2);
      addMesh(G.pillar, M.pillar, x - RW / 2 - 0.02, y + SLAB + FH / 2 - 0.09, RD / 2 - 0.1);
      addMesh(G.pillar, M.pillar, x + RW / 2 + 0.02, y + SLAB + FH / 2 - 0.09, RD / 2 - 0.1);
      addMesh(G.pillar, M.pillar, x - RW / 2 - 0.02, y + SLAB + FH / 2 - 0.09, -RD / 2 + 0.05);
      addMesh(G.pillar, M.pillar, x + RW / 2 + 0.02, y + SLAB + FH / 2 - 0.09, -RD / 2 + 0.05);
      addMesh(G.windowLow, M.window, x - 0.2, y + SLAB + FH * 0.66, -RD / 2 + 0.11);
      addMesh(G.window, M.window, x - 0.2, y + SLAB + FH * 0.66 + 0.2, -RD / 2 + 0.11);
    });
    const top = tw.length * FH;
    addMesh(G.slab, M.slab, x, top + SLAB / 2, 0);
    addMesh(G.roof, hasBoss ? M.roofBoss : M.roof, x, top + SLAB + 0.85, -0.05);
    addMesh(G.pole, M.pole, x, top + SLAB + 2.1, -0.05);
    addMesh(G.flag, hasBoss ? M.roofBoss : M.flag, x + 0.3, top + SLAB + 2.48, -0.05);

    return tw.map((c, k) => {
      const cell = { ...c, x: x + 0.45, y: k * FH + SLAB, gone: false, anim: null, obj: null, label: null };
      if (c.kind === 'enemy' || c.kind === 'shield') cell.scale = 1.3 + 0.55 * Math.sqrt(Math.min(1, c.v / maxV));
      if (c.kind === 'shield') {
        // a big round shield held toward the hero
        const g = new THREE.Group();
        const disc = addMesh(G.shieldDisc, M.shield, 0, 0, 0, g);
        disc.rotation.x = Math.PI / 2;
        addMesh(G.shieldRim, M.gold, 0, 0, 0, g);
        addMesh(G.shieldBoss, M.gold, 0, 0, 0.04, g);
        g.rotation.y = -0.55;
        g.scale.setScalar(cell.scale / 1.5);
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'boss') { cell.scale = 2.25; cell.x = x + 0.3; }
      if (c.kind === 'princess') { cell.scale = 1.5; cell.x = x; }
      if (c.kind === 'sword') {
        const g = new THREE.Group();
        addMesh(G.blade, M.blade, 0, 0, 0, g);
        addMesh(G.guard, M.gold, 0, 0, 0, g);
        addMesh(G.grip, M.grip, 0, 0, 0, g);
        g.position.set(cell.x, cell.y + 0.45, 0.1);
        g.rotation.z = -0.5;
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'potion') {
        const g = new THREE.Group();
        addMesh(G.flask, M.flask, 0, 0, 0, g);
        addMesh(G.neck, M.flask, 0, 0, 0, g);
        addMesh(G.cork, M.cork, 0, 0, 0, g);
        g.scale.setScalar(1.25);
        g.position.set(cell.x, cell.y + 0.15, 0.1);
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'trap') {
        const g = new THREE.Group();
        addMesh(G.plate, M.plate, 0, 0, 0, g);
        for (let i = 0; i < 6; i++) addMesh(G.spike, M.spike, -0.38 + (i % 3) * 0.38, 0.04, i < 3 ? -0.2 : 0.22, g);
        g.position.set(x + 0.2, cell.y, 0.1);
        cell.x = x + 0.2;
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'curse') {
        const g = new THREE.Group();
        addMesh(G.orb, M.curse, 0, 0, 0, g);
        const halo = addMesh(G.halo, M.halo, 0, 0, 0, g);
        halo.rotation.x = Math.PI / 2.4;
        g.position.set(cell.x, cell.y + 0.6, 0.1);
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'key') {
        const g = new THREE.Group();
        makeKey(g, 1.9).position.x = -0.45;
        g.position.set(cell.x, cell.y + 0.6, 0.1);
        board.add(g);
        cell.obj = g;
      }
      if (c.kind === 'lock') {
        // a door hinged on its left edge, with a padlock in the middle
        cell.x = x;
        const dw = RW - 0.36;
        const g = new THREE.Group();
        const pivot = new THREE.Group();
        pivot.position.set(-dw / 2, 0, 0);
        g.add(pivot);
        addMesh(G.door, M.door, dw / 2, (FH - 0.36) / 2 + 0.02, 0, pivot);
        for (let i = 0; i < 4; i++) addMesh(G.plank, M.plank, dw / 2, 0.3 + i * 0.42, 0.07, pivot);
        const lock = new THREE.Group();
        addMesh(G.padlock, M.gold, 0, 0, 0, lock);
        addMesh(G.shackle, M.blade, 0, 0.16, 0, lock);
        lock.position.set(dw / 2, 0.95, 0.14);
        pivot.add(lock);
        g.position.set(x, cell.y, RD / 2 - 0.25);
        board.add(g);
        cell.obj = g;
        cell.pivot = pivot;
        cell.padlock = lock;
      }
      if (c.kind !== 'princess' && c.kind !== 'key' && c.kind !== 'lock') {
        const big = c.kind === 'boss';
        const lab = makeCountLabel(big ? 0.95 : 0.78);
        const headY = c.kind === 'enemy' || c.kind === 'shield' || big ? 0.78 * cell.scale + 0.3 : c.kind === 'trap' ? 0.95 : c.kind === 'curse' ? 1.35 : 1.25;
        lab.position.set(cell.x, cell.y + headY, 0.6);
        board.add(lab);
        cell.label = lab;
      }
      return cell;
    });
  });
  fitCamera();
}

function heroHome() {
  hero.x = startX;
  hero.y = 0.35;
  hero.facing = Math.PI;
  hero.at = null;
}

function syncBoard() {
  // visibility from h; labels coloured against current power
  cells.forEach((tw, ti) => tw.forEach((c, k) => {
    c.gone = k < h[ti];
    c.anim = null;
    c.taking = false;
    c.dx = 0;
    c.pulse = 0;
    if (c.obj) {
      c.obj.visible = !c.gone;
      c.obj.scale.setScalar(c.kind === 'potion' ? 1.25 : 1);
      c.obj.position.x = c.x;
      if (c.kind === 'trap' || c.kind === 'lock') c.obj.position.y = c.y;
      if (c.pivot) { c.pivot.rotation.y = 0; c.padlock.visible = true; c.padlock.scale.setScalar(1); }
      if (c.kind === 'sword') c.obj.rotation.z = -0.5;
    }
    if (c.label) c.label.visible = !c.gone;
  }));
  refreshLabels();
}

function refreshLabels() {
  updateScope();
  for (const tw of cells) for (const c of tw) {
    if (!c.label || c.gone) continue;
    if (c.kind === 'enemy' || c.kind === 'boss') c.label.userData.set(fmt(c.v), c.v >= power ? '#ff6f5e' : '#7dffb0');
    else if (c.kind === 'shield') c.label.userData.set('2×' + fmt(c.v), 2 * c.v >= power ? '#ff6f5e' : '#7dffb0');
    else if (c.kind === 'sword') c.label.userData.set('+' + fmt(swordValue(c)), '#7dffb0');
    else if (c.kind === 'potion') c.label.userData.set('x' + potionMult(), '#d4b8ff');
    else if (c.kind === 'trap') c.label.userData.set('-' + fmt(trapValue(c)), '#ffb766');
    else if (c.kind === 'curse') c.label.userData.set('-50%', '#e0b0ff');
  }
}

// ---------------------------------------------------------------- camera fit
let view = { minX: -5, maxX: 5, minY: 0, maxY: 10 };
function fitCamera() {
  if (!level) return;
  const tallest = Math.max(...level.towers.map((tw) => tw.length));
  view = {
    minX: startX - 0.85,
    maxX: towerX[towerX.length - 1] + RW / 2 + 0.3,
    minY: -0.6,
    maxY: tallest * FH + SLAB + 2.9,
  };
  resize();
}

const camBase = { x: 0, y: 0 };
let shake = 0;
let timeScale = 1;
function resize() {
  const w = window.innerWidth;
  const hgt = window.innerHeight;
  renderer.setSize(w, hgt, false);
  const top = 118;
  const bottom = 158;
  const usable = Math.max(100, hgt - top - bottom);
  let ww = view.maxX - view.minX;
  let wh = view.maxY - view.minY;
  ww = Math.max(ww, 7);
  wh = Math.max(wh, 9);
  const upp = Math.max(ww / (w * 0.96), wh / usable);
  const cx = (view.minX + view.maxX) / 2;
  // anchor the towers' feet just above the tip line; spare room goes to the sky
  const cy = view.minY + (hgt / 2 - bottom) * upp;
  camera.left = (-w / 2) * upp;
  camera.right = (w / 2) * upp;
  camera.top = (hgt / 2) * upp;
  camera.bottom = (-hgt / 2) * upp;
  camBase.x = cx;
  camBase.y = cy;
  camera.position.set(cx, cy + 7, 40);
  camera.lookAt(cx, cy, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- tweens
let speed = 1;
const tweens = [];
function tween(dur, fn) {
  return new Promise((done) => tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, done }));
}
const wait = (s) => tween(s, () => {});
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ---------------------------------------------------------------- popups
const v3 = new THREE.Vector3();
function toScreen(x, y, z = 0.5) {
  v3.set(x, y, z).project(camera);
  return [((v3.x + 1) / 2) * window.innerWidth, ((1 - v3.y) / 2) * window.innerHeight];
}
function popup(text, x, y, tone = 'good') {
  const [sx, sy] = toScreen(x, y);
  const el = document.createElement('div');
  el.className = 'pop ' + tone;
  el.textContent = text;
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function spark(x, y) {
  burst(x, y, [0xffffff, 0xffe07a, 0xffbe2e], 12, 2.5);
}

// The music turns tense, and a banner slides in, once the boss can be reached.
function updateSong() {
  if (state !== 'play' || !level) return setSong('main');
  const near = cells.some((tw, i) => h[i] < tw.length && tw[h[i]].kind === 'boss');
  setSong(near ? 'boss' : 'main');
  if (near && !bannerShown) {
    bannerShown = true;
    showBanner('BOSS', 'rgba(109, 63, 184, 0.85)');
  }
}
let bannerTimer = 0;
function showBanner(text, color) {
  const el = $('boss-banner');
  el.textContent = text;
  el.style.setProperty('--band', color);
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.hidden = true), 1150);
}

function burst(x, y, colors, n = 26, up = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G.frame, new THREE.MeshBasicMaterial({ color: colors[i % colors.length] }));
    m.scale.set(0.12, 0.12, 0.03);
    m.position.set(x, y, 0.8);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 5, up * (0.5 + Math.random()), (Math.random() - 0.2) * 2);
    m.userData.life = 1.2 + Math.random() * 0.6;
    scene.add(m);
    confetti.push(m);
  }
}

// ---------------------------------------------------------------- level flow
let gen = 0;
let aids = 0;
let aidsLevel = 0;
let bannerShown = false;
let preset = null;
function startLevel(n, data = null) {
  preset = data;
  if (trialSkin) {
    const key = data ? 'daily' : n;
    if (trialLevel === null) trialLevel = key;
    else if (trialLevel !== key) { trialSkin = null; trialLevel = null; applySkin(); }
  }
  const aidKey = data ? 'daily' : n;
  if (aidKey !== aidsLevel) { aids = 0; aidsLevel = aidKey; }
  freeUndo = true;
  shieldArmed = false;
  scopeOn = false;
  bombMode = false;
  dangerFrames = [];
  bannerShown = false;
  timeScale = 1;
  gen++;
  tweens.length = 0;
  for (const m of confetti) { scene.remove(m); m.material.dispose(); }
  confetti = [];
  level = data ? { ...data, towers: data.towers.map((tw) => tw.map((c) => ({ ...c }))) } : levelData(n);
  h = level.towers.map(() => 0);
  power = startPower(level.start, save.up.power);
  startP = power;
  shownPower = power;
  history = [];
  keys = 0;
  armed = false;
  hero.alive = true;
  hero.spin = 0;
  hero.flash = 0;
  hero.mult = 1;
  busy = false;
  buildBoard();
  heroHome();
  syncBoard();
  state = 'play';
  showScreen(null);
  $('hud').hidden = false;
  $('fail').hidden = true;
  introAd = false;
  $('ad-ribbon').hidden = true;
  $('finger').hidden = true;
  $('hud-level').textContent = n === 0 ? t('intro.real') : t('level', { n });
  updateHints();
  updateBoosts();
  $('boosts').hidden = n < 4;
  if (n > 1 && (n - 1) % 25 === 0) {
    const w = worldOf(n);
    showBanner(t('world.' + w.id), 'rgba(43, 33, 64, 0.8)');
    bannerShown = false;
  }
  updateSong();
  const taunts = t('taunts');
  $('taunt').textContent = taunts[(n * 7) % taunts.length].replace('{n}', n);
  const kinds = new Set(level.towers.flat().map((c) => c.kind));
  save.seen = save.seen || {};
  const fresh = ['key', 'curse', 'shield'].find((k) => kinds.has(k) && !save.seen[k]);
  if (fresh) { save.seen[fresh] = 1; writeSave(save); }
  setTip(n <= 1 && !save.stars[1] ? t('tip.first') : fresh ? t('tip.' + fresh) : '', fresh ? 5000 : 0);
  updateCoins();
  track('level_start', { level: n });
}

let tipTimer = 0;
function setTip(text, ms = 0) {
  const el = $('tip');
  el.textContent = text;
  el.hidden = !text;
  clearTimeout(tipTimer);
  if (text && ms) tipTimer = setTimeout(() => (el.hidden = true), ms);
}

function remainingLevel() {
  return { start: power, keys, towers: level.towers.map((tw, i) => tw.slice(h[i])) };
}

function roomFrame(ti, material) {
  const k = h[ti];
  const x = towerX[ti];
  const y = k * FH + SLAB;
  const g = new THREE.Group();
  const bar = (w, hh, px, py) => addMesh(G.frame, material, px, py, 0, g).scale.set(w, hh, 0.08);
  bar(RW + 0.3, 0.12, 0, 0.02);
  bar(RW + 0.3, 0.12, 0, FH - 0.2);
  bar(0.12, FH - 0.2, -RW / 2 - 0.1, FH / 2 - 0.09);
  bar(0.12, FH - 0.2, RW / 2 + 0.1, FH / 2 - 0.09);
  g.position.set(x, y, RD / 2 + 0.05);
  g.traverse((o) => (o.castShadow = false));
  board.add(g);
  return g;
}

// Scope booster: red frames on every move that kills or leaves no way to win.
function updateScope() {
  for (const f of dangerFrames) board.remove(f);
  dangerFrames = [];
  if (!scopeOn || state !== 'play' || busy) return;
  level.towers.forEach((tw, t) => {
    if (h[t] >= tw.length) return;
    const cell = tw[h[t]];
    const ns = step(power, keys, cell);
    if (!ns) return;
    let bad = ns.p < 0;
    if (!bad && cell.kind !== 'boss' && cell.kind !== 'princess') {
      const after = { start: ns.p, keys: ns.k, towers: level.towers.map((x, i) => x.slice(h[i] + (i === t ? 1 : 0))) };
      const left = after.towers.some((x) => x.length);
      if (left) bad = solve(after).wins === 0;
    }
    if (bad) dangerFrames.push(roomFrame(t, M.danger));
  });
}

function setHint(ti) {
  if (hintFrame) { board.remove(hintFrame); hintFrame = null; }
  hintTower = ti;
  if (ti < 0) return;
  const k = h[ti];
  const x = towerX[ti];
  const y = k * FH + SLAB;
  const g = new THREE.Group();
  const bar = (w, hh, px, py) => addMesh(G.frame, M.hint, px, py, 0, g).scale.set(w, hh, 0.08);
  bar(RW + 0.3, 0.12, 0, 0.02);
  bar(RW + 0.3, 0.12, 0, FH - 0.2);
  bar(0.12, FH - 0.2, -RW / 2 - 0.1, FH / 2 - 0.09);
  bar(0.12, FH - 0.2, RW / 2 + 0.1, FH / 2 - 0.09);
  g.position.set(x, y, RD / 2 + 0.05);
  g.traverse((o) => (o.castShadow = false));
  board.add(g);
  hintFrame = g;
}

function hint() {
  if (state !== 'play' || busy) return;
  sfx.tap();
  if (save.hints <= 0) { setTip(t('tip.nohints'), 2200); openShop('hints', 'play'); return; }
  const sol = solve(remainingLevel());
  if (!sol.wins) { setTip(t('tip.stuck'), 2600); return; }
  if (hintTower === sol.path[0]) return;
  save.hints--;
  writeSave(save);
  updateHints();
  setHint(sol.path[0]);
  setTip(t('tip.hint'), 1800);
  aids++;
  track('hint', { level: level.n });
}

// ---------------------------------------------------------------- boosters
const BOOSTS = ['shield', 'scope', 'bomb'];
const BOOST_ICON = { shield: '🛡️', scope: '🔭', bomb: '💣' };
function updateBoosts() {
  save.boost = save.boost || { shield: 1, scope: 1, bomb: 1 };
  for (const b of BOOSTS) {
    const n = save.boost[b] || 0;
    $('bc-' + b).textContent = n > 0 ? String(n) : '+';
    const on = (b === 'shield' && shieldArmed) || (b === 'scope' && scopeOn) || (b === 'bomb' && bombMode);
    $('boost-' + b).classList.toggle('on', on);
  }
}
function useBoost(b) {
  if (state !== 'play' || busy || introAd) return;
  save.boost = save.boost || { shield: 1, scope: 1, bomb: 1 };
  if (b === 'bomb' && bombMode) { bombMode = false; setTip(''); updateBoosts(); return; }
  if ((b === 'shield' && shieldArmed) || (b === 'scope' && scopeOn)) return;
  if (!(save.boost[b] > 0)) { setTip(t('boost.none'), 2000); openShop('power', 'play'); return; }
  sfx.buy();
  if (b === 'bomb') {
    bombMode = true;
    setTip(t('boost.bombPick'));
    updateBoosts();
    return;
  }
  save.boost[b]--;
  aids++;
  writeSave(save);
  track('boost', { id: b, level: level.n });
  if (b === 'shield') { shieldArmed = true; setTip(t('boost.shieldOn'), 2200); }
  if (b === 'scope') { scopeOn = true; updateScope(); setTip(t('boost.scopeOn'), 2600); }
  updateBoosts();
}
async function bombTower(ti) {
  const c = cells[ti][h[ti]];
  if (['boss', 'princess', 'key', 'lock'].includes(c.kind)) { setTip(t('boost.bombNo'), 2200); sfx.gateBad(); return; }
  bombMode = false;
  save.boost.bomb--;
  aids++;
  writeSave(save);
  track('boost', { id: 'bomb', level: level.n });
  history.push({ h: h.slice(), power, keys, armed, at: hero.at });
  busy = true;
  const my = gen;
  setTip('');
  setHint(-1);
  sfx.bigBoom();
  buzz([20, 20, 40]);
  shake = 0.9;
  burst(towerX[ti], c.y + 1, [0xff8a3a, 0xffd34d, 0x2b2140, 0xffffff], 36, 4.5);
  if (c.label) c.label.visible = false;
  if (c.kind === 'enemy' || c.kind === 'shield') c.anim = { kind: 'fly', t: 0 };
  else if (c.obj) c.obj.visible = false;
  await wait(0.5);
  if (my !== gen) return;
  c.gone = true;
  h[ti]++;
  busy = false;
  updateBoosts();
  refreshLabels();
  updateSong();
}

async function move(ti) {
  if (state !== 'play' || busy || !hero.alive) return;
  if (h[ti] >= cells[ti].length) return;
  if (bombMode) { bombTower(ti); return; }
  const door = cells[ti][h[ti]];
  if (door.kind === 'lock' && keys === 0) {
    // not allowed: rattle the door
    sfx.gateBad();
    setTip(t('tip.locked'), 1800);
    popup(t('locked'), door.x, door.y + 1.9, 'bad');
    const g = door.obj;
    tween(0.35, (q) => { g.position.x = door.x + Math.sin(q * Math.PI * 6) * 0.07 * (1 - q); });
    return;
  }
  busy = true;
  const my = gen;
  setTip('');
  setHint(-1);
  for (const f of dangerFrames) board.remove(f);
  dangerFrames = [];
  unlockAudio();
  const k = h[ti];
  const c = cells[ti][k];
  history.push({ h: h.slice(), power, keys, armed, at: hero.at });

  // get there: hop across at the hero's height (or drop down), then climb floor by floor
  const fromX = hero.x;
  const fromY = hero.y;
  const toX = towerX[ti] - 0.6;
  const toY = c.y;
  hero.facing = toX >= fromX ? -Math.PI / 2 : Math.PI / 2;
  sfx.tap();
  const sameTower = hero.at && hero.at.ti === ti;
  const acrossY = toY > fromY ? Math.max(SLAB, fromY) : toY;
  if (!sameTower || toY <= fromY) {
    const dx = Math.abs(toX - fromX);
    const lift = 0.7 + Math.min(1, dx / 6) * 0.6;
    await tween(0.3 + Math.min(0.2, dx * 0.03), (q) => {
      const e = ease(q);
      hero.x = fromX + (toX - fromX) * e;
      hero.y = fromY + (acrossY - fromY) * e + Math.sin(Math.PI * q) * lift;
      hero.stride = 1;
    });
    if (my !== gen) return;
  } else {
    await tween(0.12, (q) => { hero.x = fromX + (toX - fromX) * q; hero.stride = 1; });
  }
  // climb
  let y = hero.y;
  hero.facing = Math.PI;
  while (y < toY - 0.05) {
    const y0 = y;
    const y1 = Math.min(toY, y + FH);
    sfx.tick();
    await tween(0.17, (q) => { hero.y = y0 + (y1 - y0) * ease(q) + Math.sin(Math.PI * q) * 0.35; hero.stride = 1; });
    if (my !== gen) return;
    y = y1;
  }
  hero.y = toY;
  hero.stride = 0;
  if (my !== gen) return;
  hero.at = { ti, k };
  hero.facing = -Math.PI / 2;
  const np = apply(power, c);
  const fight = c.kind === 'enemy' || c.kind === 'boss' || c.kind === 'shield';

  if (c.kind === 'boss') {
    // the boss gets a proper fight: a roar, three clashes, then slow motion on the last blow
    sfx.roar();
    shake = 0.9;
    await tween(0.55, (q) => { c.pulse = Math.sin(Math.PI * q) * 0.2; });
    if (my !== gen) return;
    for (let i = 0; i < 3; i++) {
      await tween(0.15, (q) => { const w = Math.sin(Math.PI * q); hero.x = toX + w * 0.5; c.dx = -w * 0.4; swing = w; });
      if (my !== gen) return;
      sfx.hit();
      shake = 0.45;
      spark(toX + 0.6, c.y + 0.9);
      await wait(0.06);
    }
    if (np < 0) return lose(c, toX);
    timeScale = 0.3;
    await tween(0.22, (q) => { hero.x = toX + Math.sin(Math.PI * q) * 0.75; swing = Math.sin(Math.PI * q); });
    if (my !== gen) return;
    sfx.bigBoom();
    buzz([40, 30, 60]);
    shake = 1.2;
    burst(c.x - 0.2, c.y + 1.1, [0xffbe2e, 0xffffff, 0x8a5cf0, 0xe8453c], 40, 5);
    c.anim = { kind: 'flyBig', t: 0 };
    save.stats.bosses = (save.stats.bosses || 0) + 1;
    if (c.label) c.label.visible = false;
    await wait(0.3);
    timeScale = 1;
    popup('+' + fmt(c.v), c.x, c.y + 1.8, 'gold');
    await setPower(np, 0.5);
    sfx.coin();
  } else if (fight) {
    // lunge
    await tween(0.16, (q) => { hero.x = toX + Math.sin(Math.PI * q) * 0.45; swing = Math.sin(Math.PI * q); });
    sfx.hit();
    buzz(15);
    if (np < 0) return lose(c, toX);
    spark(toX + 0.55, c.y + 0.75);
    if (c.kind === 'shield') save.stats.shields = (save.stats.shields || 0) + 1;
    shake = Math.max(shake, 0.3);
    c.anim = { kind: 'fly', t: 0 };
    sfx.boom();
    if (c.label) c.label.visible = false;
    popup('+' + fmt(c.v), c.x, c.y + 1.4, 'good');
    await setPower(np, 0.4);
    sfx.coin();
  } else if (c.kind === 'sword') {
    c.taking = true;
    await tween(0.25, (q) => { c.obj.position.x = c.x + (toX - c.x) * q; c.obj.position.y = c.y + 0.45 + Math.sin(Math.PI * q) * 0.5; c.obj.rotation.z = -0.5 - q * 6; });
    c.obj.visible = false;
    c.label.visible = false;
    armed = true;
    sfx.buy();
    popup('+' + fmt(swordValue(c)), toX, c.y + 1.6, 'good');
    await setPower(np, 0.35);
  } else if (c.kind === 'potion') {
    c.taking = true;
    await tween(0.25, (q) => { c.obj.position.x = c.x + (toX + 0.2 - c.x) * q; c.obj.scale.setScalar(1.25 * (1 - q * 0.8)); });
    c.obj.visible = false;
    c.label.visible = false;
    sfx.gateGood && sfx.gateGood();
    popup('x' + potionMult(), toX, c.y + 1.6, 'purple');
    burst(toX, c.y + 1, [0xb99cff, 0xffffff, 0xd4b8ff], 16, 3);
    await setPower(np, 0.45);
  } else if (c.kind === 'trap') {
    await tween(0.2, (q) => { hero.x = toX + (c.x - toX) * q; hero.stride = 1; });
    hero.stride = 0;
    c.obj.position.y = c.y + 0.12;
    hero.flash = 1;
    sfx.gateBad ? sfx.gateBad() : sfx.hit();
    popup('-' + fmt(trapValue(c)), c.x, c.y + 1.6, 'bad');
    if (np < 0) return lose(c, c.x);
    await setPower(np, 0.35);
    await tween(0.18, (q) => { c.obj.scale.setScalar(1 - q); });
    c.obj.visible = false;
    c.label.visible = false;
  } else if (c.kind === 'curse') {
    c.taking = true;
    await tween(0.25, (q) => { c.obj.position.x = c.x + (toX - c.x) * q; c.obj.scale.setScalar(1 - q * 0.6); });
    c.obj.visible = false;
    c.label.visible = false;
    hero.flash = 1;
    sfx.gateBad();
    shake = 0.4;
    burst(toX, c.y + 1, [0x9b3cff, 0x4a1f7a, 0x2b2140], 18, 2.5);
    popup('-50%', toX, c.y + 1.7, 'purple');
    if (np < 0) return lose(c, toX);
    await setPower(np, 0.45);
  } else if (c.kind === 'key') {
    c.taking = true;
    await tween(0.3, (q) => { c.obj.position.x = c.x + (toX - c.x) * q; c.obj.position.y = c.y + 0.6 + Math.sin(Math.PI * q) * 0.6; });
    c.obj.visible = false;
    keys++;
    sfx.buy();
    popup(t('key.got'), toX, c.y + 1.7, 'gold');
    await wait(0.2);
  } else if (c.kind === 'lock') {
    keys--;
    save.stats.doors = (save.stats.doors || 0) + 1;
    sfx.coin();
    await tween(0.2, (q) => { c.padlock.scale.setScalar(1 + q * 0.4); c.padlock.position.y = 0.95 + q * 0.3; });
    c.padlock.visible = false;
    c.padlock.position.y = 0.95;
    sfx.gateGood();
    await tween(0.35, (q) => { c.pivot.rotation.y = -ease(q) * 1.9; });
    c.obj.visible = false;
  } else if (c.kind === 'princess') {
    sfx.win();
    burst(c.x, c.y + 1.2, [0xff7eb6, 0xffffff, 0xff4f8f], 20, 3);
    popup('♥', c.x, c.y + 1.5, 'bad');
    await wait(0.4);
  }
  if (my !== gen) return;
  c.gone = true;
  power = np;
  h[ti]++;
  refreshLabels();
  // step to the middle of the cleared room
  const midX = towerX[ti] - 0.1;
  if (c.kind !== 'princess') await tween(0.18, (q) => { hero.x = hero.x + (midX - hero.x) * q; hero.stride = 1; });
  hero.stride = 0;
  hero.facing = Math.PI;
  if (c.kind === 'boss') {
    // the boss is down: the level is over
    await bossFinale(ti);
    if (my !== gen) return;
    busy = false;
    setSong('main');
    win();
    return;
  }
  busy = false;
  if (h.every((v, i) => v >= cells[i].length)) { setSong('main'); win(); }
  else updateSong();
}

// Everyone left runs away and the princess (if any) is free.
async function bossFinale(ti) {
  let princess = null;
  cells.forEach((tw) => tw.forEach((c) => {
    if (c.gone) return;
    if (c.kind === 'princess') { princess = c; return; }
    if (c.label) c.label.visible = false;
    if (c.kind === 'enemy' || c.kind === 'shield') c.anim = { kind: 'fly', t: -Math.random() * 0.4 };
    else if (c.obj) c.obj.visible = false;
  }));
  if (princess) {
    await wait(0.25);
    sfx.win();
    burst(princess.x, princess.y + 1.2, [0xff7eb6, 0xffffff, 0xff4f8f], 26, 3.5);
    popup('♥', princess.x, princess.y + 1.6, 'bad');
    await tween(0.5, (q) => { princess.pulse = Math.sin(Math.PI * q) * 0.25; });
    princess.pulse = 0;
  } else {
    await wait(0.45);
  }
  cells.forEach((tw, i) => (h[i] = tw.length));
}

function setPower(np, dur) {
  const from = shownPower;
  return tween(dur, (q) => { shownPower = from + (np - from) * ease(q); });
}

async function lose(c, atX) {
  const my = gen;
  if (shieldArmed) {
    // the shield booster takes the hit: bounce back to before the move
    shieldArmed = false;
    sfx.boom();
    shake = 0.6;
    burst(hero.x, hero.y + 0.8, [0x7fd3ff, 0xffffff, 0x2f7cf6], 24, 3);
    popup(t('boost.saved'), hero.x, hero.y + 1.8, 'good');
    await wait(0.5);
    if (my !== gen) return;
    undo(true);
    updateBoosts();
    return;
  }
  hero.alive = false;
  buzz(90);
  state = 'lost';
  sfx.lose();
  if (c.kind === 'boss') {
    // the boss winds up and slams
    await tween(0.3, (q) => { c.pulse = q * 0.15; c.dx = q * 0.3; });
    await tween(0.12, (q) => { c.dx = 0.3 - q * 1.1; });
    sfx.bigBoom();
    shake = 1.1;
    spark(atX + 0.3, c.y + 0.8);
    c.pulse = 0;
  }
  if (c.kind === 'enemy' || c.kind === 'boss' || c.kind === 'shield') {
    popup(c.kind === 'shield' ? fmt(power) + ' < 2×' + fmt(c.v) : fmt(power) + ' < ' + fmt(c.v), atX, c.y + 1.8, 'bad');
    const x0 = hero.x;
    const y0 = hero.y;
    await tween(0.7, (q) => { hero.x = x0 - q * 1.6; hero.y = y0 + Math.sin(Math.PI * q) * 1.2 - q * 0.2; hero.spin = q * 9; hero.mult = 1 - q * 0.35; });
  } else {
    await tween(0.5, (q) => { hero.mult = 1 - q * 0.6; hero.spin = q * 5; });
  }
  if (my !== gen) return;
  $('fail').hidden = false;
  shownPower = 0;
  track('level_fail', { level: level.n, kind: c.kind });
  await wait(1.1);
  if (my !== gen) return;
  if (introAd) {
    introAd = false;
    $('ad-ribbon').hidden = true;
    showScreen('screen-intro');
    busy = false;
    return;
  }
  $('btn-undo').textContent = freeUndo ? t('undo.free') : t('ad.revive');
  $('btn-undo').className = 'btn ' + (freeUndo ? 'btn-gold' : 'btn-ad');
  $('lost-line').textContent = t(c.kind === 'trap' ? 'lost.trap' : c.kind === 'curse' ? 'lost.curse' : c.kind === 'shield' ? 'lost.shield' : 'lost.enemy');
  showScreen('screen-lost');
  busy = false;
}

async function win() {
  const my = gen;
  state = 'won';
  buzz([30, 40, 30]);
  // victory dance: three hops and a spin
  const baseY = hero.y;
  hero.facing = Math.PI;
  tween(1.1, (q) => {
    hero.y = baseY + Math.abs(Math.sin(q * Math.PI * 3)) * 0.55;
    hero.spin = q < 0.66 ? 0 : ease((q - 0.66) / 0.34) * Math.PI * 2;
    hero.stride = q < 0.66 ? 1 : 0;
    swing = q < 0.66 ? Math.abs(Math.sin(q * Math.PI * 3)) : 0;
  }).then(() => { hero.spin = 0; hero.stride = 0; hero.y = baseY; });
  sfx.win();
  burst(hero.x, hero.y + 1.4, [0xffbe2e, 0x2f7cf6, 0xe8453c, 0x2eb872, 0xffffff], 60, 6);
  const today = dayKey(new Date());
  const firstDaily = level.daily && save.dtLast !== today;
  const reward = Math.round((level.daily ? (firstDaily ? 100 : 0) : coinReward(level.n, save.up.income)) * (EVENT.id === 'coins2' ? 2 : 1) * remote.num('coin_mult', 1, 0.2, 5));
  if (!level.daily && level.n > 0) {
    if (!save.week || save.week.w !== EVENT.week) save.week = { w: EVENT.week, wins: 0, claimed: false };
    save.week.wins++;
  }
  const stars = aids === 0 ? 3 : aids <= 2 ? 2 : 1;
  if (level.daily) {
    if (firstDaily) {
      save.dtStreak = save.dtLast === dayKey(new Date(Date.now() - 864e5)) ? (save.dtStreak || 0) + 1 : 1;
      save.dtLast = today;
      save.hints += 1;
      save.stats.dailyTowers = (save.stats.dailyTowers || 0) + 1;
      updateHints();
    }
  } else save.stars[level.n] = Math.max(save.stars[level.n] || 0, stars);
  const S = save.stats;
  S.wins = (S.wins || 0) + 1;
  S.coins = (S.coins || 0) + reward;
  if (stars === 3) S.perfect = (S.perfect || 0) + 1;
  if (level.towers.flat().some((c) => c.kind === 'princess')) S.princesses = (S.princesses || 0) + 1;
  save.coins += reward;
  if (!level.daily) save.level = Math.max(save.level, level.n + 1);
  writeSave(save);
  if (!level.daily && level.n > 0) leaderboard.submit('level', save.level - 1);
  if (level.daily && firstDaily) leaderboard.submit('daily', save.dtStreak);
  lastShare = { title: level.daily ? t('dt.won') : t('sh.win', { n: level.n }), line: t('sh.dare') };
  track('level_win', { level: level.n, moves: history.length, stars });
  if (level.n === 3 && !save.notifAsked) { save.notifAsked = 1; writeSave(save); askNotificationPermission(); }
  await wait(1.1);
  if (my !== gen) return;
  $('won-title').textContent = level.daily ? t('dt.won') : level.n === 0 ? t('intro.won') : t('won.title', { n: level.n });
  $('won-line').textContent = level.daily ? (firstDaily ? t('dt.streak', { n: save.dtStreak }) + ' 💡+1' : t('dt.again'))
    : t(level.towers.flat().some((c) => c.kind === 'princess') ? 'won.princess' : 'won.line');
  $('btn-next').textContent = level.daily ? t('home') : t('next');
  $('won-coins').textContent = '+' + reward;
  lastReward = reward;
  $('btn-double').hidden = !reward;
  showTrialOffer();
  $('stars-note').textContent = t(stars === 3 ? 'stars.3' : 'stars.less');
  const starEls = [...document.querySelectorAll('#stars .star')];
  starEls.forEach((el) => el.classList.remove('on'));
  updateCoins();
  showScreen('screen-won');
  if (!level.daily && level.n > 0) {
    account.onRunEnd();
    setTimeout(() => { if (state === 'won' && my === gen && !account.maybeAsk()) review.onWin(stars === 3 ? 'big' : 'win'); }, 2200);
  }
  for (let i = 0; i < stars; i++) {
    await wait(0.28);
    if (my !== gen) return;
    starEls[i].classList.add('on');
    sfx.tile(i * 2);
  }
}

// After a level played in a borrowed look: offer to keep it.
function showTrialOffer() {
  const box = $('trial-offer');
  const k = trialSkin && SKINS.find((x) => x.id === trialSkin);
  if (!k || save.skins.includes(k.id)) { box.hidden = true; return; }
  box.hidden = false;
  $('trial-swatch').style.cssText = `--b:${hex(k.body)};--h:${hex(k.head)};--c:${hex(k.helmet)}`;
  $('trial-name').textContent = t('skin.' + k.id);
  const b = $('btn-trial-buy');
  const short = k.cost - save.coins;
  b.disabled = short > 0;
  b.innerHTML = `<span class="coin-icon" aria-hidden="true"></span>${fmt(k.cost)}`;
  $('trial-line').textContent = short > 0 ? t('try.short', { n: fmt(short) }) : t('try.keep');
  b.onclick = () => {
    if (save.coins < k.cost) return;
    save.coins -= k.cost;
    save.skins.push(k.id);
    save.skin = k.id;
    trialSkin = null;
    trialLevel = null;
    writeSave(save);
    sfx.buy();
    track('purchase', { id: 'skin-' + k.id, cost: k.cost, from: 'trial' });
    updateCoins();
    box.hidden = true;
  };
}

function undo(fromShield = false) {
  const last = history.pop();
  if (!last) return;
  h = last.h;
  power = last.power;
  keys = last.keys || 0;
  armed = !!last.armed;
  shownPower = power;
  hero.alive = true;
  hero.spin = 0;
  hero.mult = 1;
  if (last.at) {
    hero.x = towerX[last.at.ti] - 0.1;
    hero.y = cells[last.at.ti][last.at.k].y;
    hero.at = last.at;
    hero.facing = Math.PI;
  } else heroHome();
  syncBoard();
  $('fail').hidden = true;
  state = 'play';
  busy = false;
  showScreen(null);
  aids++;
  updateSong();
  track('undo', { level: level.n });
}

// ---------------------------------------------------------------- UI
const screens = ['screen-home', 'screen-how', 'screen-won', 'screen-lost', 'screen-shop', 'screen-map', 'screen-intro', 'screen-daily', 'screen-treasure', 'screen-ach', 'screen-settings'];
function showScreen(id) {
  for (const s of screens) $(s).hidden = s !== id;
}
function updateCoins() {
  for (const id of ['hud-coins', 'home-coins', 'shop-coins']) $(id).textContent = fmt(save.coins);
}
function updateHints() {
  $('hint-count').textContent = save.hints > 0 ? String(save.hints) : '+';
}

// ---------------------------------------------------------------- shop
let shopTab = 'power';
let shopFrom = 'home';
function openShop(tab, from) {
  shopTab = tab || shopTab;
  shopFrom = from;
  renderShop();
  showScreen('screen-shop');
  track('shop_open', { from, tab: shopTab });
}
function closeShop() {
  sfx.tap();
  if (shopFrom === 'won') showScreen('screen-won');
  else if (shopFrom === 'play') showScreen(null);
  else goHome();
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function row(title, lines, icon) {
  const li = document.createElement('li');
  li.className = 'row';
  li.innerHTML = `${icon}<div class="row-text"><h3>${title}</h3>${lines}</div>`;
  return li;
}
function buyButton(id, cost, label, onBuy) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-buy btn-gold';
  btn.id = id;
  btn.type = 'button';
  btn.innerHTML = `<span class="coin-icon" aria-hidden="true"></span>${fmt(cost)}`;
  btn.disabled = save.coins < cost;
  btn.setAttribute('aria-label', t('buyFor', { name: label, cost }));
  btn.addEventListener('click', () => {
    if (save.coins < cost) return;
    save.coins -= cost;
    onBuy();
    writeSave(save);
    unlockAudio();
    sfx.buy();
    track('purchase', { id, cost });
    updateCoins();
    updateHints();
    renderShop();
  });
  return btn;
}
function stateButton(id, text, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-buy btn-plain';
  btn.id = id;
  btn.type = 'button';
  btn.textContent = text;
  btn.disabled = disabled;
  if (onClick) btn.addEventListener('click', () => { onClick(); writeSave(save); sfx.tap(); renderShop(); });
  return btn;
}
function renderShop() {
  const list = $('shop-list');
  list.innerHTML = '';
  for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === shopTab));
  updateCoins();
  if (shopTab === 'power') {
    for (const [key, up] of Object.entries(UPGRADES)) {
      const lvl = save.up[key];
      const maxed = lvl >= up.max;
      const li = row(`${t('up.' + key)} <span class="lvl-tag">${t('lv', { n: lvl })}</span>`,
        `<p>${t(`up.${key}.desc`)}</p><p class="next">${maxed ? t('up.maxed', { a: up.pct * lvl }) : lvl ? t('up.now', { a: up.pct * lvl, b: up.pct * (lvl + 1) }) : t('up.next', { p: up.pct })}</p>`,
        `<span class="icon-tile tile-${key}" aria-hidden="true">${key === 'power' ? '+%' : '$'}</span>`);
      li.appendChild(maxed ? stateButton('up-' + key, t('max'), true) : buyButton('up-' + key, up.cost(lvl), t('up.' + key), () => { save.up[key]++; }));
      list.appendChild(li);
    }
    save.boost = save.boost || { shield: 1, scope: 1, bomb: 1 };
    for (const [b, cost] of [['shield', 80], ['scope', 60], ['bomb', 100]]) {
      const li = row(`${t('boost.' + b)} <span class="lvl-tag">×${save.boost[b] || 0}</span>`, `<p>${t('boost.' + b + '.d')}</p>`,
        `<span class="icon-tile tile-hint" aria-hidden="true">${BOOST_ICON[b]}</span>`);
      li.appendChild(buyButton('boost-buy-' + b, cost, t('boost.' + b), () => { save.boost[b] = (save.boost[b] || 0) + 1; updateBoosts(); }));
      list.appendChild(li);
    }
  } else if (shopTab === 'heroes') {
    for (const k of SKINS) {
      const owned = save.skins.includes(k.id);
      const name = t('skin.' + k.id);
      const icon = `<span class="swatch" aria-hidden="true" style="--b:${hex(k.body)};--h:${hex(k.head)};--c:${hex(k.helmet)}"></span>`;
      const li = row(name, `<p>${owned ? t(save.skin === k.id ? 'wearing' : 'owned') : t('skin.look')}</p>`, icon);
      if (save.skin === k.id) li.appendChild(stateButton('skin-' + k.id, t('on'), true));
      else if (owned) li.appendChild(stateButton('skin-' + k.id, t('wear'), false, () => { save.skin = k.id; applySkin(); }));
      else {
        const box = document.createElement('div');
        box.className = 'btn-stack';
        box.appendChild(buyButton('skin-' + k.id, k.cost, name, () => { save.skins.push(k.id); save.skin = k.id; trialSkin = null; applySkin(); }));
        if (trialSkin !== k.id) {
          const tryBtn = document.createElement('button');
          tryBtn.type = 'button';
          tryBtn.className = 'btn btn-ad btn-try';
          tryBtn.id = 'try-' + k.id;
          tryBtn.textContent = t('try');
          tryBtn.addEventListener('click', async () => {
            if (!(await ads.showRewarded('try_skin'))) return;
            trialSkin = k.id;
            trialLevel = state === 'play' ? (preset ? 'daily' : level.n) : null;
            applySkin();
            sfx.buy();
            track('ad_reward', { placement: 'try_skin', skin: k.id });
            renderShop();
            setTip(t('try.on', { name }), 2600);
          });
          box.appendChild(tryBtn);
        } else {
          const tag = document.createElement('small');
          tag.className = 'try-tag';
          tag.textContent = t('try.active');
          box.appendChild(tag);
        }
        li.appendChild(box);
      }
      list.appendChild(li);
    }
  } else if (shopTab === 'store') {
    const owned = save.iap || [];
    for (const [id, p] of Object.entries(PRODUCTS)) {
      if (p.kind !== 'consumable' && owned.includes(id)) continue;
      const li = row(t('iap.' + id), `<p>${t('iap.' + id + '.sub')}</p>`, `<span class="icon-tile tile-hint" aria-hidden="true" style="font-size:26px">${p.icon}</span>`);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-buy btn-green';
      btn.id = 'iap-' + id;
      btn.textContent = p.price;
      btn.addEventListener('click', async () => {
        sfx.tap();
        if (!(await payments.buy(id))) return;
        if (p.kind !== 'consumable') save.iap = [...new Set([...(save.iap || []), id])];
        save.coins += p.coins || 0;
        save.hints += p.hints || 0;
        if (p.skin && !save.skins.includes(p.skin)) save.skins.push(p.skin);
        writeSave(save); updateCoins(); updateHints();
        sfx.buy();
        setTip(t('iap.thanks'), 2400);
        track('purchase', { kind: p.kind, id });
        renderShop();
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
    if (!list.children.length) list.innerHTML = `<li class="row"><div class="row-text"><p>${t('iap.all')}</p></div></li>`;
  } else {
    const bulb = '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/></svg>';
    const head = document.createElement('li');
    head.className = 'row';
    head.innerHTML = `<span class="icon-tile tile-hint" aria-hidden="true">${bulb}</span><div class="row-text"><h3>${t('hints.have', { n: save.hints })}</h3><p>${t('hints.desc')}</p></div>`;
    list.appendChild(head);
    const adRow = row(t('ad.hint'), '', '<span class="icon-tile tile-hint" aria-hidden="true">📺</span>');
    const adBtn = document.createElement('button');
    adBtn.className = 'btn btn-buy btn-ad';
    adBtn.type = 'button';
    adBtn.id = 'hint-ad';
    adBtn.textContent = t('ad.watch');
    adBtn.addEventListener('click', async () => {
      if (!(await ads.showRewarded('hint'))) return;
      save.hints += 1;
      writeSave(save);
      sfx.buy();
      updateHints();
      renderShop();
      track('ad_reward', { placement: 'hint' });
    });
    adRow.appendChild(adBtn);
    list.appendChild(adRow);
    for (const pk of HINT_PACKS) {
      const name = t('hints.pack', { n: pk.n });
      const li = row(name, '', `<span class="icon-tile tile-hint" aria-hidden="true">${bulb}</span>`);
      li.appendChild(buyButton('hints-' + pk.n, pk.cost, name, () => { save.hints += pk.n; }));
      list.appendChild(li);
    }
  }
}
for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { sfx.tap(); shopTab = b.dataset.tab; renderShop(); });
// home backdrop: the next level waits behind the menu
function showBackdrop() {
  gen++;
  timeScale = 1;
  tweens.length = 0;
  level = levelData(save.level);
  h = level.towers.map(() => 0);
  power = startPower(level.start, save.up.power);
  startP = power;
  shownPower = power;
  history = [];
  keys = 0;
  armed = false;
  hero.alive = true;
  hero.spin = 0;
  hero.flash = 0;
  hero.mult = 1;
  busy = false;
  buildBoard();
  heroHome();
  syncBoard();
}
function goHome() {
  setTimeout(() => showNotice(), 0);
  if (trialSkin && trialLevel !== null) { trialSkin = null; trialLevel = null; applySkin(); }
  state = 'home';
  setSong('main');
  showBackdrop();
  $('hud').hidden = true;
  $('fail').hidden = true;
  $('btn-play').textContent = t('play', { n: save.level });
  updateCoins();
  refreshAchBadge();
  refreshDailyButton();
  refreshEventStrip();
  showScreen('screen-home');
}
const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); fn(); });
on('btn-play', () => {
  sfx.tap();
  if (!save.seenIntro && save.level <= 1) { startIntro(); return; }
  if (!save.seenHow) { save.seenHow = true; writeSave(save); howThenPlay = true; showScreen('screen-how'); return; }
  startLevel(save.level);
});
let howThenPlay = false;
on('btn-how', () => { sfx.tap(); howThenPlay = false; showScreen('screen-how'); });
on('btn-how-close', () => { sfx.tap(); if (howThenPlay) startLevel(save.level); else goHome(); });
on('btn-shop', () => { sfx.tap(); openShop(null, 'home'); });
on('btn-won-shop', () => { sfx.tap(); openShop(null, 'won'); });
on('btn-shop-back', closeShop);
on('btn-intro-go', () => { sfx.tap(); save.seenIntro = 1; save.seenHow = true; writeSave(save); startLevel(0); });
on('btn-daily', claimDaily);

// ---------------------------------------------------------------- the "ad" intro
async function startIntro() {
  startLevel(0);
  const my = gen;
  introAd = true;
  busy = true;
  $('ad-ribbon').hidden = false;
  $('hud-level').textContent = t('intro.hud');
  $('taunt').textContent = t('intro.taunt');
  setTip('');
  track('intro_start');
  await wait(0.9);
  // like in the ads: the finger hovers the right tower, then goes for the wrong one
  await pointAt(0, 0.8);
  await pointAt(1, 0.7);
  if (my !== gen) return;
  $('finger').classList.add('tap');
  await wait(0.25);
  if (my !== gen) return;
  $('finger').hidden = true;
  busy = false;
  move(1);
}
function pointAt(ti, dur) {
  const c = cells[ti][h[ti]];
  const [x, y] = toScreen(towerX[ti], c.y + 0.7);
  const f = $('finger');
  f.hidden = false;
  f.classList.remove('tap');
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  return wait(dur);
}

// ---------------------------------------------------------------- daily tower (same puzzle for everyone today)
function todaysTower() {
  const now = new Date();
  const idx = dayIndex(now);
  const n = dailySpecN(now);
  const L = idx >= 0 && idx < DAILY_TOWERS.length ? decodeLevel(DAILY_TOWERS[idx], n) : buildLevel(n, dailySeed(idx));
  L.n = n;
  L.daily = true;
  return L;
}
function startDailyTower() {
  const L = todaysTower();
  startLevel(L.n, L);
  $('hud-level').textContent = t('dt.hud');
  track('daily_tower', { day: dayIndex() });
}
function refreshEventStrip() {
  if (!save.week || save.week.w !== EVENT.week) save.week = { w: EVENT.week, wins: 0, claimed: false };
  const wk = save.week;
  const done = wk.wins >= WEEK_GOAL;
  $('ev-title').textContent = t('ev.' + EVENT.id);
  $('ev-desc').textContent = t('ev.' + EVENT.id + '.d');
  $('ev-goal').textContent = wk.claimed ? t('ev.claimed') : done ? t('ev.claim', { n: WEEK_REWARD })
    : t('ev.goal', { a: Math.min(wk.wins, WEEK_GOAL), b: WEEK_GOAL, d: EVENT.daysLeft });
  $('event-strip').classList.toggle('ready', done && !wk.claimed);
}
on('event-strip', () => {
  const wk = save.week;
  if (!wk || wk.claimed || wk.wins < WEEK_GOAL) { sfx.tap(); return; }
  wk.claimed = true;
  save.coins += WEEK_REWARD;
  save.stats.coins = (save.stats.coins || 0) + WEEK_REWARD;
  writeSave(save);
  sfx.win();
  buzz([30, 30, 60]);
  track('weekly_claim', { week: EVENT.week, id: EVENT.id });
  updateCoins();
  refreshEventStrip();
});
function refreshDailyButton() {
  const done = save.dtLast === dayKey(new Date());
  $('dt-sub').textContent = done ? t('dt.done') : t('dt.reward');
}
on('btn-dtower', () => { sfx.tap(); startDailyTower(); });
$('promo-img').src = promoIcon;
$('promo-img2').src = promoIcon2;
on('btn-promo2', () => { sfx.tap(); track('promo_click', { game: 'choices' }); openLink(storeLink('choices')); });
on('btn-promo', () => { sfx.tap(); track('promo_click', { game: 'notafakead' }); openLink(storeLink('notafakead')); });

// ---------------------------------------------------------------- daily reward
const DAILY = [30, 40, 50, 70, 90, 120, 200];
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function dailyDay() {
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  return save.lastDaily === yesterday ? ((save.streak || 0) % 7) + 1 : 1;
}
function maybeDaily() {
  if (!save.seenIntro && save.level <= 1) return;
  if (save.lastDaily === dayKey(new Date())) return;
  const d = dailyDay();
  const box = $('days');
  box.innerHTML = '';
  DAILY.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'day' + (i + 1 < d ? ' done' : i + 1 === d ? ' today' : '');
    el.innerHTML = `<small>${t('daily.day', { n: i + 1 })}</small>${i + 1 < d ? '✓' : c}${i === 6 ? '<small>+3 💡</small>' : ''}`;
    box.appendChild(el);
  });
  $('daily-amount').textContent = '+' + DAILY[d - 1] + (d === 7 ? ' · +3 💡' : '');
  showScreen('screen-daily');
}
function claimDaily() {
  const d = dailyDay();
  save.coins += DAILY[d - 1];
  if (d === 7) save.hints += 3;
  save.streak = d;
  save.lastDaily = dayKey(new Date());
  writeSave(save);
  sfx.buy();
  buzz(30);
  track('daily', { day: d });
  updateHints();
  goHome();
}
on('btn-map', () => { sfx.tap(); renderMap(); showScreen('screen-map'); });
on('btn-map-back', () => { sfx.tap(); goHome(); });
function renderMap() {
  const grid = $('map-grid');
  grid.innerHTML = '';
  const last = Math.max(RAW_LEVELS.length, save.level);
  let total = 0;
  let current = null;
  for (let n = 1; n <= last; n++) {
    const st = save.stars[n] || 0;
    total += st;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lv' + (n === save.level ? ' current' : '') + (n % 5 === 0 ? ' boss' : '');
    if (n > save.level) {
      b.disabled = true;
      b.textContent = '🔒';
      b.setAttribute('aria-label', t('level.locked', { n }));
    } else {
      b.innerHTML = `${n}<small>${'★'.repeat(st)}<i>${'★'.repeat(n < save.level ? 3 - st : 0)}</i></small>`;
      b.setAttribute('aria-label', t('level.stars', { n, s: st }));
      b.addEventListener('click', () => { unlockAudio(); sfx.tap(); startLevel(n); });
    }
    if (n === save.level) current = b;
    if ((n - 1) % 25 === 0) {
      const head = document.createElement('li');
      head.className = 'map-world';
      head.textContent = t('world.' + worldOf(n).id);
      grid.appendChild(head);
    }
    li.appendChild(b);
    grid.appendChild(li);
  }
  $('map-stars').textContent = total;
  if (current) requestAnimationFrame(() => current.scrollIntoView({ block: 'center' }));
}
on('btn-next', async () => {
  sfx.tap();
  if (level.daily) { goHome(); return; }
  if (level.n > 0) await inter.afterLevel(level.n);
  save.treasure = save.treasure || {};
  if (level.n > 0 && level.n % 10 === 0 && !save.treasure[level.n]) { openTreasure(level.n); return; }
  startLevel(level.n + 1);
});

// ---------------------------------------------------------------- treasure tower (bonus after every 10th level)
let tKeys = 0;
let tAfter = 1;
let tAdUsed = false;
function openTreasure(n) {
  save.treasure[n] = 1;
  writeSave(save);
  tAfter = n + 1;
  tKeys = 3;
  tAdUsed = false;
  const mult = 1 + n / 40;
  const r = (v) => Math.round((v * mult) / 5) * 5;
  const prizes = [
    { coins: r(20) }, { coins: r(25) }, { coins: r(30) }, { coins: r(40) }, { coins: r(50) },
    { coins: r(60) }, { hints: 1 }, { hints: 2 }, { coins: r(150), big: true },
  ];
  for (let i = prizes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [prizes[i], prizes[j]] = [prizes[j], prizes[i]]; }
  const box = $('chests');
  box.innerHTML = '';
  prizes.forEach((pz, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chest';
    b.setAttribute('aria-label', t('treasure.chest', { n: i + 1 }));
    b.addEventListener('click', () => openChest(b, pz));
    box.appendChild(b);
  });
  drawKeys();
  showScreen('screen-treasure');
  track('treasure_open', { level: n });
}
function drawKeys() {
  $('t-keys').innerHTML = Array.from({ length: Math.max(3, tKeys) }, (_, i) => `<span class="${i < tKeys ? '' : 'used'}">🔑</span>`).join('');
  const out = tKeys <= 0;
  for (const c of document.querySelectorAll('.chest:not(.open)')) c.disabled = out;
  $('btn-t-ad').hidden = !out || tAdUsed || !document.querySelector('.chest:not(.open)');
}
function openChest(b, pz) {
  if (tKeys <= 0 || b.classList.contains('open')) return;
  tKeys--;
  b.classList.add('open');
  if (pz.big) b.classList.add('big');
  b.disabled = true;
  if (pz.coins) {
    save.coins += pz.coins;
    save.stats.coins = (save.stats.coins || 0) + pz.coins;
    b.innerHTML = `<span class="coin-icon" aria-hidden="true"></span>${pz.coins}`;
    if (pz.big) { sfx.win(); buzz([30, 30, 60]); } else sfx.coin();
  } else {
    save.hints += pz.hints;
    b.innerHTML = `<span aria-hidden="true">💡</span>+${pz.hints}`;
    sfx.buy();
    updateHints();
  }
  writeSave(save);
  updateCoins();
  drawKeys();
}
on('btn-t-ad', async () => {
  if (!(await ads.showRewarded('treasure'))) return;
  tAdUsed = true;
  tKeys += 3;
  drawKeys();
  track('ad_reward', { placement: 'treasure' });
});
on('btn-t-done', () => { sfx.tap(); startLevel(tAfter); });
on('btn-retry', () => { sfx.tap(); aids++; startLevel(level.n, preset); });
on('btn-undo', async () => {
  sfx.tap();
  if (freeUndo) { freeUndo = false; undo(); return; }
  if (await ads.showRewarded('revive')) { track('ad_reward', { placement: 'revive' }); undo(); }
});
on('btn-double', async () => {
  sfx.tap();
  if (!lastReward || !(await ads.showRewarded('double'))) return;
  save.coins += lastReward;
  save.stats.coins = (save.stats.coins || 0) + lastReward;
  writeSave(save);
  $('won-coins').textContent = '+' + lastReward * 2;
  $('btn-double').hidden = true;
  lastReward = 0;
  sfx.buy();
  updateCoins();
  track('ad_reward', { placement: 'double' });
});
on('btn-restart', () => { if (busy) return; sfx.tap(); if (history.length) aids++; startLevel(level.n, preset); });
on('btn-hint', hint);
for (const b of BOOSTS) on('boost-' + b, () => useBoost(b));
on('btn-home', () => { if (busy || introAd) return; sfx.tap(); goHome(); });
// ---------------------------------------------------------------- settings
const onOff = (v) => t(v ? 'set.on' : 'set.off');
function refreshToggles() {
  $('btn-lang').textContent = LANG_NAMES[getLang()];
  $('btn-sound').textContent = onOff(!save.muted);
  $('btn-music').textContent = onOff(save.music);
  $('btn-vibrate').textContent = onOff(save.vibrate !== false);
  $('btn-notify').textContent = onOff(save.notify !== false);
  $('btn-reset').textContent = t('set.resetBtn');
  resetArmed = false;
}
let resetArmed = false;
on('btn-settings', () => { sfx.tap(); refreshToggles(); $('account-state').textContent = account.label(); showScreen('screen-settings'); });
on('btn-settings-back', () => { sfx.tap(); goHome(); });

// ---------------------------------------------------------------- account (Supabase, shared with Not a Fake Ad)
const anyModalOpen = () => ['screen-shop', 'screen-map', 'screen-intro', 'screen-daily', 'screen-treasure', 'screen-ach', 'screen-settings', 'screen-how', 'screen-ad']
  .some((id) => !$(id).hidden) || !$('screen-account').hidden;
const account = createAccount({
  save, writeSave, sfx, track, fmt, anyModalOpen,
  popup: (msg) => setTip(msg, 2600),
  refreshWallet: () => updateCoins(),
  backToSettings: () => { refreshToggles(); $('account-state').textContent = account.label(); showScreen('screen-settings'); },
});
// ---------------------------------------------------------------- leaderboard, review, gifts, share, ads between levels
const leaderboard = createLeaderboard({
  game: 'tower', enabled: CLOUD, t, sfx, track,
  boards: [{ id: 'level', label: () => t('lb.board.level') }, { id: 'daily', label: () => t('dt.btn').replace(/^\S+\s/, '') }],
});
const review = createReview({ game: 'tower', save, writeSave: () => writeSave(save), t, track, remote, gameName: 'Not a Fake Ad: Tower', canShow: () => state === 'won' && $('screen-account').hidden });
const inter = createInterstitials({ admob: admobApi, remote, skip: () => (save.iap || []).includes('no_ads'), track });
const giftCoins = (n, h) => () => { save.coins += n; save.hints += h; updateCoins(); updateHints(); };
const cross = createCrossRewards({
  save, writeSave: () => writeSave(save), t, sfx, track,
  levels: () => account.otherLevels(),
  icons: { nfa: promoIcon, choices: promoIcon2 },
  names: { nfa: 'Not a Fake Ad', choices: 'Not a Fake Ad: Choices' },
  onSignIn: () => account.open('settings'),
  rewards: [
    { id: 'nfa10', from: 'nfa', level: 10, gift: () => t('cr.coinsHints', { n: 500, h: 3 }), grant: giftCoins(500, 3) },
    { id: 'choices10', from: 'choices', level: 10, gift: () => t('cr.coinsHints', { n: 500, h: 3 }), grant: giftCoins(500, 3) },
    { id: 'nfa30', from: 'nfa', level: 30, gift: () => t('cr.coinsHints', { n: 1500, h: 5 }), grant: giftCoins(1500, 5) },
    { id: 'choices30', from: 'choices', level: 30, gift: () => t('cr.coinsHints', { n: 1500, h: 5 }), grant: giftCoins(1500, 5) },
  ],
});
setTimeout(async () => { await cross.refresh(); if (cross.count() && state === 'home') setTip(t('cr.new'), 3000); }, 6000);
let lastShare = null;
async function shareMoment() {
  if (!lastShare) return;
  sfx.tap();
  renderer.render(scene, camera);
  const shot = document.createElement('canvas');
  shot.width = renderer.domElement.width; shot.height = renderer.domElement.height;
  shot.getContext('2d').drawImage(renderer.domElement, 0, 0);
  const card = makeCard({ shot, title: lastShare.title, line: lastShare.line, logo: 'Not a Fake Ad: Tower', sub: t('sh.cta'), colors: { top: '#bfe0ff', bottom: '#8a78f0' } });
  const how = await shareCanvas(card, { title: 'Not a Fake Ad: Tower', text: `${t('sh.text', { game: 'Not a Fake Ad: Tower' })} ${storeLink('tower')}`, file: 'nfa-tower.png' });
  track('share', { kind: 'win', how });
}
function showNotice() {
  const id = remote.get('notice_id', '');
  const n = remote.get('notice', null);
  if (!id || !n || save.noticeSeen === id) return;
  const text = typeof n === 'string' ? n : n[getLang()] || n.en;
  if (!text) return;
  save.noticeSeen = id; writeSave(save);
  setTimeout(() => setTip(String(text).slice(0, 160), 4000), 800);
}
remote.onChange(() => { if (state === 'home') showNotice(); });
on('btn-share-won', () => shareMoment());
on('btn-lb', () => { sfx.tap(); leaderboard.open('level'); });
on('btn-gifts', () => { sfx.tap(); $('screen-settings').hidden = true; cross.open(); });

on('btn-account', () => { sfx.tap(); $('screen-settings').hidden = true; account.open('settings'); });
for (const id of ['link-privacy', 'link-support']) $(id).addEventListener('click', (e) => { e.preventDefault(); openLink($(id).href); });
on('btn-lang', () => { setLang(nextLang()); refreshToggles(); sfx.tap(); });
on('btn-sound', () => { save.muted = !save.muted; setMuted(save.muted); writeSave(save); refreshToggles(); sfx.tap(); });
on('btn-music', () => { save.music = !save.music; setMusicEnabled(save.music); writeSave(save); refreshToggles(); sfx.tap(); });
on('btn-notify', () => { save.notify = save.notify === false; writeSave(save); refreshToggles(); sfx.tap(); if (save.notify) askNotificationPermission(); scheduleNotifications(save); });
on('btn-vibrate', () => { save.vibrate = save.vibrate === false; writeSave(save); refreshToggles(); sfx.tap(); buzz(30); });
on('btn-reset', () => {
  sfx.tap();
  if (!resetArmed) { resetArmed = true; $('btn-reset').textContent = t('set.sure'); return; }
  const keep = { muted: save.muted, music: save.music, vibrate: save.vibrate, account: save.account, notify: save.notify };
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, loadSaveFresh(), keep);
  writeSave(save);
  track('reset');
  applySkin();
  updateHints();
  goHome();
});

// ---------------------------------------------------------------- achievements
function refreshAchBadge() {
  const n = claimable(save);
  $('ach-badge').hidden = !n;
  $('ach-badge').textContent = String(n);
}
function renderAch() {
  const list = $('ach-list');
  list.innerHTML = '';
  $('ach-coins').textContent = fmt(save.coins);
  const items = ACHIEVEMENTS.map((a) => ({ a, v: Math.min(a.goal, a.get(save)), claimed: !!save.ach[a.id] }));
  // ready to claim first, then in progress, then done
  const rank = (x) => (x.claimed ? 2 : x.v >= x.a.goal ? 0 : 1);
  items.sort((x, y) => rank(x) - rank(y));
  for (const { a, v, claimed } of items) {
    const li = row(t('ach.' + a.id), `<p>${t('ach.' + a.id + '.d')}</p><div class="bar"><i style="width:${(100 * v) / a.goal}%"></i></div>`,
      '<span class="icon-tile tile-income" aria-hidden="true">🏆</span>');
    if (claimed) li.classList.add('claimed');
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'ach-' + a.id;
    if (claimed) { b.className = 'btn btn-buy btn-plain'; b.textContent = t('ach.done'); b.disabled = true; }
    else if (v >= a.goal) {
      b.className = 'btn btn-buy btn-green';
      b.innerHTML = `<span class="coin-icon" aria-hidden="true"></span>+${a.reward}`;
      b.addEventListener('click', () => {
        save.ach[a.id] = 1;
        save.coins += a.reward;
        writeSave(save);
        sfx.buy();
        buzz(25);
        track('achievement', { id: a.id });
        updateCoins();
        refreshAchBadge();
        renderAch();
      });
    } else { b.className = 'btn btn-buy btn-plain'; b.textContent = `${fmt(v)}/${fmt(a.goal)}`; b.disabled = true; }
    li.appendChild(b);
    list.appendChild(li);
  }
}
on('btn-ach', () => { sfx.tap(); renderAch(); showScreen('screen-ach'); });
on('btn-ach-back', () => { sfx.tap(); goHome(); });
refreshToggles();
setMusicEnabled(save.music);
// browsers only allow sound after the first touch
window.addEventListener('pointerdown', () => { unlockAudio(); if (save.music) startMusic(); }, { capture: true });

// reminders are planned every time the game goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden) scheduleNotifications(save); });
window.addEventListener('pagehide', () => scheduleNotifications(save));

// tap a tower: anywhere in its column
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || busy || introAd) return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) return;
  let best = -1;
  let bd = Infinity;
  towerX.forEach((x, i) => { const d = Math.abs(hit.x - x); if (d < bd) { bd = d; best = i; } });
  if (best >= 0 && bd < GAP / 2 + 0.2 && hit.y > -1.5 && hit.y < view.maxY + 1) move(best);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let time = 0;
const flashColor = new THREE.Color(0xffffff);
const shieldHelmet = new THREE.Color(0xb9c3d1);
function frame() {
  const dt = Math.min(0.05, clock.getDelta()) * speed * timeScale;
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.5);
    const a = shake * shake * 0.35;
    const rx = (Math.random() - 0.5) * a;
    const ry = (Math.random() - 0.5) * a;
    camera.position.set(camBase.x + rx, camBase.y + 7 + ry, 40);
    camera.lookAt(camBase.x + rx, camBase.y + ry, 0);
  }
  time += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const q = Math.min(1, tw.t / tw.dur);
    tw.fn(q);
    if (q >= 1) { tweens.splice(i, 1); tw.done(); }
  }
  updateWeather(dt);
  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 30) c.position.x = -30; }

  // characters
  enemySet.begin(); bossSet.begin(); princessSet.begin(); heroSet.begin();
  if (level) {
    for (const tw of cells) for (const c of tw) {
      if (c.kind !== 'enemy' && c.kind !== 'boss' && c.kind !== 'princess' && c.kind !== 'shield') {
        if (c.obj && !c.gone && !c.taking && c.kind !== 'trap' && c.kind !== 'lock') {
          const base = c.kind === 'sword' ? 0.45 : c.kind === 'curse' || c.kind === 'key' ? 0.6 : 0.15;
          c.obj.position.y = c.y + base + Math.sin(time * 2.5 + c.x) * 0.08;
          c.obj.rotation.y = time * 1.6;
        }
        continue;
      }
      if (c.gone && !c.anim) { if (c.obj) c.obj.visible = false; continue; }
      let x = c.x;
      let y = c.y;
      let s = c.scale;
      let face = c.kind === 'princess' ? Math.PI + Math.sin(time * 2) * 0.3 : Math.PI / 2 + 0.5;
      x += c.dx || 0;
      s *= 1 + (c.pulse || 0);
      if (c.anim && (c.anim.kind === 'fly' || c.anim.kind === 'flyBig')) {
        const big = c.anim.kind === 'flyBig';
        c.anim.t += dt;
        const q = Math.max(0, c.anim.t) / (big ? 1.1 : 0.6);
        if (q >= 1) { c.anim = null; c.gone = true; if (c.obj) c.obj.visible = false; continue; }
        x += q * (big ? 6 : 2.2);
        y += Math.sin(Math.PI * q) * (big ? 3.5 : 1.4);
        s *= 1 - q * (big ? 0.5 : 0.7);
        face += q * (big ? 22 : 14);
      }
      const set = c.kind === 'boss' ? bossSet : c.kind === 'princess' ? princessSet : enemySet;
      const bob = Math.abs(Math.sin(time * 3 + c.x * 2)) * 0.03;
      set.add(x, 0.05, face, s, time * 3 + c.x, 0, c.kind === 'shield' ? shieldHelmet : null, y + bob);
      if (c.obj) {
        c.obj.visible = !c.anim;
        c.obj.position.set(x - 0.22 * s / 1.5, y + bob + 0.42 * s / 1.5, 0.45);
      }
    }
    if (hero.flash > 0) hero.flash = Math.max(0, hero.flash - dt * 3);
    hero.phase += dt * 12 * (hero.stride || 0.0);
    // the hero grows as the power climbs, like in the ads
    const hs = Math.min(2.15, Math.max(1.45, 1.6 + 0.42 * Math.log10(Math.max(1, shownPower) / Math.max(1, startP)))) * hero.mult;
    heroSet.add(hero.x, hero.z, hero.facing + hero.spin, hs, hero.phase, hero.stride, hero.flash > 0 ? flashColor : null, hero.y);
    heroLabel.visible = hero.alive || shownPower > 0;
    heroLabel.position.set(hero.x, hero.y + 0.78 * hs + 0.42, 0.9);
    // the sword, once picked up, stays in the hero's right hand
    heroSword.visible = armed && hero.alive;
    if (heroSword.visible) {
      const f = hero.facing + hero.spin;
      const k = hs / 1.6;
      const fx = -Math.sin(f);
      const fz = -Math.cos(f);
      heroSword.position.set(hero.x + fx * 0.14 * k - fz * 0.2 * k, hero.y + 0.36 * k, hero.z + fz * 0.14 * k + fx * 0.2 * k);
      heroSword.rotation.set(0, f, 0);
      heroSword.scale.setScalar(k * 0.8);
      heroSwordPivot.rotation.x = -0.35 - swing * 1.7;
      if (swing > 0) swing = Math.max(0, swing - dt * 0.5);
    }
    heroBubble.visible = shieldArmed && hero.alive;
    if (heroBubble.visible) {
      heroBubble.position.set(hero.x, hero.y + 0.5 * hs / 1.6, hero.z);
      heroBubble.scale.setScalar((hs / 1.6) * (1 + Math.sin(time * 5) * 0.04));
    }
    keyCarry.visible = keys > 0 && hero.alive;
    keyCarry.position.set(hero.x - 0.5, hero.y + 0.6 + Math.sin(time * 4) * 0.05, 0.6);
    keyCarry.rotation.y = Math.sin(time * 2) * 0.6;
    heroLabel.userData.set(fmt(shownPower), '#9cc4ff');
  } else heroLabel.visible = false;
  enemySet.end(); bossSet.end(); princessSet.end(); heroSet.end();

  if (hintFrame) hintFrame.children.forEach((m) => (m.material.opacity = 0.55 + Math.sin(time * 8) * 0.4));
  for (let i = confetti.length - 1; i >= 0; i--) {
    const m = confetti[i];
    m.userData.life -= dt;
    m.userData.v.y -= 9 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.rotation.x += dt * 8;
    m.rotation.z += dt * 5;
    if (m.userData.life <= 0) { scene.remove(m); m.material.dispose(); confetti.splice(i, 1); }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

applyStatic();
updateHints();
goHome();
// Opening screen; on the very first launch the how-it-works pages, then straight into the ad intro.
const obArt = towerArt();
runOpening({
  key: 'nfa-tower',
  logo: '<h1 class="logo">Not a<br><span class="strike">Fake</span> Ad<span class="tower">TOWER</span></h1>',
  pages: [1, 2, 3, 4].map((i) => ({ art: obArt[i - 1], title: t(`ob.${i}.t`), body: t(`ob.${i}.b`) })),
  str: { presents: t('ob.presents'), notFake: t('ob.notfake'), skip: t('ob.skip'), next: t('ob.next'), start: t('ob.start') },
  onboard: !save.seenIntro && save.level <= 1,
  onTap: () => unlockAudio(),
}).then(({ onboarded }) => {
  track('opening_done', { onboarded });
  if (onboarded && state === 'home') startIntro();
  else maybeDaily();
});
resize();
requestAnimationFrame(frame);
track('session_start');

// test hooks (used by the headless bot)
window.__tower = {
  get state() { return state; },
  review: () => review.show(),
  share: () => shareMoment(),
  cross: () => cross.open(),
  lb: (b) => leaderboard.open(b),
  get saveObj() { return save; },
  get busy() { return busy; },
  get level() { return level; },
  get power() { return power; },
  get h() { return h.slice(); },
  setSpeed: (s) => (speed = s),
  start: (n) => startLevel(n),
  move,
  undo,
  solveNow: () => solve(remainingLevel()),
  notes: () => planNotifications(save).map((n) => ({ ...n, at: n.at.toString() })),
};
