// The tower builder: the player stacks floors into up to 4 towers, the solver says at once whether
// the tower can be won, and a solvable tower turns into a share code. Plus the "play a code" screen.
import { encode, decode, pretty, VALUED, LIMITS } from './codes.js';
import { WORLDS } from './worlds.js';

const TOOLS = ['enemy', 'shield', 'boss', 'sword', 'potion', 'trap', 'curse', 'key', 'lock', 'princess', 'fuse', 'erase'];
const DEFAULT_V = { enemy: 5, shield: 4, boss: 40, sword: 5, trap: 4, fuse: 4 };
// the same little tiles as on the rules screen
export function tileText(c) {
  switch (c.kind) {
    case 'enemy': return String(c.v);
    case 'boss': return '👑' + c.v;
    case 'shield': return '2×' + c.v;
    case 'sword': return '+' + c.v;
    case 'potion': return 'x2';
    case 'trap': return '-' + c.v;
    case 'curse': return '-50%';
    case 'key': return '🔑';
    case 'lock': return '🔒';
    case 'princess': return '👸';
    case 'fuse': return '💣' + c.v;
    default: return '🗑';
  }
}
const stepOf = (v) => Math.max(1, Math.pow(10, Math.floor(Math.log10(Math.max(1, v))) - 1));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export function createEditor({ save, writeSave, t, sfx, track, solvePlain, showScreen, play, goHome, shareText }) {
  const $ = (id) => document.getElementById(id);
  const fresh = () => ({ start: 10, world: 0, towers: [[{ kind: 'enemy', v: 6 }, { kind: 'enemy', v: 14 }], [{ kind: 'sword', v: 5 }, { kind: 'boss', v: 32 }]] });
  let P = save.editor && Array.isArray(save.editor.towers) ? save.editor : fresh();
  let tool = 'enemy';
  let sel = null; // { t, k }
  let lastCode = '';
  let solvable = false;

  const keep = () => { save.editor = P; writeSave(save); };
  const cellAt = (s) => (s && P.towers[s.t] && P.towers[s.t][s.k]) || null;

  function setCell(ti, k) {
    const tw = P.towers[ti];
    if (tool === 'erase') {
      tw.splice(k, 1);
      sel = null;
      if (!tw.length && P.towers.length > 1) P.towers.splice(ti, 1);
      return;
    }
    const old = tw[k];
    if (tool === 'boss') {
      // only one boss: an older one becomes a plain enemy
      P.towers.forEach((x) => x.forEach((c) => { if (c.kind === 'boss' && c !== old) c.kind = 'enemy'; }));
    }
    const c = { kind: tool };
    if (VALUED.has(tool)) c.v = old && old.v && old.kind !== 'fuse' && tool !== 'fuse' ? old.v : DEFAULT_V[tool];
    tw[k] = c;
    sel = { t: ti, k };
  }

  function check() {
    const towers = P.towers.filter((tw) => tw.length);
    const el = $('ed-status');
    lastCode = '';
    $('ed-codeline').hidden = true;
    if (!towers.length) { solvable = false; el.className = 'ed-status'; el.textContent = t('ed.empty'); return; }
    const r = solvePlain({ start: P.start, towers });
    solvable = r.wins > 0;
    el.className = 'ed-status ' + (solvable ? 'ok' : 'bad');
    el.textContent = solvable ? `✓ ${t('ed.ok')} · ${t(r.ratio >= 0.25 ? 'ed.easy' : r.ratio >= 0.03 ? 'ed.tricky' : 'ed.evil')}` : '✗ ' + t('ed.no');
    $('btn-ed-share').disabled = !solvable;
  }

  function render() {
    const board = $('ed-board');
    board.innerHTML = '';
    P.towers.forEach((tw, ti) => {
      const col = document.createElement('div');
      col.className = 'ed-col';
      tw.forEach((c, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ed-tile k-${c.kind}` + (sel && sel.t === ti && sel.k === k ? ' sel' : '');
        b.textContent = tileText(c);
        b.setAttribute('aria-label', t('ed.k.' + c.kind) + (c.v ? ' ' + c.v : ''));
        b.addEventListener('click', () => {
          sfx.tap();
          if (tool === 'erase' || c.kind !== tool) setCell(ti, k);
          else sel = { t: ti, k };
          changed();
        });
        col.appendChild(b);
      });
      if (tw.length < LIMITS.floors) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'ed-tile ed-add';
        add.textContent = '+';
        add.setAttribute('aria-label', t('ed.addFloor'));
        add.addEventListener('click', () => {
          sfx.tap();
          if (tool === 'erase') return;
          tw.push({ kind: 'potion' }); // placeholder, replaced by the tool right away
          setCell(ti, tw.length - 1);
          changed();
        });
        col.appendChild(add);
      }
      board.appendChild(col);
    });
    if (P.towers.length < LIMITS.towers) {
      const col = document.createElement('div');
      col.className = 'ed-col';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'ed-tile ed-add ed-newtower';
      add.textContent = t('ed.addTower');
      add.addEventListener('click', () => {
        sfx.tap();
        P.towers.push([]);
        const was = tool;
        if (tool === 'erase') tool = 'enemy';
        P.towers[P.towers.length - 1].push({ kind: 'potion' });
        setCell(P.towers.length - 1, 0);
        tool = was;
        changed();
      });
      col.appendChild(add);
      board.appendChild(col);
    }
    // palette
    const pal = $('ed-palette');
    pal.innerHTML = '';
    for (const k of TOOLS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ed-tile k-${k}` + (tool === k ? ' sel' : '');
      b.textContent = k === 'erase' ? '🗑' : tileText({ kind: k, v: { enemy: 9, shield: 9, boss: 80, sword: 8, trap: 9, fuse: 5 }[k] });
      b.setAttribute('aria-label', t('ed.k.' + k));
      b.setAttribute('aria-pressed', String(tool === k));
      b.addEventListener('click', () => { sfx.tap(); tool = k; render(); });
      pal.appendChild(b);
    }
    // the selected floor, or the tool
    const c = cellAt(sel);
    const shown = c || { kind: tool };
    $('ed-sel-name').textContent = t('ed.k.' + shown.kind);
    const valued = c && VALUED.has(c.kind);
    $('ed-val').hidden = !valued;
    $('ed-sel-desc').hidden = !!valued;
    $('ed-sel-desc').textContent = t('ed.d.' + shown.kind);
    if (valued) {
      $('ed-val-lbl').textContent = t(c.kind === 'fuse' ? 'ed.moves' : 'ed.power');
      $('ed-val-in').value = c.v;
    }
    $('ed-start').value = P.start;
    $('ed-world').textContent = '🌍 ' + t('world.' + WORLDS[P.world || 0].id);
  }
  function changed() { keep(); render(); check(); }

  function setVal(v) {
    const c = cellAt(sel);
    if (!c) return;
    c.v = clamp(v, 1, c.kind === 'fuse' ? 30 : LIMITS.maxV);
    changed();
  }
  const bump = (dir) => { const c = cellAt(sel); if (c) { sfx.tap(); setVal(c.v + dir * stepOf(c.v - (dir < 0 ? 1 : 0))); } };
  const bumpStart = (dir) => { sfx.tap(); P.start = clamp(P.start + dir * stepOf(P.start - (dir < 0 ? 1 : 0)), 1, LIMITS.maxStart); changed(); };
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  on('ed-val-minus', () => bump(-1));
  on('ed-val-plus', () => bump(1));
  $('ed-val-in').addEventListener('change', () => setVal($('ed-val-in').value));
  on('ed-start-minus', () => bumpStart(-1));
  on('ed-start-plus', () => bumpStart(1));
  $('ed-start').addEventListener('change', () => { P.start = clamp($('ed-start').value, 1, LIMITS.maxStart); changed(); });
  on('ed-world', () => { sfx.tap(); P.world = ((P.world || 0) + 1) % WORLDS.length; changed(); });
  on('btn-ed-clear', () => {
    sfx.tap();
    P = { start: 10, world: P.world || 0, towers: [[{ kind: 'enemy', v: 5 }]] };
    sel = null;
    tool = 'enemy';
    changed();
  });
  const puzzle = () => ({ start: P.start, world: P.world || 0, towers: P.towers.filter((tw) => tw.length).map((tw) => tw.map((c) => ({ ...c }))) });
  on('btn-ed-play', () => {
    sfx.tap();
    if (!P.towers.some((tw) => tw.length)) return;
    track('editor_test', { solvable });
    play(puzzle(), { mine: true, code: solvable ? encode(puzzle()) : '' });
  });
  on('btn-ed-share', async () => {
    if (!solvable) return;
    sfx.tap();
    lastCode = encode(puzzle());
    const line = $('ed-codeline');
    line.hidden = false;
    $('ed-code').textContent = pretty(lastCode);
    $('ed-code-note').textContent = '';
    const how = await shareText(t('code.shareText', { code: pretty(lastCode) }), pretty(lastCode));
    $('ed-code-note').textContent = how === 'copy' ? t('code.copied') : '';
    track('editor_share', { how, floors: P.towers.flat().length, towers: P.towers.length });
  });
  on('ed-code', async () => {
    if (!lastCode) return;
    const how = await shareText(null, pretty(lastCode));
    $('ed-code-note').textContent = how === 'copy' ? t('code.copied') : '';
  });
  on('btn-ed-back', () => { sfx.tap(); goHome(); });
  on('btn-ed-code', () => { sfx.tap(); openCode(); });

  // ---------------------------------------------------------------- play a code
  function openCode(prefill = '') {
    $('code-error').hidden = true;
    if (prefill) $('code-input').value = prefill;
    showScreen('screen-code');
    track('code_open');
  }
  function playCode() {
    sfx.tap();
    const raw = $('code-input').value;
    const p = decode(raw);
    const err = $('code-error');
    if (!p) { err.textContent = t('code.bad'); err.hidden = false; track('code_bad'); return; }
    if (!solvePlain({ start: p.start, towers: p.towers }).wins) { err.textContent = t('code.unsolvable'); err.hidden = false; return; }
    err.hidden = true;
    const code = encode(p);
    track('code_play', { floors: p.towers.flat().length });
    play(p, { mine: false, code });
  }
  on('btn-code-play', playCode);
  $('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); playCode(); } });
  on('btn-code-build', () => { sfx.tap(); open(); });
  on('btn-code-back', () => { sfx.tap(); goHome(); });

  function open() {
    sel = null;
    render();
    check();
    showScreen('screen-editor');
    track('editor_open');
  }
  return { open, openCode, refresh: () => { render(); check(); } };
}
