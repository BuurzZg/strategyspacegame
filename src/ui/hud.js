import { R } from '../render/space.js';
import { CELL } from '../engine/math.js';
import { fieldOre } from '../traits/economy.js';
import { FORMATIONS } from '../traits/formation.js';
import { STANCES } from '../traits/combat.js';
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const FORMATION_TIPS = { wall: 'A flat sheet facing the way you go', sphere: 'A shell round the biggest ship', wedge: 'An arrowhead, biggest ship at the point', column: 'Single file', ring: 'A flat circle', loose: 'No formation' };
const STANCE_TIPS = { aggressive: 'Chase and fight enemies that come close', defensive: 'Hold position and return fire', passive: 'Never fire; flee when attacked' };

// HUD: an overlay canvas for in-world marks (selection brackets, box select, move readout)
// plus DOM panels (resources, selection card, production panel, controls card, toasts).
// Units shown to the player: 1 cell = 100 m, so 10.24 world units = 1 m.
const $ = (id) => document.getElementById(id);
const M_PER_UNIT = 100 / CELL;
const TICKS_PER_S = 25;
const fmtDist = (units) => { const m = Math.abs(units) * M_PER_UNIT; return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`; };
const fmtAlt = (units) => `${units >= 0 ? '+' : '−'}${fmtDist(units)}`;
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
const fmtTime = (ticks) => { const s = Math.ceil(ticks / TICKS_PER_S); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`; };
const ORE_CSS = '#ffb070', HOSTILE_CSS = '#ff5a64';
const n = (type, k) => Array(k).fill(type);
// Proving Grounds spawn buttons: [label, faction of the spawning player, ships]
const HOSTILE_WAVES = [
  ['6 Darts', 'gaunt', n('dart', 6)], ['6 Talons', 'gaunt', n('talon', 6)], ['4 Pickets', 'gaunt', n('picket', 4)],
  ['2 Halberds', 'gaunt', n('halberd', 2)], ['2 Spindles', 'gaunt', n('spindle', 2)], ['Sabre', 'gaunt', ['sabre']],
  ['Raiding party', 'gaunt', [...n('dart', 4), ...n('talon', 2), ...n('picket', 2), 'halberd']],
  ['Gnasher pack', 'fauna', n('gnasher', 8)],
];
const OWN_WAVES = [['6 Darts', n('dart', 6)], ['4 Talons', n('talon', 4)], ['3 Pickets', n('picket', 3)], ['Halberd', ['halberd']], ['Spindle', ['spindle']], ['Sabre', ['sabre']]];
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

export class Hud {
  constructor() {
    this.overlay = $('overlay');
    this.ctx = this.overlay.getContext('2d');
    this.dirty = true;
    this.refreshT = 0;
    this.helpOpen = true;
    this.buildOpen = false;
    this.queueSig = null;
    this.toasts = [];
    this.deposits = []; // [frame, amount] for the ore-per-minute readout
  }
  attach(session, input) {
    this.s = session; this.input = input; this.world = session.world; this.renderer = session.renderer; this.audio = input.audio;
    this.dirty = true;
    this.buildPanel();
    this.groundsPanel();
    this.fleetPanel();
  }

