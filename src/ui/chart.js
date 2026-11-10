import * as THREE from '../../lib/three.module.js';
import { OrbitCamera } from './camera.js';
import { SpaceScene } from '../render/space.js';
import { StarChart, chartPos, TYPE_COLORS, factionColor } from '../render/galaxy.js';
import { standingOf, tierName, hasLeave, raceStanding, TIERS } from '../galaxy/standing.js';
import * as V from '../galaxy/voyage.js';
import { laneOpen } from '../galaxy/galaxy.js';
import { ROLES, count, free } from '../galaxy/crew.js';

// The star chart screen: the galaxy map, where the voyage is planned and time passes only
// when you act. Click a place to see what is known about it and the route there; stitch,
// drift, go in, rest, repair and fit drive components from the panels.
//   Right-drag rotate   Scroll zoom   Middle-drag pan   W A S D pan   Q E rotate
//   F or Home: back to the Forge   Esc: clear the selection   Enter: the card's first action
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const fmt = (n) => (n === Infinity ? '∞' : Math.round(n).toLocaleString('en-US'));
const hex = (c) => `#${(typeof c === 'number' ? c.toString(16).padStart(6, '0') : c)}`;
const DRAG = 5;
const STORES = [['ice', 'Water', 'Ice, melted for drinking, air and growing food'], ['food', 'Food'], ['air', 'Air'], ['glim', 'Glim'], ['ore', 'Ore'], ['salvage', 'Salvage'], ['spores', 'Spores']];

export class ChartScreen {
  constructor({ canvas, camera, rules, voyage, audio, hud, onGoIn, onQuit, onChange, onEnd }) {
    Object.assign(this, { canvas, camera, rules, s: voyage, audio, hud, onGoIn, onQuit, onChange, onEnd });
    this.g = V.galaxyOf(rules, voyage);
    this.scene = new THREE.Scene();
    const B = 140 / (1 / 256);
    this.space = new SpaceScene(this.scene, { x0: -B, x1: B, y0: -B, y1: B, z0: -B / 10, z1: B / 10 }, voyage.seed, '2a1a3a', { landmarks: false, sun: false });
    this.chart = new StarChart(this.scene, this.g, rules);
    this.orbit = new OrbitCamera(camera);
    Object.assign(this.orbit, { minDist: 18, maxDist: 330, minPitch: 0.3, maxPitch: 1.4 });
    this.orbit.bounds = { x0: -135, x1: 135, y0: -10, y1: 10, z0: -135, z1: 135 };
    const here = chartPos(this.g.points[voyage.at]);
    this.orbit.focus.copy(here); this.orbit.focusT.copy(here);
    this.orbit.yaw = this.orbit.yawT = 0.7; this.orbit.pitch = this.orbit.pitchT = 0.95; this.orbit.dist = this.orbit.distT = 95;
    this.selected = voyage.at; this.hover = -1;
    this.buttons = new Map(); this.keys = new Set(); this.mx = 0; this.my = 0;
    this.tab = 'forge';
    this.listeners = [];
    this.v = new THREE.Vector3();
    this.ctx = $('overlay').getContext('2d');
    this.bind();
    document.body.classList.add('at-chart');
    $('chart').hidden = false;
    this.refresh();
  }

