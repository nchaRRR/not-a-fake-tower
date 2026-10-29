// Background music, synthesized on the fly (no audio files). A cheerful loop while you play,
// and a faster minor-key loop while the boss is within reach.
import { getAudioContext } from './audio.js';

const SONGS = {
  main: {
    bpm: 112,
    // C  G  Am  F   (MIDI notes)
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    lead: [[72, 0, 76, 0, 79, 0, 76, 74], [74, 0, 71, 0, 74, 0, 79, 0], [76, 0, 72, 0, 69, 0, 72, 76], [77, 0, 76, 0, 74, 0, 72, 0]],
  },
  boss: {
    bpm: 136,
    // Am  F  G  E
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
    lead: [[69, 0, 72, 69, 76, 0, 72, 0], [77, 0, 76, 72, 69, 0, 72, 0], [74, 0, 71, 74, 79, 0, 74, 0], [76, 0, 75, 0, 76, 0, 80, 0]],
  },
};

let enabled = true;
let song = 'main';
let playing = false;
let master = null;
let timer = 0;
let nextTime = 0;
let step = 0;
let noiseBuf = null;
let keyShift = 0;
export function setSongKey(k) { keyShift = k; }

const hz = (m) => 440 * Math.pow(2, (m + keyShift - 69) / 12);

function ensure(ctx) {
  if (master) return;
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const len = ctx.sampleRate * 0.2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function note(ctx, t, freq, dur, type, vol, cutoff = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f);
    out = f;
  }
  out.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hat(ctx, t, vol, dur = 0.04, freq = 7000) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

function kick(ctx, t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

function schedule() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const s = SONGS[song];
  const eighth = 60 / s.bpm / 2;
  while (nextTime < ctx.currentTime + 0.15) {
    const bar = Math.floor(step / 8) % s.chords.length;
    const i = step % 8;
    const chord = s.chords[bar];
    const t = nextTime;
    // bass on the beat
    if (i % 2 === 0) note(ctx, t, hz(chord[i === 4 ? 2 : 0] - 24), eighth * 1.6, 'triangle', 0.22);
    // soft arpeggio
    note(ctx, t, hz(chord[[0, 1, 2, 1][i % 4]] + 12), eighth * 0.9, 'square', 0.035, 1800);
    // lead, every other loop so it does not tire the ear
    const lead = s.lead[bar][i];
    if (lead && Math.floor(step / 32) % 2 === 1) note(ctx, t, hz(lead), eighth * 1.7, 'triangle', 0.09);
    // drums
    if (i === 0 || i === 4 || (song === 'boss' && i === 6)) kick(ctx, t, 0.35);
    if (i === 2 || i === 6) hat(ctx, t, 0.12, 0.12, 1800);
    hat(ctx, t, i % 2 ? 0.03 : 0.05);
    nextTime += eighth;
    step++;
  }
}

function fade(to, time = 0.4) {
  const ctx = getAudioContext();
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(to, now + time);
}

export function startMusic() {
  const ctx = getAudioContext();
  if (!ctx || !enabled || playing) return;
  ensure(ctx);
  playing = true;
  nextTime = ctx.currentTime + 0.05;
  step = 0;
  timer = setInterval(schedule, 40);
  fade(0.55, 0.8);
}

export function stopMusic() {
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  fade(0, 0.2);
}

export function setMusicEnabled(on) {
  enabled = on;
  if (on) startMusic();
  else stopMusic();
}

// Switches song at the next bar so the change stays on the beat.
export function setSong(name) {
  if (!SONGS[name] || name === song) return;
  song = name;
  step = Math.ceil(step / 8) * 8;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMusic();
  else if (enabled && getAudioContext()) startMusic();
});