  // ---------------------------------------------------------------- fleet bar and control groups
  fleetPanel() {
    const mk = (label, tip, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = tip; b.addEventListener('click', () => { fn(); b.blur(); }); return b; };
    for (const t of [...FORMATIONS, 'loose']) { const b = mk(cap(t), FORMATION_TIPS[t], () => this.input.setFormation(t)); b.dataset.f = t; $('fb-formation').appendChild(b); }
    for (const s of STANCES) { const b = mk(cap(s), STANCE_TIPS[s], () => this.input.setStance(s)); b.dataset.s = s; $('fb-stance').appendChild(b); }
    const strip = $('cgroups');
    strip.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) this.input.recallGroup(+b.dataset.g, e.shiftKey); });
    strip.addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; e.preventDefault(); this.input.assignGroup(+b.dataset.g); });
  }
  refreshFleet() {
    const inp = this.input, ships = inp.fleet();
    const show = ships.length > 0 && !inp.move;
    $('fleetbar').hidden = !show;
    if (show) {
      const f = inp.formationOf(ships), st = inp.stanceOf(inp.own().filter((a) => a.stance));
      for (const b of $('fb-formation').children) { b.setAttribute('aria-pressed', String(b.dataset.f === f)); b.disabled = ships.length < 2 && b.dataset.f !== 'loose'; }
      for (const b of $('fb-stance').children) b.setAttribute('aria-pressed', String(b.dataset.s === st));
    }
    // control groups strip: one chip per group in use
    const sig = inp.groups.map((g) => g.filter((id) => { const a = this.world.actorById.get(id); return a && !a.dead; }).length).join(',');
    if (sig !== this.groupSig) {
      this.groupSig = sig;
      const counts = sig.split(',').map(Number);
      $('cgroups').innerHTML = counts.map((c, i) => (i && c ? `<button type="button" data-g="${i}" title="Group ${i}: click to select (Shift adds, twice to jump to it); right-click to replace it with the selection"><b>${i}</b><span>${c}</span></button>` : '')).join('');
    }
  }
  resize(w, h, dpr) {
    this.overlay.width = w * dpr; this.overlay.height = h * dpr;
    this.overlay.style.width = `${w}px`; this.overlay.style.height = `${h}px`;
    this.dpr = dpr;
  }
  selectionChanged() { this.dirty = true; }
  modeChanged() { this.dirty = true; }
  // The controls card and the production panel share the right side, so one closes the other.
  // (and the Proving Grounds panel too)
  toggleHelp(force) {
    this.helpOpen = force !== undefined ? force : !this.helpOpen;
    $('help').hidden = !this.helpOpen;
    if (this.helpOpen) { if (this.buildOpen) this.toggleBuild(false); if (this.groundsOpen) this.toggleGrounds(false); }
  }
  toggleBuild(force) {
    this.buildOpen = force !== undefined ? force : !this.buildOpen;
    $('build').hidden = !this.buildOpen;
    $('btn-build').setAttribute('aria-pressed', String(this.buildOpen));
    if (this.buildOpen) { if (this.helpOpen) this.toggleHelp(false); if (this.groundsOpen) this.toggleGrounds(false); }
    this.queueSig = null;
    this.dirty = true;
  }
  toggleGrounds(force) {
    if (!this.world.settings.sandbox) return;
    this.groundsOpen = force !== undefined ? force : !this.groundsOpen;
    $('grounds').hidden = !this.groundsOpen;
    $('btn-grounds').setAttribute('aria-pressed', String(this.groundsOpen));
    if (this.groundsOpen) { if (this.helpOpen) this.toggleHelp(false); if (this.buildOpen) this.toggleBuild(false); }
    this.dirty = true;
  }

  // ---------------------------------------------------------------- Proving Grounds
  // Hostiles appear about 3 km beyond the point the camera is looking at (seen from the
  // Forge) and advance on the Forge. Your own test ships appear ahead of the Forge.
  groundsPanel() {
    $('btn-grounds').hidden = !this.world.settings.sandbox;
    if (!this.world.settings.sandbox) return;
    const button = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => { fn(); b.blur(); }); return b; };
    for (const [label, faction, types] of HOSTILE_WAVES) $(faction === 'fauna' ? 'pg-fauna' : 'pg-gaunt').appendChild(button(label, () => this.spawnHostile(faction, types)));
    for (const [label, types] of OWN_WAVES) $('pg-mine').appendChild(button(label, () => this.spawnOwn(types)));
    $('pg-ore').addEventListener('click', () => { this.input.issueWorld('SandboxOre', { player: this.s.viewer.index, amount: 2000 }); this.audio.play('deposit'); });
    $('pg-clear').addEventListener('click', () => { for (const p of this.world.players) if (p !== this.s.viewer) this.input.issueWorld('SandboxClear', { player: p.index }); this.audio.play('select'); });
    $('grounds-close').addEventListener('click', () => this.toggleGrounds(false));
  }
  spawnHostile(faction, types) {
    const p = this.world.players.find((x) => x.faction === faction), forge = this.forge();
    if (!p || !forge) return;
    const f = this.s.orbit.focusT;
    let dx = f.x / R - forge.x, dy = f.z / R - forge.y;
    let d = Math.hypot(dx, dy);
    if (d < 4 * CELL) { const yaw = this.s.orbit.yaw; dx = -Math.cos(yaw); dy = -Math.sin(yaw); d = 1; }
    const out = Math.max(d, 8 * CELL) + 30 * CELL, b = this.world.bounds;
    const at = [Math.round(forge.x + (dx / d) * out), Math.round(forge.y + (dy / d) * out), Math.round(f.y / R)]
      .map((v, i) => Math.max([b.x0, b.y0, b.z0][i] + 2 * CELL, Math.min([b.x1, b.y1, b.z1][i] - 2 * CELL, v)));
    this.input.issueWorld('SandboxSpawn', { player: p.index, types, at, attack: [forge.x, forge.y, forge.z] });
    this.toast(`${types.length} hostile${types.length > 1 ? 's' : ''} inbound`, 'bad');
    this.audio.play('alert');
  }
  spawnOwn(types) {
    const forge = this.forge();
    if (!forge) return;
    const ahead = forge.health.info.Radius + forge.health.info.HalfLength + 5 * CELL;
    const c = Math.cos((forge.yaw / 1024) * Math.PI * 2), s = Math.sin((forge.yaw / 1024) * Math.PI * 2);
    this.input.issueWorld('SandboxSpawn', { player: this.s.viewer.index, types, at: [Math.round(forge.x + c * ahead), Math.round(forge.y + s * ahead), forge.z] });
    this.audio.play('ready');
  }
  // The controls card tucks itself away after your first order (H brings it back).
  firstOrder() { if (!this.ordered) { this.ordered = true; if (this.helpOpen) this.toggleHelp(false); } }

  // ---------------------------------------------------------------- production panel
  forge() { return this.input.forge(); }
  queue() { const f = this.forge(); return f ? f.trait('ProductionQueue') : null; }

  // Item buttons are built once; refresh() only updates their state, so a click never lands
  // on an element that is being replaced.
  buildPanel() {
    const rules = this.world.rules, wrap = $('build-items');
    wrap.innerHTML = '';
    this.items = new Map();
    for (const info of rules.buildablesFor('Forge')) {
      const tt = info.traitInfo('Tooltip'), b = info.traitInfo('Buildable');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bi';
      btn.dataset.type = info.name;
      btn.innerHTML = `
        <span class="bi-name">${esc(tt.Name)}<span class="bi-count"></span></span>
        <span class="bi-role">${esc(tt.Role)}</span>
        <span class="bi-stats"><span class="bi-ore" title="Ore">${fmtNum(info.traitInfo('Valued').Cost)}</span><span title="Build time">${fmtTime(b.BuildDuration)}</span><span title="Fleet capacity">cap ${info.traitInfo('ConsumesCapacity')?.Amount || 0}</span></span>
        <span class="bi-why"></span>`;
      btn.title = `${tt.Name}: ${tt.Description}`;
      // blur after a click so Space/Enter can't queue it again by accident
      btn.addEventListener('click', (e) => { this.queueShip(info.name, e.shiftKey ? 5 : 1); btn.blur(); });
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this.dequeueShip(info.name); });
      wrap.appendChild(btn);
      this.items.set(info.name, btn);
    }
    $('build-queue').addEventListener('click', (e) => {
      const el = e.target.closest('[data-i]');
      const f = this.forge();
      if (el && f) { this.input.issue('CancelProduction', [f], null, +el.dataset.i); this.audio.play('select'); }
    });
    $('build-close').addEventListener('click', () => this.toggleBuild(false));
    $('btn-rally').addEventListener('click', () => this.input.beginMove('rally'));
    $('btn-rally-clear').addEventListener('click', () => { const f = this.forge(); if (f) { this.input.issue('ClearRallyPoint', [f]); this.audio.play('select'); } });
    $('build-forge').addEventListener('click', () => this.input.selectForge());
  }

  queueShip(type, n) {
    const f = this.forge(), q = this.queue();
    if (!f || !q) return;
    const why = q.canQueue(type);
    if (why) { this.toast(why, 'bad'); this.audio.play('error'); return; }
    for (let i = 0; i < n; i++) this.input.issue('StartProduction', [f], null, type);
    this.audio.play('order');
    this.firstOrder();
  }
  // Right-click a hull: take the last one of that type off the queue (refunded).
  dequeueShip(type) {
    const f = this.forge(), q = this.queue();
    if (!f || !q) return;
    const i = q.queue.lastIndexOf(type);
    if (i >= 0) { this.input.issue('CancelProduction', [f], null, i); this.audio.play('select'); }
  }

  refreshBuild() {
    const q = this.queue(), f = this.forge();
    $('build-none').hidden = !!q;
    $('build-body').hidden = !q;
    if (!q) return;
    const counts = {};
    for (const t of q.queue) counts[t] = (counts[t] || 0) + 1;
    for (const [type, btn] of this.items) {
      const why = q.canQueue(type);
      btn.classList.toggle('blocked', !!why);
      btn.setAttribute('aria-disabled', String(!!why));
      btn.querySelector('.bi-why').textContent = why || '';
      btn.querySelector('.bi-count').textContent = counts[type] ? ` ×${counts[type]}` : '';
    }
    // the queue list is rebuilt only when its contents change
    const sig = q.queue.join(',');
    if (sig !== this.queueSig) {
      this.queueSig = sig;
      $('build-queue').innerHTML = q.queue.map((t, i) => {
        const name = this.world.rules.actor(t).traitInfo('Tooltip').Name;
        return `<li><button type="button" class="qi${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Cancel ${esc(name)} and refund it" title="Cancel and refund">
          <span class="qi-name">${esc(name)}</span><span class="qi-bar"><i></i></span><span class="qi-x" aria-hidden="true">×</span></button></li>`;
      }).join('');
      $('queue-empty').hidden = q.queue.length > 0;
    }
    let total = -q.progress;
    for (const t of q.queue) total += q.duration(t);
    $('queue-eta').textContent = q.queue.length ? `${q.queue.length} of ${q.info.MaxQueue} · done in ${fmtTime(Math.max(0, total))}` : `0 of ${q.info.MaxQueue}`;
    const rally = f.trait('RallyPoint')?.point;
    $('btn-rally-clear').disabled = !rally;
    $('rally-state').textContent = rally ? `Rally point ${fmtDist(Math.hypot(rally.x - f.x, rally.y - f.y, rally.z - f.z))} from the Forge` : 'No rally point: new ships wait beside their bay';
  }
  // Progress bar of the item being built, every frame.
  drawProgress() {
    const q = this.queue();
    const bar = document.querySelector('#build-queue .qi.active .qi-bar i');
    if (!q || !bar || !q.queue.length) return;
    bar.style.width = `${Math.min(100, (q.progress / q.duration(q.queue[0])) * 100)}%`;
  }

  // ---------------------------------------------------------------- toasts
  toast(text, kind = 'info') {
    const now = performance.now();
    const same = this.toasts.find((t) => t.text === text && t.until > now);
    if (same) { same.count++; same.until = now + 3500; same.el.querySelector('.n').textContent = `×${same.count}`; return; }
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span>${esc(text)}</span><span class="n"></span>`;
    $('toasts').appendChild(el);
    this.toasts.push({ text, el, count: 1, until: now + 3500 });
    while (this.toasts.length > 4) this.toasts.shift().el.remove();
  }
  tickToasts() {
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => { if (t.until > now) return true; t.el.remove(); return false; });
  }
  consumeEvents(events) {
    const me = this.s.viewer.index;
    for (const e of events) {
      if (e.t === 'notify' && e.player === me) { this.toast(e.text, e.kind); if (e.kind === 'bad') this.audio.play('error'); }
      else if (e.t === 'deposit' && e.owner === me) {
        this.deposits.push([e.frame, e.amount]);
        const el = $('res-ore');
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
        this.audio.play('deposit');
        this.dirty = true;
      } else if (e.t === 'ready' && e.owner === me) {
        this.toast(`${this.world.rules.actor(e.type).traitInfo('Tooltip').Name} launched`, 'good');
        this.audio.play('ready');
        this.dirty = true;
      } else if (e.t === 'fire' && e.report) this.audio.play(e.report, this.near(e) * 0.8);
      else if (e.t === 'impact' && e.missile) this.audio.play('boom', this.near(e) * 0.6);
      else if (e.t === 'killed') {
        const big = (e.radius || 0) > 600;
        this.audio.play(big ? 'boom-big' : 'boom', Math.max(this.near(e), e.owner === me ? 0.5 : 0));
        if (e.owner === me && e.type !== 'wreck') {
          this.toast(`${this.world.rules.actor(e.type).traitInfo('Tooltip').Name} lost`, 'bad');
          this.dirty = true;
        }
      }
    }
  }
  // How loud a sound at an event's position is: 1 close to the camera, fading to 0 far away.
  near(e) {
    const c = this.s.camera.position;
    const d = Math.hypot(e.x * R - c.x, e.z * R - c.y, e.y * R - c.z);
    return Math.max(0, Math.min(1, 1.25 - d / 260));
  }

  // ---------------------------------------------------------------- panels
  refresh() {
    const p = this.s.viewer;
    $('res-ore').textContent = fmtNum(p.resources.cash);
    // ore delivered over the last minute of game time
    const since = this.world.frame - 60 * TICKS_PER_S;
    while (this.deposits.length && this.deposits[0][0] < since) this.deposits.shift();
    const rate = this.deposits.reduce((s, d) => s + d[1], 0);
    $('res-rate').textContent = rate ? `+${fmtNum(rate)}/min` : '';
    const used = p.capacity.used(), cap = p.capacity.cap();
    $('res-cap').textContent = `${used} / ${cap}`;
    $('res-cap').classList.toggle('full', used >= cap);
    const rallyMode = !!this.input.move && this.input.move.mode === 'rally';
    $('move-hint').hidden = !this.input.move;
    $('move-title').textContent = rallyMode ? 'Rally point' : 'Plot course';
    $('move-hint').classList.toggle('rally', rallyMode);
    if (this.buildOpen) this.refreshBuild();
    this.refreshFleet();
    if (this.groundsOpen) {
      const hostiles = this.world.actors.filter((a) => a.health && !a.dead && p.isEnemy(a.owner)).length;
      $('pg-count').textContent = hostiles ? `${hostiles} hostile${hostiles > 1 ? 's' : ''} in the area` : 'No hostiles in the area';
    }
    this.renderer.showRally = this.buildOpen || rallyMode || this.input.selection.some((a) => a.has('ProductionQueue'));

    const sel = this.input.selection.filter((a) => !a.dead);
    const card = $('sel');
    if (!sel.length) { card.hidden = true; return; }
    card.hidden = false;
    if (sel.length === 1 && sel[0].asteroid) {
      const t = sel[0].asteroid, field = this.world.fields[t.field];
      $('sel-name').textContent = 'Asteroid';
      $('sel-class').textContent = field ? `Ore body · ${field.name}` : 'Ore body';
      $('sel-desc').textContent = this.input.own().some((s) => s.collector) ? 'Right-click it with Gleaners selected to mine it.' : 'Select Gleaners, then right-click it to mine it.';
      $('sel-status').textContent = '';
      $('sel-stats').innerHTML = [
        ['Ore', `${fmtNum(t.ore)} / ${fmtNum(t.maxOre)}`],
        ['Size', `${fmtNum(t.radius() * 2 * M_PER_UNIT)} m`],
        ...(field ? [['Field ore', fmtNum(fieldOre(field))]] : []),
      ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      return;
    }
    if (sel.length === 1 && sel[0].wreck) {
      const k = sel[0].wreck, of = this.world.rules.actors.get(k.of)?.traitInfo('Tooltip')?.Name || 'ship';
      $('sel-name').textContent = 'Wreck';
      $('sel-class').textContent = `Derelict · was a ${of}`;
      $('sel-desc').textContent = 'Dead and drifting. Salvage crews will be able to cut it apart (Milestone 6).';
      $('sel-status').textContent = '';
      $('sel-stats').innerHTML = [['Salvage', fmtNum(k.salvage)], ['Size', `${fmtNum(k.radius() * 2 * M_PER_UNIT)} m`]]
        .map(([k2, v]) => `<div><dt>${k2}</dt><dd>${v}</dd></div>`).join('');
      return;
    }
    if (sel.length === 1) {
      const a = sel[0], tt = a.info.traitInfo('Tooltip'), f = a.mobile, q = a.trait('ProductionQueue');
      const speed = f ? Math.round(f.speed * TICKS_PER_S * M_PER_UNIT) : 0;
      const heading = Math.round((a.yaw / 1024) * 360);
      let status = 'Holding';
      if (a.activity) status = a.activity.label === 'Moving' ? 'Under way' : a.activity.label;
      else if (f && f.speed > 0) status = 'Coasting';
      $('sel-name').textContent = tt.Name;
      $('sel-class').textContent = a.owner === p ? `${tt.Class} · ${tt.Role}` : `${this.world.factions.get(a.owner.faction)?.Name || a.owner.name} · ${tt.Role}`;
      $('sel-desc').textContent = tt.Description;
      const stats = [
        ['Speed', `${speed} m/s`],
        ['Altitude', fmtAlt(a.z)],
        ['Heading', `${String(heading).padStart(3, '0')}°`],
        ['Hull', `${Math.ceil((a.health.hp / a.health.maxHp) * 100)}%`],
      ];
      if (a.collector) {
        const c = a.collector;
        if (!a.activity && !c.auto) status = 'Holding (right-click a rock to mine)';
        stats.push(['Hold', `${c.cargo} / ${c.info.Capacity} ore`]);
      }
      const crew = a.info.traitInfo('Crew');
      if (crew && crew.Count) stats.push(['Crew', `${crew.Count} ${crew.Count === 1 ? crew.Role.replace(/s$/, '') : crew.Role}`]);
      const dropoff = a.trait('OreDropoff');
      if (dropoff) stats.push(['Docked', `${dropoff.slots.filter(Boolean).length} of ${dropoff.slots.length}`]);
      if (q) {
        const cur = q.queue[0];
        if (cur && status === 'Holding') status = 'Building';
        stats.push(['Building', cur ? `${this.world.rules.actor(cur).traitInfo('Tooltip').Name} ${Math.floor((q.progress / q.duration(cur)) * 100)}%` : 'Idle']);
      } else if (!dropoff) stats.splice(3, 0, ['Pitch', `${Math.round((a.pitch / 1024) * 360)}°`]);
      $('sel-status').textContent = status;
      $('sel-stats').innerHTML = stats.map(([k, v]) => `<div${k === 'Building' || k === 'Hold' ? ' class="wide"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    } else {
      const counts = {};
      for (const a of sel) { const n = a.info.traitInfo('Tooltip').Name; counts[n] = (counts[n] || 0) + 1; }
      $('sel-name').textContent = `${sel.length} ships`;
      $('sel-class').textContent = Object.entries(counts).map(([n, c]) => `${c} × ${n}`).join(' · ');
      $('sel-desc').textContent = '';
      $('sel-status').textContent = sel.some((a) => a.activity) ? 'Under way' : 'Holding';
      const z = sel.reduce((s, a) => s + a.z, 0) / sel.length;
      const cargo = sel.filter((a) => a.collector).reduce((s, a) => s + a.collector.cargo, 0);
      $('sel-stats').innerHTML = `<div><dt>Mean altitude</dt><dd>${fmtAlt(z)}</dd></div>` + (sel.some((a) => a.collector) ? `<div><dt>Ore aboard</dt><dd>${fmtNum(cargo)}</dd></div>` : '');
    }
  }

  // ---------------------------------------------------------------- overlay
  drawBrackets(ctx, v, color, strong) {
    const inp = this.input;
    const p = inp.project(v.pos);
    if (p.z > 1) return null;
    const r = Math.max(9, inp.screenRadius(v.pos, v.radius) * 1.15);
    const l = Math.max(4, Math.min(r * 0.38, 26));
    ctx.strokeStyle = color; ctx.lineWidth = strong ? 1.6 : 1;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = p.x + sx * r, cy = p.y + sy * r;
      ctx.moveTo(cx, cy - sy * l); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * l, cy);
    }
    ctx.stroke();
    return { p, r };
  }

  draw() {
    const ctx = this.ctx, inp = this.input, rd = this.renderer;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    for (const a of inp.selection) {
      const v = rd.views.get(a.id);
      if (!v) continue;
      const b = this.drawBrackets(ctx, v, a.asteroid ? ORE_CSS : rd.styleOf(a.owner).css, true);
      if (!b || a.wreck) continue;
      const gn = inp.isMine(a) ? inp.groupNumberOf(a) : 0;
      if (gn) { ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillStyle = rd.styleOf(a.owner).css; ctx.fillText(String(gn), b.p.x - b.r - 2, b.p.y - b.r - 4); }
      const w = Math.max(18, Math.min(b.r * 1.4, 120));
      const bar = (y, f, color) => { ctx.fillStyle = 'rgba(5,6,11,0.7)'; ctx.fillRect(b.p.x - w / 2 - 1, y - 1, w + 2, 4); ctx.fillStyle = color; ctx.fillRect(b.p.x - w / 2, y, w * f, 2); };
      if (a.asteroid) { bar(b.p.y + b.r + 6, a.asteroid.ore / a.asteroid.maxOre, ORE_CSS); continue; }
      const f = a.health.hp / a.health.maxHp;
      bar(b.p.y + b.r + 6, f, f > 0.6 ? '#7cf2a8' : f > 0.3 ? '#ffb547' : '#ff5a64');
      if (a.collector && a.collector.cargo > 0) bar(b.p.y + b.r + 10, a.collector.cargo / a.collector.info.Capacity, ORE_CSS);
    }
    this.drawFieldLabels(ctx);
    const hv = inp.hover;
    if (hv && !inp.selection.includes(hv)) {
      const v = rd.views.get(hv.id);
      const action = inp.hoverAction(hv);
      if (v) {
        const hostile = action === 'Attack' || (hv.health && this.s.viewer.isEnemy(hv.owner));
        const col = action === 'Attack' || (!action && hostile) ? HOSTILE_CSS : action ? ORE_CSS : 'rgba(223,232,242,0.6)';
        const b = this.drawBrackets(ctx, v, col, !!action);
        if (b) {
          if (hv.health && hostile) {
            const f = hv.health.hp / hv.health.maxHp, w2 = Math.max(18, Math.min(b.r * 1.4, 120));
            ctx.fillStyle = 'rgba(5,6,11,0.7)'; ctx.fillRect(b.p.x - w2 / 2 - 1, b.p.y + b.r + 5, w2 + 2, 4);
            ctx.fillStyle = HOSTILE_CSS; ctx.fillRect(b.p.x - w2 / 2, b.p.y + b.r + 6, w2 * f, 2);
          }
          const tname = hv.info.traitInfo('Tooltip').Name;
          const name = hv.asteroid ? `Asteroid · ${fmtNum(hv.asteroid.ore)} ore`
            : hv.wreck ? `Wreck of a ${this.world.rules.actors.get(hv.wreck.of)?.traitInfo('Tooltip')?.Name || 'ship'} · ${fmtNum(hv.wreck.salvage)} salvage`
              : hostile ? `${tname} · ${this.world.factions.get(hv.owner.faction)?.Name || hv.owner.name}` : tname;
          const text = action ? `${action}: ${name}` : name;
          ctx.font = '500 11px "IBM Plex Mono", monospace';
          const tw = ctx.measureText(text).width, tx = b.p.x + b.r + 6, ty = b.p.y - b.r + 10;
          ctx.fillStyle = 'rgba(5,6,11,0.72)'; ctx.fillRect(tx - 4, ty - 11, tw + 8, 15);
          ctx.fillStyle = action === 'Attack' || hostile ? HOSTILE_CSS : action ? ORE_CSS : 'rgba(223,232,242,0.9)';
          ctx.fillText(text, tx, ty);
        }
      }
    } else if (hv && inp.hoverAction(hv)) {
      // hovering something already selected that still takes an order (e.g. the Forge with Gleaners)
      const v = rd.views.get(hv.id), b = v && inp.project(v.pos);
      if (b && b.z < 1) { ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = ORE_CSS; ctx.fillText(inp.hoverAction(hv), b.x + 12, b.y - 12); }
    }
    const box = inp.box;
    if (box && box.active) {
      ctx.strokeStyle = 'rgba(95,227,208,0.9)'; ctx.fillStyle = 'rgba(95,227,208,0.07)'; ctx.lineWidth = 1;
      ctx.fillRect(box.x, box.y, inp.mx - box.x, inp.my - box.y);
      ctx.strokeRect(box.x + 0.5, box.y + 0.5, inp.mx - box.x, inp.my - box.y);
    }
    const m = inp.move;
    if (m) {
      const dist = Math.hypot(m.dest.x - m.center.x, m.dest.y - m.center.y, m.dest.z - m.center.z) / R;
      const alt = m.dest.y / R;
      const d = inp.project(m.dest);
      if (d.z < 1) {
        const lines = [`${m.mode === 'rally' ? 'rally  ' : ''}${fmtDist(dist)}`, `alt ${fmtAlt(alt)}${Math.abs(m.height) > 0.01 ? `  (${fmtAlt(m.height / R)})` : ''}`];
        ctx.font = '500 12px "IBM Plex Mono", monospace';
        const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 14;
        // place the readout beside the marker, flipping sides to stay clear of panels and edges
        let x = d.x + 14, y = d.y - 12;
        const blocked = (bx) => bx + w > innerWidth - 8 || this.covered(bx, y, w, 38);
        if (blocked(x)) x = d.x - 14 - w;
        if (x < 8 || this.covered(x, y, w, 38)) { x = Math.max(8, Math.min(innerWidth - w - 8, d.x - w / 2)); y = d.y + 18; }
        ctx.fillStyle = 'rgba(5,6,11,0.8)'; ctx.fillRect(x, y, w, 38);
        ctx.fillStyle = m.mode === 'rally' ? '#c9a7ff' : '#5fe3d0'; ctx.fillText(lines[0], x + 7, y + 15);
        ctx.fillStyle = '#ffb547'; ctx.fillText(lines[1], x + 7, y + 31);
      }
    }
  }

  // Field names and their remaining ore, at each field's centre; they fade out as you fly in.
  drawFieldLabels(ctx) {
    const inp = this.input, cam = this.s.camera;
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const f of this.world.fields) {
      const ore = fieldOre(f);
      const pos = { x: f.x * R, y: f.z * R, z: f.y * R };
      this.tmpV ||= cam.position.clone();
      this.tmpV.set(pos.x, pos.y + (f.spread * R) / 3 + 4, pos.z);
      const p = inp.project(this.tmpV);
      if (p.z > 1) continue;
      const dist = cam.position.distanceTo(this.tmpV);
      const alpha = Math.max(0, Math.min(1, (dist - 40) / 80)) * (ore ? 0.85 : 0.4);
      if (alpha <= 0.02) continue;
      ctx.fillStyle = `rgba(217,165,119,${alpha})`;
      ctx.fillText(f.name.toUpperCase(), p.x, p.y);
      ctx.fillStyle = `rgba(223,232,242,${alpha * 0.8})`;
      ctx.fillText(ore ? `${fmtNum(ore)} ore` : 'mined out', p.x, p.y + 14);
    }
    ctx.textAlign = 'start';
  }

  // Does a screen rectangle overlap a visible HUD panel?
  covered(x, y, w, h) {
    for (const id of ['help', 'sel', 'move-hint', 'build', 'grounds', 'fleetbar']) {
      const el = $(id);
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (x < r.right && x + w > r.left && y < r.bottom && y + h > r.top) return true;
    }
    return false;
  }

  update(dt) {
    this.refreshT -= dt;
    if (this.dirty || this.refreshT <= 0) { this.refresh(); this.refreshT = 0.15; this.dirty = false; }
    if (this.buildOpen) this.drawProgress();
    this.tickToasts();
    this.draw();
  }
}