  on(t, ev, fn, o) { t.addEventListener(ev, fn, o); this.listeners.push([t, ev, fn, o]); }
  dispose() {
    for (const [t, e, f, o] of this.listeners) t.removeEventListener(e, f, o);
    this.chart.dispose();
    document.body.classList.remove('at-chart');
    $('chart').hidden = true; $('chart-end').hidden = true;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  // ---------------------------------------------------------------- input
  bind() {
    const c = this.canvas;
    this.on(c, 'contextmenu', (e) => e.preventDefault());
    this.on(c, 'pointerdown', (e) => { this.buttons.set(e.button, { x: e.clientX, y: e.clientY, moved: false }); });
    this.on(window, 'pointermove', (e) => {
      const dx = e.clientX - this.mx, dy = e.clientY - this.my;
      this.mx = e.clientX; this.my = e.clientY;
      for (const [b, st] of this.buttons) {
        if (Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) > DRAG) st.moved = true;
        if (!st.moved) continue;
        if (b === 2 || (b === 0 && e.altKey)) this.orbit.rotate(dx, dy);
        else if (b === 1 || b === 0) this.orbit.pan(dx, dy);
      }
      this.hover = this.pick(e.clientX, e.clientY);
      c.style.cursor = this.hover >= 0 ? 'pointer' : '';
    });
    this.on(window, 'pointerup', (e) => {
      const st = this.buttons.get(e.button);
      this.buttons.delete(e.button);
      if (!st || st.moved || e.target !== c) return;
      if (e.button === 0) {
        const id = this.pick(e.clientX, e.clientY);
        if (id >= 0) { this.select(id); if (e.detail >= 2) this.orbit.focusOn(chartPos(this.g.points[id])); }
      }
    });
    this.on(c, 'wheel', (e) => { e.preventDefault(); this.orbit.zoom(e.deltaY); }, { passive: false });
    this.on(window, 'keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (!$('chart-end').hidden) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'f' || e.key === 'Home') { this.select(this.s.at); this.orbit.focusOn(chartPos(this.g.points[this.s.at])); }
      else if (e.key === 'Escape') this.select(this.s.at);
      else if (e.key === 'Enter') { const b = $('pc-btns').querySelector('button:not(:disabled)'); if (b) b.click(); }
      else if (k === 'h' || k === '?') $('chart-help').classList.toggle('open');
    });
    this.on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    this.on(window, 'blur', () => this.keys.clear());
    this.on($('chart-tabs'), 'click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.tab = b.dataset.tab; this.refreshPanel(); } });
    this.on($('fp-body'), 'click', (e) => this.panelClick(e));
    this.on($('pc-btns'), 'click', (e) => this.cardClick(e));
    this.on($('chart-quit'), 'click', () => this.onQuit());
    this.on($('chart-helpbtn'), 'click', () => $('chart-help').classList.toggle('open'));
  }

  // The place under the mouse (screen distance, nearest first), or -1.
  pick(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    let best = -1, bd = 16 * 16;
    for (let i = 0; i < this.chart.pos.length; i++) {
      this.v.copy(this.chart.pos[i]).project(this.camera);
      if (this.v.z > 1) continue;
      const sx = (this.v.x + 1) * 0.5 * w, sy = (1 - this.v.y) * 0.5 * h, d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  select(id) {
    this.selected = id;
    this.audio.play('select');
    this.refreshCard();
    this.refreshChart();
  }

  // ---------------------------------------------------------------- actions
  act(fn, ...args) {
    const r = fn(this.rules, this.s, ...args);
    if (!r.ok) { this.hud.toast(r.why, 'bad'); this.audio.play('error'); return r; }
    this.audio.play('order');
    this.onChange(this.s);
    if (this.s.over) { this.refresh(); this.showEnd(); return r; }
    this.refresh();
    return r;
  }
  cardClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act, id = this.selected;
    if (a === 'stitch') { if (this.act(V.stitch, id).ok) { this.selected = this.s.at; this.orbit.focusOn(chartPos(this.g.points[this.s.at])); this.refresh(); this.audio.play('alert'); } }
    else if (a === 'drift') { if (this.act(V.drift, id).ok) { this.selected = this.s.at; this.refresh(); } }
    else if (a === 'rest') this.act(V.rest);
    else if (a === 'home') this.act(V.jumpHome);
    else if (a === 'go') this.onGoIn();
  }
  panelClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'repair') this.act(V.repair, b.dataset.k);
    else if (b.dataset.act === 'install') this.act(V.install, b.dataset.k);
    else if (b.dataset.act === 'home') this.act(V.jumpHome);
  }

  // ---------------------------------------------------------------- panels
  refresh() { this.refreshTop(); this.refreshCard(); this.refreshPanel(); this.refreshChart(); }

  refreshChart() {
    const s = this.s, d = V.drive(this.rules, s), t = V.target(this.rules, s);
    const open = this.g.lanes.map((l) => laneOpen(l, d));
    this.chart.update({ at: s.at, known: new Set(s.known), visited: s.visited, range: d.range, sensor: V.sensorRange(this.rules, s), veil: d.veil, signal: t ? t.at : -1, selected: this.selected, open });
    const p = this.selected >= 0 && this.selected !== s.at ? V.plan(this.rules, s, this.selected) : null;
    this.chart.setRoute(p && p.route ? [s.at, ...p.route.hops] : []);
  }

  refreshTop() {
    const s = this.s, res = this.rules.content.resources, left = V.daysLeft(this.rules, s);
    const region = this.rules.content.regions[this.g.points[s.at].region];
    $('chart-day').textContent = `Day ${s.day} · ${region.Name}`;
    const days = { ice: left.ice, food: left.food, air: left.air };
    $('chart-stores').innerHTML = STORES.map(([k, name, tip]) => {
      const d = days[k], warn = d !== undefined && d < 3 ? 'bad' : d !== undefined && d < 7 ? 'warn' : '';
      return `<div class="cs ${warn}" title="${esc(tip || res[k].Description)}"><span class="cs-k" style="color:${hex(res[k].Color)}">${name}</span><b>${fmt(s.stores[k])}</b>${d !== undefined ? `<span class="cs-d">${d === Infinity ? '' : `${fmt(d)} d`}</span>` : ''}</div>`;
    }).join('') + `<div class="cs" title="Everyone aboard, flying ships or not"><span class="cs-k">Crew</span><b>${count(s.crew)}</b></div><div class="cs ${s.morale < 30 ? 'warn' : ''}" title="Morale: below 30, work is slower; below 15, people leave"><span class="cs-k">Morale</span><b>${s.morale}</b></div>`;
  }

  refreshCard() {
    const s = this.s, id = this.selected, p = this.g.points[id], R = this.rules.content.regions[p.region], T = this.rules.content.poiTypes[p.type];
    const known = s.known.includes(id), here = id === s.at, times = s.visited[id] | 0;
    $('pc-name').textContent = known ? p.name : 'Unknown place';
    $('pc-status').textContent = here ? 'The Forge is here' : times ? `Visited${times > 1 ? ` ×${times}` : ''}` : known ? '' : 'Beyond the sensors';
    const Fo = known && p.owner ? this.rules.content.factions[p.owner] : null;
    const owned = Fo ? ` · <span style="color:${hex(factionColor(this.rules, p.owner))}">${esc(Fo.Name)}${p.seat ? '' : ' territory'}</span> <span class="t-${tierName(this.rules, standingOf(this.rules, s, p.owner))}">(${tierName(this.rules, standingOf(this.rules, s, p.owner))})</span>` : '';
    $('pc-class').innerHTML = `<i style="background:${hex(known ? TYPE_COLORS[p.type] : 0x56637a)}"></i>${esc(R.Name)}${known ? ` · ${esc(T.Name)}` : ''}${p.edge && known ? ' · the Shore\'s edge' : ''}${owned}`;
    const t = V.target(this.rules, s);
    const relic = t && t.at === id ? `The ${this.rules.content.items[t.id].Name} is aboard: cut into the hulk with Shearers to find it. ` : '';
    const claim = Fo ? (hasLeave(this.rules, s, p.owner) ? ` You have the ${Fo.Name}'s leave to mine and salvage here.` : ` Mining or salvaging here without the ${Fo.Name}'s leave costs standing, if they see it.`) : '';
    $('pc-desc').textContent = relic + (known ? T.Description : 'The sensors cannot make it out from here. Get closer to see what it is.') + (times && known ? ' Picked over: it will yield less than before.' : '') + claim;
    const stats = [], btns = [];
    let why = '';
    if (here) {
      btns.push(['go', `Go in <kbd>Enter</kbd>`, false, 'Play this place: gather, build, fight; one day passes for every four minutes there']);
      btns.push(['rest', p.type === 'StillWater' ? 'Rest a day (still water: twice the rest)' : 'Rest a day', false, 'Morale rises; the crew still eat, drink and breathe']);
      const home = V.canJumpHome(this.rules, s);
      if (V.drive(this.rules, s).finalJump) { btns.push(['home', 'Make the final jump', !home.ok, home.why || 'Home']); if (!home.ok) why = home.why; }
      const d = V.daysLeft(this.rules, s);
      const lasts = (n) => (n === Infinity ? 'steady' : `${fmt(n)} days`);
      stats.push(['Water', lasts(d.ice)], ['Food', lasts(d.food)], ['Air', lasts(d.air)]);
    } else {
      const pl = V.plan(this.rules, s, id);
      if (pl.route) {
        const r = pl.route, a = pl.arrive, use = -V.daysLeft(this.rules, s).rate.ice;
        stats.push(['Stitches', r.hops.length], ['Days', r.days], ['Glim', fmt(r.glim)], ['Distance', `${fmt(r.len)} spans`]);
        stats.push(['Glim left', fmt(Math.max(0, a.glim))], ['Water on arrival', `${use > 0 ? fmt(Math.max(0, Math.trunc(a.ice / use))) : '∞'} days`]);
        btns.push(['stitch', `Stitch there <kbd>Enter</kbd>`, !pl.ok, pl.ok ? `${r.days} days, ${r.glim} Glim` : pl.why]);
        if (!pl.ok) why = pl.why;
      } else why = pl.why;
      const dp = V.driftPlan(this.rules, s, id);
      if (dp.ok && (!pl.route || !pl.ok)) btns.push(['drift', `Drift there: ${dp.days} days, no Glim`, false, 'Sub-light, slowly; the crew still eat, drink and breathe']);
    }
    $('pc-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('pc-btns').innerHTML = btns.map(([a, label, dis, tip]) => `<button type="button" data-act="${a}" ${dis ? 'disabled' : ''} title="${esc(tip || '')}">${label}</button>`).join('');
    $('pc-why').textContent = why;
  }

  refreshPanel() {
    for (const b of $('chart-tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === this.tab));
    const s = this.s, rules = this.rules, C = rules.content;
    let h = '';
    if (this.tab === 'forge') {
      const d = V.drive(rules, s);
      h += `<h3>Skein Drive</h3><p class="fp-note">Stitches up to <b>${d.range}</b> spans${d.veil ? '; through the Veil' : '; not through the Veil'}. Condition ${s.systems.drive}%.</p><ul class="items">`;
      for (const it of Object.values(C.items)) {
        if (it.Kind !== 'drive') continue;
        const st = s.items[it.id], pl = st === 'found' ? V.installPlan(rules, s, it.id) : null, I = it.Install;
        h += `<li class="${st || 'missing'}"><div><b>${esc(it.Name)}</b><span>${st === 'installed' ? 'Fitted' : st === 'found' ? 'Aboard, not fitted' : 'Not found'}</span></div><p>${esc(it.Description)}</p>`;
        if (st === 'found') h += `<button type="button" data-act="install" data-k="${it.id}" ${pl.ok ? '' : 'disabled'} title="${esc(pl.ok ? '' : pl.why)}">Fit it: ${I.Ore} ore, ${I.Salvage} salvage, ${pl.days || I.Days} days, ${I.Engineers} engineers</button>${pl.ok ? '' : `<p class="why">${esc(pl.why)}</p>`}`;
        h += '</li>';
      }
      h += '</ul>';
      if (d.finalJump) { const hj = V.canJumpHome(rules, s); h += `<button type="button" class="big" data-act="home" ${hj.ok ? '' : 'disabled'}>Make the final jump</button>${hj.ok ? '' : `<p class="why">${esc(hj.why)}</p>`}`; }
      h += '<h3>Systems</h3><div class="sys">';
      const maxHp = rules.actor('forge').traitInfo('Health').HP;
      const rows = [['hull', 'Hull', Math.trunc((s.forge.hp * 100) / maxHp), 'The Forge\'s hull. At zero, everything ends.'], ...V.SYSTEMS.map((k) => [k, C.systems[k].Name, s.systems[k], C.systems[k].Description])];
      for (const [k, name, c, tip] of rows) {
        const rp = V.repairPlan(rules, s, k);
        h += `<div class="sr" title="${esc(tip)}"><span>${esc(name)}</span><div class="bar"><i style="width:${c}%;background:${c < 30 ? 'var(--bad)' : c < 70 ? 'var(--height)' : 'var(--accent)'}"></i></div><b>${c}%</b><button type="button" data-act="repair" data-k="${k}" ${rp.ok ? '' : 'disabled'} title="${esc(rp.ok ? `+${rp.points}% for ${rp.ore} ore and ${rp.salvage} salvage; one day` : rp.why)}">Repair</button></div>`;
      }
      h += `</div><p class="fp-note">A day of repairs uses the free engineers (${free(s.crew, 'engineers')}), ore and salvage.</p>`;
    } else if (this.tab === 'crew') {
      const m = s.morale, V2 = C.voyage;
      h += `<h3>Morale</h3><div class="sr"><span>${m < +V2.MoraleDesert ? 'Deserting' : m < +V2.MoraleSlow ? 'Low' : m < 60 ? 'Steady' : 'Good'}</span><div class="bar"><i style="width:${m}%;background:${m < 30 ? 'var(--bad)' : m < 55 ? 'var(--height)' : 'var(--good)'}"></i></div><b>${m}</b></div>`;
      h += '<p class="fp-note">Rises with rest and full stores; falls with shortages and losses. Below 30, work is slower; below 15, people take the pods and leave.</p>';
      h += `<h3>Crew: ${count(s.crew)}</h3><table class="ct"><thead><tr><th></th><th>Aboard</th><th>Flying</th><th>Free</th></tr></thead><tbody>`;
      for (const r of ROLES) h += `<tr><th>${r[0].toUpperCase() + r.slice(1)}</th><td>${s.crew.roles[r]}</td><td>${s.crew.assigned[r]}</td><td>${free(s.crew, r)}</td></tr>`;
      h += '</tbody></table><p class="fp-note">Every ship needs crew: building one takes them from the free crew. When a ship is destroyed, half its crew get away in pods.</p>';
      const fleet = s.fleet.reduce((mm, e) => { mm[e.type] = (mm[e.type] || 0) + 1; return mm; }, {});
      h += `<h3>Hangar</h3><p class="fp-note">${Object.entries(fleet).map(([t, n]) => `${n} × ${esc(rules.actor(t).traitInfo('Tooltip').Name)}`).join(', ') || 'Empty'}</p>`;
    } else if (this.tab === 'hold') {
      const f = V.forecast(rules, s), n = V.needs(rules, s), left = V.daysLeft(rules, s);
      h += `<p class="fp-note">${n.crew} crew need ${n.water} water, ${n.food} food and ${n.air} air a day. Life support makes air from water; the hydroponics grow food from water, and much faster with spores.</p><table class="ct"><thead><tr><th></th><th>Aboard</th><th>A day</th><th>Lasts</th></tr></thead><tbody>`;
      for (const [k, name] of STORES) {
        const per = k === 'ice' ? left.rate.ice : f[k], d = left[k];
        h += `<tr><th style="color:${hex(C.resources[k].Color)}">${name}</th><td>${fmt(s.stores[k])}</td><td>${per ? (per > 0 ? `+${fmt(per)}` : `−${fmt(-per)}`) : '—'}</td><td>${d === undefined || d === Infinity ? '—' : `${fmt(d)} d`}</td></tr>`;
      }
      h += '</tbody></table>';
    } else if (this.tab === 'standing') {
      const F = C.factions;
      h += '<p class="fp-note">Your standing with each faction, from −100 to 100. <span class="t-Hostile">Hostile</span> attack on sight; <span class="t-Wary">Wary</span> warn you off and fire if you linger; <span class="t-Neutral">Neutral</span> ignore you; <span class="t-Friendly">Friendly</span> turn on whoever attacks you near them; <span class="t-Allied">Allied</span> fight at your side. Firing on them, killing them and taking from their claims costs standing; fighting their enemies earns it.</p>';
      for (const f of Object.values(F)) {
        const n = standingOf(rules, s, f.id), t = tierName(rules, n), col = hex(factionColor(rules, f.id));
        const met = s.met && s.met[f.id], race = C.races[f.Race];
        const left = n < 0 ? 50 + n / 2 : 50, width = Math.abs(n) / 2;
        h += `<div class="fs"><b style="color:${col}">${esc(f.Name)}</b><span class="t t-${t}">${t}</span><div class="sbar"><i style="left:${left}%;width:${width}%;background:${n < 0 ? 'var(--bad)' : 'var(--good)'}"></i></div><p>${met ? `${n > 0 ? '+' : ''}${n}` : `Not met yet: starts at ${n}`} · ${esc(race ? race.Name : f.Race)} · ${hasLeave(rules, s, f.id) ? 'leave to mine their claims' : `leave to mine from ${esc(f.Leave || 'Friendly')}`}</p></div>`;
      }
      h += '<h3>Races</h3><table class="ct"><tbody>';
      for (const r of Object.values(C.races)) { const n = raceStanding(rules, s, r.id); h += `<tr><th>${esc(r.Name)}</th><td class="t-${tierName(rules, n)}">${tierName(rules, n)}</td><td>${n}</td></tr>`; }
      h += '</tbody></table><p class="fp-note">A faction you have not met starts where you stand with its race: the average over that race\'s factions you have met.</p>';
      void TIERS;
    } else {
      h += '<ol class="log">' + s.log.slice(-60).reverse().map((l) => `<li class="${l.kind}"><span>Day ${l.day}</span>${esc(l.text)}</li>`).join('') + '</ol>';
    }
    $('fp-body').innerHTML = h;
  }

  showEnd() {
    const s = this.s, won = s.won;
    $('ce-title').textContent = won ? 'Home' : 'The voyage ends';
    $('ce-text').textContent = s.over.text;
    const fitted = Object.values(s.items).filter((v) => v === 'installed').length;
    $('ce-stats').innerHTML = [['Days', s.day], ['Places visited', Object.keys(s.visited).length], ['Crew', count(s.crew)], ['Drive parts fitted', `${fitted} of 4`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('chart-end').hidden = false;
    $('ce-new').onclick = () => this.onEnd('new');
    $('ce-title-btn').onclick = () => this.onEnd('title');
    this.audio.play(won ? 'deposit' : 'alert');
  }

  // ---------------------------------------------------------------- per frame
  frame(dt, renderer) {
    const k = this.keys, o = this.orbit;
    if (k.has('w') || k.has('arrowup')) o.panPlane(0, dt * 60);
    if (k.has('s') || k.has('arrowdown')) o.panPlane(0, -dt * 60);
    if (k.has('a') || k.has('arrowleft')) o.panPlane(-dt * 60, 0);
    if (k.has('d') || k.has('arrowright')) o.panPlane(dt * 60, 0);
    if (k.has('q')) o.rotate(-dt * 300, 0);
    if (k.has('e')) o.rotate(dt * 300, 0);
    o.update(dt);
    this.space.update(this.camera, renderer.getPixelRatio());
    const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.chart.setScale(scale);
    this.chart.frame(dt, this.camera);
    renderer.render(this.scene, this.camera);
    this.drawLabels();
    this.hud.tickToasts();
  }

  drawLabels() {
    const ctx = this.ctx, dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = this.s, d = V.drive(this.rules, s), here = this.g.points[s.at], t = V.target(this.rules, s);
    const known = new Set(s.known);
    const proj = (p) => { this.v.copy(chartPos(p)).project(this.camera); return this.v.z > 1 ? null : { x: (this.v.x + 1) * 0.5 * w, y: (1 - this.v.y) * 0.5 * h }; };
    // region names, on the far side of each ring
    ctx.textAlign = 'center';
    ctx.font = '600 11px "IBM Plex Sans", sans-serif';
    for (const R of Object.values(this.rules.content.regions)) {
      const [r0, r1] = String(R.Ring).split(',').map(Number), rm = (r0 + r1) / 2;
      const a = -Math.PI / 2 + 0.35;
      const q = proj({ x: Math.cos(a) * rm, y: Math.sin(a) * rm, z: 0 });
      if (!q) continue;
      ctx.fillStyle = `${hex(R.Color)}99`;
      ctx.fillText(R.Name.toUpperCase().split('').join(' '), q.x, q.y);
    }
    // place names: here, the selection, the hover, the signal, and known places within reach
    const label = (id, strong) => {
      const p = this.g.points[id], q = proj(p);
      if (!q || q.x < -50 || q.x > w + 50 || q.y < -20 || q.y > h + 20) return;
      const k = known.has(id);
      ctx.font = strong ? '600 12px "IBM Plex Sans", sans-serif' : '11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = strong ? '#dfe8f2' : k ? 'rgba(200,214,230,0.62)' : 'rgba(130,146,170,0.5)';
      ctx.fillText(k ? p.name : '?', q.x, q.y - (strong ? 13 : 9));
    };
    const r2 = d.range * d.range, shown = new Set([s.at, this.selected, this.hover, t ? t.at : -1]);
    if (this.orbit.dist < 200) for (const p of this.g.points) if (!shown.has(p.id) && (p.x - here.x) ** 2 + (p.y - here.y) ** 2 <= r2 * 1.1) label(p.id, false);
    for (const id of shown) if (id >= 0) label(id, true);
    if (t && t.at >= 0) {
      const q = proj(this.g.points[t.at]);
      if (q) { ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.fillStyle = '#ffd778'; ctx.fillText(this.rules.content.items[t.id].Name.toUpperCase(), q.x, q.y + 30); }
    }
  }
}
