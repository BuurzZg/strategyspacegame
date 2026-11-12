import * as THREE from '../../lib/three.module.js';
import { OrbitCamera } from './camera.js';
import { StarChart, chartPos, typeColor, factionColor } from '../render/galaxy.js';
import { standingOf, tierName, hasLeave, raceStanding, TIERS } from '../galaxy/standing.js';
import * as CM from '../galaxy/comms.js';
import * as V from '../galaxy/voyage.js';
import { laneOpen } from '../galaxy/galaxy.js';
import { ROLES, count, free, titleOf } from '../galaxy/crew.js';
import * as B from '../galaxy/base.js';
import * as Wd from '../galaxy/wound.js';
import { gauge, medal, causeIcon } from './instruments.js';

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
const STORES = [['ice', 'Water', 'Ice, melted for drinking, air and growing food'], ['food', 'Food'], ['air', 'Air'], ['glim', 'Glim', 'Glim: the drive burns it for every stitch, and the boilers every day'], ['ore', 'Ore'], ['salvage', 'Salvage'], ['spores', 'Spores'], ['cogmarks', 'Cogmarks']];
const MOOD = { content: 'Content', uneasy: 'Uneasy', angry: 'Angry' };
// The crew's mood as a medallion, with what is behind it (and All hands, while it lasts)
// (Milestone 23: an enamel medallion with a face, the word, morale, and a stamped icon per cause)
function moodBadge(rules, s) {
  const m = B.moodOf(rules, s), ah = (s.allHands && s.allHands.days) | 0;
  const tip = `Morale ${s.morale}. ${m.causes.length ? m.causes.map((c) => c.text).join(' ') : 'Nothing is wrong.'}`;
  const chips = m.causes.map((c) => causeIcon(c.id, c.text)).join('');
  return `<div class="cs mood m-${m.mark}${ah ? ' allhands' : ''}" title="${esc(tip)}">${medal(m.mark, 38)}<span class="mood-txt"><span class="cs-k">${ah ? `All hands · ${ah} d` : MOOD[m.mark]}</span><b>${s.morale}</b></span><span class="causes">${chips}</span></div>`;
}
const STATE = { online: 'Online', dim: 'Dim', dark: 'Dark', striking: 'On strike', cold: 'Cold' };
// The Mainspring's attention as a word (from Noticed on; the sensors officer's reading)
function attentionBadge(rules, s) {
  const a = Wd.attention(rules, s);
  if (a.index < 1) return '';
  return `<div class="cs att a-${a.id}" title="${esc(`The Mainspring's attention: ${a.name}. ${a.text}`)}"><span class="medal"></span><span class="cs-k">The Wound</span><b>${a.name}</b></div>`;
}

export class ChartScreen {
  constructor({ canvas, camera, rules, voyage, audio, hud, comms, loom, bridge, hint, onGoIn, onQuit, onChange, onEnd, onSave, onNarrate }) {
    Object.assign(this, { canvas, camera, rules, s: voyage, audio, hud, comms, loom, bridge, hint: hint || (() => {}), onGoIn, onQuit, onChange, onEnd, onSave, onNarrate });
    this.onLoom = () => this.openLoom();
    this.g = V.galaxyOf(rules, voyage);
    this.scene = new THREE.Scene();
    // the chart table: dark oak under the parchment (Milestone 23)
    this.scene.background = new THREE.Color(0x17110b);
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
    this.pumpEvents();
  }

  // Events waiting in the voyage's queue, one at a time; when the voyage has ended, the end
  // screen comes after them.
  pumpEvents() {
    const s = this.s, rules = this.rules;
    if (!this.comms || this.comms.isOpen) return;
    if (this.showMuster()) return; // perks to pick, or more ships than berths: first things first
    if (!s.queue || !s.queue.length) { if (s.over && $('chart-end').hidden) { if (s.won && this.onNarrate && !this.narrated) { this.narrated = true; this.onNarrate(() => this.showEnd()); } else this.showEnd(); } else if (!s.over) { this.hint('chart'); if (Object.keys((s.campaign && s.campaign.memories) || {}).length) this.hint('memory'); } return; }
    const ev = rules.content.events[s.queue[0]];
    if (!ev) { s.queue.shift(); this.pumpEvents(); return; }
    this.comms.open({
      title: ev.Title, dialog: ev, start: ev.Start,
      context: () => V.eventContext(rules, s, this.g, ev),
      apply: (effects) => { const r = V.eventChoice(rules, s, effects); this.onChange(s); this.refresh(); return r; },
      trade: null,
      onClose: () => { s.queue.shift(); this.onChange(s); this.refresh(); this.pumpEvents(); },
    });
  }

  on(t, ev, fn, o) { t.addEventListener(ev, fn, o); this.listeners.push([t, ev, fn, o]); }
  dispose() {
    for (const [t, e, f, o] of this.listeners) t.removeEventListener(e, f, o);
    this.chart.dispose();
    document.body.classList.remove('at-chart');
    $('chart').hidden = true; $('chart-end').hidden = true;
    if (this.loom) this.loom.close();
    if (this.bridge) this.bridge.close();
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
      if (this.loom && this.loom.isOpen) { if (this.loom.key(e.key)) e.preventDefault(); return; }
      if (this.bridge && this.bridge.isOpen) { if (this.bridge.key(e.key)) e.preventDefault(); return; }
      if (this.comms && this.comms.isOpen) { if (this.comms.key(e.key)) e.preventDefault(); return; }
      const k = e.key.toLowerCase();
      if (k === 'l') { this.openLoom(); return; }
      if (k === 'b') { this.openBridge(); return; }
      if (k === 'c' && this.g.points[this.s.at].trader) { this.tradeWith(); return; }
      if (k === 'c' && this.g.points[this.s.at].owner) { this.hail(this.g.points[this.s.at].owner); return; }
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
    this.on($('chart-save'), 'click', () => { if (this.onSave) this.onSave(); });
    $('chart-save').hidden = true; // one campaign save (named saves went with Milestone 14)
    $('chart-quit').textContent = 'Save and quit';
    this.on($('chart-helpbtn'), 'click', () => $('chart-help').classList.toggle('open'));
    const Hz = Object.values(this.rules.content.hazards || {});
    $('chart-hazards').innerHTML = Hz.length ? `Lanes into hazard pockets: ${Hz.map((h) => `<span style="color:#${esc(h.Color)}">${esc(h.Name)}</span>`).join(', ')}. Nothing gets through until you remember what does.` : '';
    this.on($('chart-loombtn'), 'click', () => this.openLoom());
    this.on($('mu-body'), 'click', (e) => { const b = e.target.closest('button[data-perk]'); if (!b) return; const r = V.choosePerk(this.rules, this.s, +b.dataset.i, b.dataset.perk); if (r.ok) { this.audio.play('rankup'); this.onChange(this.s); } this.refresh(); this.showMuster(); });
    this.on($('mu-body'), 'change', () => this.musterCheck());
    this.on($('mu-ok'), 'click', () => { const r = V.muster(this.rules, this.s, this.musterFate()); if (!r.ok) { this.hud.toast(r.why, 'bad'); this.audio.play('error'); return; } this.audio.play('order'); this.onChange(this.s); this.refresh(); if (!this.showMuster()) this.pumpEvents(); });
    this.on($('chart-bridgebtn'), 'click', () => this.openBridge());
  }

  // The memory tree, over the chart.
  // ---------------------------------------------------------------- the muster (PLAN.md §7)
  // Pilots at a perk level pick a perk; when more ships came aboard than the hangar berths,
  // choose for each left over: scrap it or leave it adrift. Returns true while it is showing.
  showMuster() {
    const s = this.s, rules = this.rules, offers = s.fleet.map((e, i) => [e, i]).filter(([e]) => e.offer);
    if (!offers.length && !s.muster) { $('muster').hidden = true; return false; }
    const name = (e) => rules.actor(e.type).traitInfo('Tooltip').Name, lead = (e) => (e.lead ? s.crew.people.find((p) => p.id === e.lead) : null);
    let h = '';
    if (offers.length) {
      $('mu-title').textContent = 'A perk';
      h += offers.map(([e, i]) => `<div class="perk-ship"><p><b>${esc(lead(e) ? `${titleOf(rules, lead(e))} ${lead(e).name}` : 'The pilot')}</b> of the ${esc(name(e))} is ${esc(V.rankName(rules, e.xp))} now, and picks a perk:</p><div class="perks">${e.offer.map((k) => `<button type="button" data-i="${i}" data-perk="${k}"><b>${esc(rules.content.crew.perks[k].Name)}</b><span>${esc(rules.content.crew.perks[k].Text)}</span></button>`).join('')}</div></div>`).join('');
      $('mu-ok').hidden = true; $('mu-why').textContent = '';
    } else {
      const berths = V.berthsOf(rules, s);
      $('mu-title').textContent = 'The muster';
      h += `<p>${s.fleet.length} ships came aboard, and the hangar berths ${berths}. Choose who continues. A ship scrapped gives back half its ore, and its crew move into the Forge; one left adrift is lost, with everyone aboard.</p><table><thead><tr><th>Ship</th><th>Level</th><th>Hull</th><th>Lead</th><th></th></tr></thead><tbody>`;
      s.fleet.forEach((e, i) => {
        const ore = Math.trunc((+rules.actor(e.type).traitInfo('Valued').Cost * +rules.content.voyage.ScrapPct) / 100), l = lead(e);
        h += `<tr><td>${esc(name(e))}</td><td>${V.levelOf(rules, e)}</td><td>${Math.trunc(((e.hp | 0) * 100) / V.shipMaxHp(rules, e, s))}%</td><td>${l ? esc(l.name) : '—'}</td><td><select data-i="${i}"><option value="keep">Keep</option><option value="scrap">Scrap: +${ore} ore</option><option value="adrift">Leave adrift</option></select></td></tr>`;
      });
      h += '</tbody></table>';
      $('mu-ok').hidden = false;
    }
    $('mu-body').innerHTML = h;
    $('muster').hidden = false;
    if (!offers.length) this.musterCheck();
    return true;
  }
  musterFate() { const f = {}; for (const sel of $('mu-body').querySelectorAll('select[data-i]')) f[+sel.dataset.i] = sel.value; return f; }
  musterCheck() { const p = V.musterPlan(this.rules, this.s, this.musterFate()); $('mu-ok').disabled = !p.ok; $('mu-why').textContent = p.ok ? (p.ore ? `Scrap: +${p.ore} ore.` : '') : p.why; }

  openLoom() { if (this.loom && !(this.comms && this.comms.isOpen)) this.loom.open(this.s, { onChange: () => { this.onChange(this.s); this.refresh(); } }); }
  openBridge() {
    if (!this.bridge || (this.comms && this.comms.isOpen)) return;
    this.bridge.open(this.s, {
      onChange: () => { this.onChange(this.s); this.refresh(); this.pumpEvents(); },
      onLoom: () => this.openLoom(),
      onLetGo: () => { if (window.confirm('Let this life go? You will wake again at the start, and the chart keeps what you found. Everything else is lost.')) this.act(V.letGo); },
    });
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
    if (id !== this.s.at) this.hint('place');
    // picking a place a hazard keeps closed: the Forge is turned away (the memory can be recalled now)
    const seen = ((this.s.campaign && this.s.campaign.hazards) || []).length;
    if (id !== this.s.at && V.turnedAway(this.rules, this.s, id) && this.s.campaign.hazards.length > seen) { this.onChange(this.s); this.refreshPanel(); this.hint('hazard'); }
    this.audio.play('select');
    this.refreshCard();
    this.refreshChart();
  }

  // ---------------------------------------------------------------- actions
  act(fn, ...args) {
    const was = (this.s.allHands && this.s.allHands.days) | 0;
    const r = fn(this.rules, this.s, ...args);
    if (!r.ok) { this.hud.toast(r.why, 'bad'); this.audio.play('error'); return r; }
    this.audio.play('order');
    // All hands: every lamp gold at once, the bell and the organ
    if (!was && this.s.allHands && this.s.allHands.days) { this.hud.toast('All hands! Every station is green.', 'good'); this.audio.play('allhands'); }
    this.onChange(this.s);
    this.refresh();
    this.pumpEvents();
    return r;
  }
  cardClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act, id = this.selected;
    if (a === 'stitch') { if (this.act(V.stitch, id).ok) { this.selected = this.s.at; this.orbit.focusOn(chartPos(this.g.points[this.s.at])); this.refresh(); this.audio.play('stitch'); } }
    else if (a === 'drift') { if (this.act(V.drift, id).ok) { this.selected = this.s.at; this.refresh(); } }
    else if (a === 'rest') this.act(V.rest);
    else if (a === 'scan') this.act(V.scan);
    else if (a === 'home') this.act(V.jumpHome);
    else if (a === 'go') { if (this.s.muster) { this.showMuster(); return; } this.onGoIn(); }
    else if (a === 'hailfar') this.hail(this.g.points[id].owner, true);
    else if (a === 'trade') this.tradeWith();
    else if (a === 'drifters') this.act(V.takeDrifters);
    else if (a === 'hail') { const h = V.canHail(this.rules, this.s); if (h.ok) this.hail(this.g.points[this.s.at].owner); else { this.hud.toast(h.why, 'bad'); this.audio.play('error'); } }
  }
  // Talk to the faction that holds the Forge's place: their dialog, trade and hiring.
  // A regional trader (traders.yaml): their own dialog and stock, at your standing with their faction.
  tradeWith() {
    const s = this.s, g = this.g, rules = this.rules, id = g.points[s.at].trader, T = rules.content.traders[id];
    if (!this.comms || !T || s.over) return;
    const h = V.canHail(rules, s);
    if (!h.ok) { this.hud.toast(h.why, 'bad'); this.audio.play('error'); return; }
    const d = rules.content.dialogs[T.Dialog], fid = T.Faction;
    this.comms.open({
      fid, who: `${T.Name}${T.Keeper ? ` · ${T.Keeper}` : ''}`, start: d.Start,
      context: () => ({ ...CM.chartContext(rules, s, g, fid), station: true, dialog: d }),
      apply: (effects) => { const r = V.hailEffects(rules, s, fid, effects); this.onChange(s); this.refresh(); return r; },
      trade: { s, pointId: s.at, trader: id, deal: (buy, sell) => V.traderDeal(rules, s, buy, sell), onDeal: () => { this.onChange(s); this.refresh(); } },
      onClose: () => { this.refresh(); this.pumpEvents(); },
    });
  }
  // far: across a lane, by long-range hails: talk, but no trade or hiring at that distance
  hail(fid, far = false) {
    if (!this.comms || !fid || this.s.over) return;
    const s = this.s, g = this.g, rules = this.rules;
    this.comms.open({
      fid,
      context: () => ({ ...CM.chartContext(rules, s, g, fid), ...(far ? { station: false } : {}) }),
      apply: (effects) => { const r = V.hailEffects(rules, s, fid, effects); this.onChange(s); this.refresh(); return r; },
      trade: far ? null : { s, pointId: s.at, onDeal: () => { this.onChange(s); this.refresh(); } },
      onClose: () => { this.refresh(); this.pumpEvents(); },
    });
  }
  panelClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    // iron work clanks
    if (b.dataset.act === 'repair') { if (this.act(V.repair, b.dataset.k).ok) this.audio.play('clank'); }
    else if (b.dataset.act === 'install') { if (this.act(V.install, b.dataset.k).ok) this.audio.play('clank'); }
    else if (b.dataset.act === 'strip' && window.confirm('Strip this room out? Nothing comes back, and it takes a day.')) { if (this.act(V.strip, b.dataset.k).ok) this.audio.play('clank'); }
    else if (b.dataset.act === 'parley') this.act(V.parley, b.dataset.k);
    else if (b.dataset.act === 'home') this.act(V.jumpHome);
    else if (b.dataset.act === 'loom' && this.onLoom) this.onLoom();
    else if (b.dataset.act === 'bridge') this.openBridge();
    else if (b.dataset.act === 'letgo' && window.confirm('Let this life go? You will wake again at the start, and the chart keeps what you found. Everything else is lost.')) this.act(V.letGo);
  }

  // ---------------------------------------------------------------- panels
  refresh() { this.refreshTop(); this.refreshCard(); this.refreshPanel(); this.refreshChart(); }

  refreshChart() {
    const s = this.s, d = V.drive(this.rules, s), t = V.target(this.rules, s);
    const open = this.g.lanes.map((l) => laneOpen(l, d));
    const radar = V.remembers(s, 'radar'), clues = (s.campaign && s.campaign.chart.clues) || [];
    // the gold ring marks a place the sensors have pinpointed (an exact clue); a circle, one they haven't
    const exact = clues.find((c) => c.exact && !V.anchorDone(this.rules, s, c.id));
    this.chart.update({ at: s.at, known: new Set(s.known), visited: s.visited, before: new Set((s.campaign && s.campaign.chart.visited) || []), range: d.range, sensor: radar ? V.sensorRange(this.rules, s) : 0, veil: d.veil, signal: exact ? exact.at : -1, selected: this.selected, open, dark: !radar, hazards: d.hazards });
    this.chart.setClues(clues.filter((c) => !c.exact && !V.anchorDone(this.rules, s, c.id)));
    const p = this.selected >= 0 && this.selected !== s.at ? V.plan(this.rules, s, this.selected) : null;
    this.chart.setRoute(p && p.route ? [s.at, ...p.route.hops] : []);
  }

  refreshTop() {
    // a memory has come back (an event, a place, a dialog): the organ
    const nm = Object.keys((this.s.campaign && this.s.campaign.memories) || {}).length;
    if (this.memSeen !== undefined && nm > this.memSeen) this.audio.play('organ');
    this.memSeen = nm;
    const s = this.s, res = this.rules.content.resources, left = V.daysLeft(this.rules, s);
    const region = this.rules.content.regions[this.g.points[s.at].region];
    $('chart-day').textContent = `Life ${(s.campaign && s.campaign.life) || 1} · Day ${s.day} · ${region.Name}`;
    // the Meridian date: UNKNOWN until the Horologe (Milestone 22)
    const dt = V.dateOf(this.rules, s);
    $('chart-date').textContent = dt.known ? dt.today : dt.last ? `Last record: ${dt.last} · Today: UNKNOWN` : 'Meridian date: UNKNOWN';
    $('chart-date').title = dt.known ? `The Meridian Horologe keeps the date. ${dt.last ? `The Anchorage's last record: ${dt.last}, ${dt.gap} ago.` : ''}` : 'Nobody aboard knows what day it is.';
    const days = { ice: left.ice, food: left.food, air: left.air };
    if (Math.min(left.ice, left.food, left.air) < 7 && !(this.comms && this.comms.isOpen)) this.hint('low');
    // the instruments (Milestone 23): brass gauges for what the crew live on, with days left;
    // the boilers' pressure; brass counters for the rest
    const VY = this.rules.content.voyage, burn = +VY.ReactorGlim || 10;
    const lastsFor = (d) => (d === Infinity ? 'STEADY' : `${fmt(d)} D`);
    const g = [
      ['Water', days.ice, `${fmt(s.stores.ice | 0)} ice: ${days.ice === Infinity ? 'steady' : `${fmt(days.ice)} days`} of drinking, air and growing`],
      ['Food', days.food, `${fmt(s.stores.food | 0)} food: ${days.food === Infinity ? 'steady' : `${fmt(days.food)} days`}`],
      ['Air', days.air, `${fmt(s.stores.air | 0)} air: ${days.air === Infinity ? 'steady' : `${fmt(days.air)} days`}`],
    ].map(([name, d, tip]) => gauge(name, d === Infinity ? 1 : d / 30, lastsFor(d), { low: d < 5, title: tip }));
    const glimDays = Math.trunc((s.stores.glim | 0) / burn);
    g.push(gauge('Glim', Math.min(1, (s.stores.glim | 0) / 2400), fmt(s.stores.glim | 0), { low: (s.stores.glim | 0) < 300, title: 'Glim: the drive burns it for every stitch, and the boilers every day' }));
    g.push(gauge('Boilers', s.cold ? 0 : Math.min(1, 0.25 + glimDays / 80), s.cold ? 'COLD' : `${Math.min(300, 75 + glimDays * 3)} PSI`, { low: !!s.cold || glimDays < 10, title: s.cold ? 'The boilers are cold: every system works at half' : `The boilers burn ${burn} Glim a day: ${fmt(glimDays)} days of it aboard` }));
    const plates = STORES.filter(([k]) => !['ice', 'food', 'air', 'glim'].includes(k)).map(([k, name, tip]) => `<div class="cs plate-ctr" title="${esc(tip || res[k].Description)}"><span class="cs-k" style="color:${hex(res[k].Color)}">${name}</span><b>${fmt(s.stores[k] | 0)}</b></div>`).join('')
      + `<div class="cs plate-ctr" title="Everyone aboard, flying ships or not; berths for ${B.berths(this.rules, s)}"><span class="cs-k">Crew</span><b>${count(s.crew)}</b></div>`;
    $('chart-stores').innerHTML = `<div class="gauges">${g.join('')}</div><div class="plates">${plates}</div>${moodBadge(this.rules, s)}${attentionBadge(this.rules, s)}`;
  }

  refreshCard() {
    const s = this.s, id = this.selected, p = this.g.points[id], R = this.rules.content.regions[p.region], T = this.rules.content.poiTypes[p.type];
    const known = s.known.includes(id), here = id === s.at, times = s.visited[id] | 0;
    $('pc-name').textContent = known ? p.name : 'Unknown place';
    $('pc-status').textContent = here ? 'The Forge is here' : times ? `Visited${times > 1 ? ` ×${times}` : ''}` : known ? '' : 'Beyond the sensors';
    const Fo = known && p.owner ? this.rules.content.factions[p.owner] : null;
    const owned = Fo ? ` · <span style="color:${hex(factionColor(this.rules, p.owner))}">${esc(Fo.Name)}${p.seat ? '' : ' territory'}</span> <span class="t-${tierName(this.rules, standingOf(this.rules, s, p.owner))}">(${tierName(this.rules, standingOf(this.rules, s, p.owner))})</span>` : '';
    $('pc-class').innerHTML = `<i style="background:${hex(known ? typeColor(this.rules, p.type) : 0x56637a)}"></i>${esc(R.Name)}${known ? ` · ${esc(T.Name)}` : ''}${p.edge && known ? ' · the Shore\'s edge' : ''}${owned}`;
    // something waits in this place's hulk, once the sensors have pinpointed it (or you are here)
    const anchor = p.relic && !V.anchorDone(this.rules, s, p.relic) ? p.relic : '';
    const pin = anchor && ((s.campaign && s.campaign.chart.clues) || []).some((c) => c.id === anchor && c.exact);
    const relic = !pin ? '' : (this.rules.content.anchors || {})[anchor] ? 'A signal comes from deep in the wreck. Cut into the hulk with Shearers to reach it. ' : `The ${this.rules.content.items[anchor].Name} is aboard: cut into the hulk with Shearers to find it. `;
    const Hz = known && p.pocket ? (this.rules.content.hazards || {})[p.pocket] : null;
    const pocket = !Hz ? '' : V.drive(this.rules, s).hazards.includes(Hz.id) ? ` Through the ${Hz.Name}: it yields half again as much as anywhere else.` : ` Cut off by the ${Hz.Name} on every side.`;
    const Tk = known && p.trader ? this.rules.content.traders[p.trader] : null;
    const tradeNote = Tk ? ` ${Tk.Keeper ? `Kept by ${Tk.Keeper}. ` : ''}A trader of the ${this.rules.content.factions[Tk.Faction].Name}: prices follow your standing with them, and they won't deal with you if you are Hostile.` : '';
    const claim = Fo ? (hasLeave(this.rules, s, p.owner) ? ` You have the ${Fo.Name}'s leave to mine and salvage here.` : ` Mining or salvaging here without the ${Fo.Name}'s leave costs standing, if they see it.`) : '';
    // the Wound: a Hand the sensors can see, an infested place, one burned clean
    const wd = Wd.woundOf(this.rules, s), hand = Wd.handsSeen(this.rules, s, this.g).find((h) => h.at === id);
    const inf = known && wd.infested[id] !== undefined, clean = known && wd.cleansed.includes(id);
    const wound = (hand ? (hand.caught && here ? ' A Hand has caught the Forge here: its Hour and its pack are waiting out in the dark. Go in and fight it (kill the Hour and the Hand is gone for this life), or stitch away and pay for tearing free.' : ` A Hand is here: an Hour and its pack${hand.strong ? ', a strong one' : ''}. It will catch the Forge if it comes here.`) : '') + (inf ? ' Infested: the Wound has settled here. Nurseries on the rocks, red veins in the wrecks, a spore haze that cuts the sensors. Burn every Nursery to clean it out.' : '') + (clean ? ' Burned clean in this life.' : '');
    $('pc-desc').textContent = relic + (known ? T.Description : 'The sensors cannot make it out from here. Get closer to see what it is.') + (times && known ? ' Picked over: it will yield less than before.' : '') + (!times && V.visitedBefore(s, p.id) ? ' You came here in an earlier life.' : '') + pocket + tradeNote + claim + wound;
    const stats = [], btns = [];
    let why = '';
    if (here) {
      // a trader or a wayhouse: dealt with from the chart, nothing to go in for
      const Tr = p.trader ? this.rules.content.traders[p.trader] : null;
      if (Tr) { const hc0 = V.canHail(this.rules, s); btns.push(['trade', `Trade with ${Tr.Name} <kbd>C</kbd>`, !hc0.ok, hc0.ok ? `${Tr.Keeper ? `${Tr.Keeper}: ` : ''}their own stock, at your standing with the ${this.rules.content.factions[Tr.Faction].Name}` : hc0.why]); }
      else if (p.wayhouse) { const dp = V.driftersPlan(this.rules, s); btns.push(['drifters', dp.ok ? `Take ${dp.n} drifters aboard: a day` : 'Take the drifters aboard', !dp.ok, dp.ok ? (dp.n < dp.want ? `${dp.want} ask, and there are berths for ${dp.n}` : 'They need berths: crew quarters add more') : dp.why]); if (!dp.ok) why = dp.why; }
      else if (id === V.lairAt(this.rules, s) && !(s.flags || []).includes('mainspring')) btns.push(['go', `Go in and face the Mainspring <kbd>Enter</kbd>`, false, 'The final battle: break its hearts and its coil, then its core. Bring frigates, destroyers and lances']);
      else if (Wd.caughtBy(this.rules, s)) btns.push(['go', `Go in and fight the Hand <kbd>Enter</kbd>`, false, 'Its Hour comes on with its pack, and grows more the longer the fight lasts. Kill it fast, or spool the Skein and run']);
      else btns.push(['go', `Go in <kbd>Enter</kbd>`, false, 'Play this place: gather, build, fight; one day passes for every four minutes there']);
      if (p.owner && this.rules.content.factions[p.owner] && !(this.comms && this.comms.isOpen)) this.hint('faction');
      const hc = V.canHail(this.rules, s);
      if (p.owner && this.rules.content.factions[p.owner]) btns.push(['hail', `Hail the ${this.rules.content.factions[p.owner].Name} <kbd>C</kbd>`, !hc.ok, hc.ok ? (p.seat ? 'Talk, trade and hire at their station' : 'Talk to them') : hc.why]);
      btns.push(['rest', p.type === 'StillWater' ? 'Rest a day (still water: twice the rest)' : 'Rest a day', false, 'Morale rises; the crew still eat, drink and breathe']);
      const sp = V.scanPlan(this.rules, s);
      btns.push(['scan', `Deep scan: a day, ${this.rules.content.voyage.ScanGlim} Glim`, !sp.ok, sp.ok ? `Places within ${sp.range} spans become known` : sp.why]);
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
        const esc0 = Wd.escapePlan(this.rules, s), fatal = esc0 && s.forge.hp * 100 <= V.forgeMaxHp(this.rules, s) * esc0.hull;
        btns.push(['stitch', esc0 ? (fatal ? 'Tear free: the hull won\'t hold <kbd>Enter</kbd>' : `Tear free and stitch there <kbd>Enter</kbd>`) : `Stitch there <kbd>Enter</kbd>`, !pl.ok, pl.ok ? `${r.days} days, ${r.glim} Glim${esc0 ? `; tearing free of the Hand costs ${esc0.hull}% of the hull, ${esc0.morale} morale and a hit to a system${fatal ? '. With this little hull left, the Forge comes apart: fight it instead, or mend the hull first' : ''}` : ''}` : pl.why]);
        if (!pl.ok) why = pl.why;
      } else why = pl.why;
      const dp = V.driftPlan(this.rules, s, id);
      if (dp.ok && (!pl.route || !pl.ok)) btns.push(['drift', `Drift there: ${dp.days} days, no Glim`, false, 'Sub-light, slowly; the crew still eat, drink and breathe']);
      // long-range hails (a trained comms station): whoever holds the place next door
      const far = known && p.owner && this.rules.content.factions[p.owner] ? V.canHail(this.rules, s, id) : null;
      if (far && far.ok) btns.push(['hailfar', `Hail the ${this.rules.content.factions[p.owner].Name} from here`, false, 'Long-range hails: talk across the lane (no trade at this distance)']);
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
      const nmem = Object.keys((s.campaign && s.campaign.memories) || {}).length;
      h += `<h3>Memories</h3><p class="fp-note">${nmem} of ${Object.keys(C.memories).length} remembered, and ${(s.campaign && s.campaign.echoes) | 0} echo${((s.campaign && s.campaign.echoes) | 0) === 1 ? '' : 'es'} to recall more with. What you remember stays in every life.</p><button type="button" data-act="loom">Open the Loom <kbd>L</kbd></button>`;
      h += `<h3>Skein Drive</h3><p class="fp-note">Stitches up to <b>${d.range}</b> spans${d.veil ? '; through the Veil' : '; not through the Veil'}. Condition ${s.systems.drive}%. Its parts are remembered, not fitted: once you remember one, the drive has it in every life.</p><ul class="items">`;
      for (const it of Object.values(C.items)) {
        if (it.Kind !== 'drive') continue;
        const known = V.remembers(s, it.id);
        h += `<li class="${known ? 'installed' : 'missing'}"><div><b>${esc(it.Name)}</b><span>${known ? 'Remembered' : 'Not yet'}</span></div><p>${esc(known ? it.Description : (C.memories[it.id] && C.memories[it.id].Hint) || '')}</p></li>`;
      }
      h += '</ul>';
      if (d.finalJump) { const hj = V.canJumpHome(rules, s); h += `<button type="button" class="big" data-act="home" ${hj.ok ? '' : 'disabled'}>Make the final jump</button>${hj.ok ? '' : `<p class="why">${esc(hj.why)}</p>`}`; }
      // the deck plan: slots, the rooms in them, and what could be built
      const used = B.slotsUsed(rules, s), slots = B.deckSlots(rules), rooms = B.rooms(rules), cp = B.costPctOf(rules, s);
      h += `<h3>Deck plan: ${used} of ${slots} slots</h3>${deckCutaway(rooms.filter((r) => B.built(s, r.id) && B.slotsOf(rules, r) > 0).map((r) => ({ name: r.Name, tip: r.Description, n: B.slotsOf(rules, r) })), slots, V.remembers(s, 'truth'))}<p class="fp-note">Rooms are built with ore, salvage, days and free engineers${cp !== 100 ? `, ${cp > 100 ? `${cp - 100}% dearer while the crew are ${B.moodOf(rules, s).mark === 'angry' ? 'angry' : 'uneasy'} or strained` : ''}` : ''}. They are lost with everything else when a life ends; how to build them is not.</p><ul class="items">`;
      for (const it of rooms) {
        const built = B.built(s, it.id), known = B.roomKnown(rules, s, it.id), I = it.Install, sl = B.slotsOf(rules, it);
        const where = sl === 0 ? 'no slot' : sl > 1 ? `${sl} slots` : '1 slot';
        h += `<li class="${built ? 'installed' : known ? 'found' : 'missing'}"><div><b>${esc(it.Name)}</b><span>${built ? 'Built' : known ? where : 'Not remembered'}</span></div><p>${esc(known ? it.Description : (B.roomMemory(rules, it.id) || {}).Hint || '')}</p>`;
        if (built) { const sp = V.stripPlan(rules, s, it.id); h += `<button type="button" data-act="strip" data-k="${it.id}" ${sp.ok ? '' : 'disabled'} title="${esc(sp.ok ? 'Frees its slots; a day, and nothing comes back' : sp.why)}">Strip it out</button>`; }
        else if (known) { const pl = V.installPlan(rules, s, it.id); h += `<button type="button" data-act="install" data-k="${it.id}" ${pl.ok ? '' : 'disabled'} title="${esc(pl.ok ? '' : pl.why)}">Build: ${pl.ore ?? I.Ore} ore, ${pl.salvage ?? I.Salvage} salvage, ${pl.days || I.Days} days, ${I.Engineers} engineers</button>${pl.ok ? '' : `<p class="why">${esc(pl.why)}</p>`}`; }
        else h += `<p class="why">Recall the ${esc((B.roomMemory(rules, it.id) || { Name: '' }).Name.toLowerCase())} on the Loom first.</p>`;
        h += '</li>';
      }
      h += `</ul><h3>Blueprints</h3><p class="fp-note">The foundry can build: ${(s.blueprints || []).map((t) => esc(rules.actor(t).traitInfo('Tooltip').Name)).join(', ')}. Others come from cutting up wrecks of that hull, from traders, or from luck.</p>`;
      h += '<h3>Systems</h3><div class="sys">';
      const maxHp = rules.actor('forge').traitInfo('Health').HP;
      const rows = [['hull', 'Hull', Math.trunc((s.forge.hp * 100) / maxHp), 'The Forge\'s hull. At zero, everything ends.'], ...V.SYSTEMS.map((k) => [k, C.systems[k].Name, s.systems[k], C.systems[k].Description])];
      for (const [k, name, c, tip] of rows) {
        const rp = V.repairPlan(rules, s, k);
        h += `<div class="sr" title="${esc(tip)}"><span>${esc(name)}</span><div class="bar"><i style="width:${c}%;background:${c < 30 ? 'var(--bad)' : c < 70 ? 'var(--height)' : 'var(--accent)'}"></i></div><b>${c}%</b><button type="button" data-act="repair" data-k="${k}" ${rp.ok ? '' : 'disabled'} title="${esc(rp.ok ? `+${rp.points}% for ${rp.ore} ore and ${rp.salvage} salvage; one day` : rp.why)}">Repair</button></div>`;
      }
      h += `</div><p class="fp-note">A day of repairs uses the free engineers (${free(s.crew, 'engineers')}), ore and salvage.</p>`;
      // this life, and the ones before it
      const C2 = s.campaign || { life: 1, lives: [] };
      h += `<h3>Life ${C2.life}</h3><p class="fp-note">${C2.lives.length ? `Before this one: ${C2.lives.map((l) => `life ${l.life}, ${l.days} day${l.days === 1 ? '' : 's'}`).join('; ')}. ` : ''}When a life is going nowhere you can let it go. You wake again at the start; the chart keeps what you found, and everything else is lost.</p><button type="button" data-act="letgo" ${s.over ? 'disabled' : ''}>Let go</button>`;
    } else if (this.tab === 'crew') {
      const m = s.morale, Mo = C.mood || {}, md = B.moodOf(rules, s), ah = s.allHands || { days: 0, best: 0 };
      h += `<h3>Mood: ${MOOD[md.mark]}</h3><div class="sr"><span>Morale</span><div class="bar"><i style="width:${m}%;background:${md.mark === 'angry' ? 'var(--bad)' : md.mark === 'uneasy' ? 'var(--height)' : 'var(--good)'}"></i></div><b>${m}</b></div>`;
      h += md.causes.length ? `<ul class="causes">${md.causes.map((c) => `<li class="${c.bad ? 'bad' : ''}">${esc(c.text)}</li>`).join('')}</ul>` : '<p class="fp-note">Nothing is wrong.</p>';
      h += `<p class="fp-note">Content (morale ${Mo.Content} or more, nothing short): work goes 10% faster. Uneasy: building, ships and Glim a stitch cost 10% more. Angry (morale under ${Mo.Angry}, or a store gone): 30% more. Under ${Mo.Strike}, a station's crew walk off each day.${ah.best ? ` All hands: ${ah.days ? `${ah.days} days and counting` : 'not now'}; the best so far, ${ah.best} days.` : ''}</p>`;
      const strain = B.strainOf(s);
      if (B.strainTotal(s)) h += `<h3>Strain</h3><div class="strain">${B.KINDS.map((k) => `<span class="${strain[k] ? 'on' : ''}">${{ thirst: 'Thirst', hunger: 'Hunger', air: 'Bad air', cold: 'Cold' }[k]} <b>${strain[k]}</b></span>`).join('')}</div><p class="fp-note">Shortages never kill. Each day a store is out, its strain rises a level (to 3); every level makes work slower, building, ships and stitches dearer, and ships weaker. At 2 and 3, stations go dark. It eases off a level a day once the store is back; the mess hall and infirmary ease it faster.</p>`;
      h += '<h3>Stations</h3><button type="button" data-act="bridge">Go to the bridge <kbd>B</kbd></button><ul class="stations">';
      for (const st of B.stations(rules, s)) h += `<li class="st-${st.notYet ? 'notyet' : st.state}" title="${esc(st.text)}"><span class="lamp ${st.mood ? `m-${st.mood}` : ''}"></span><b>${esc(st.name)} <i class="lv">${'●'.repeat(B.levelOf(rules, s, st.id, st))}${'○'.repeat(3 - B.levelOf(rules, s, st.id, st))}</i></b><span class="who">${st.officer ? esc(st.officer) : st.post ? 'nobody' : 'the hands'}</span><span class="state">${st.notYet ? 'Not yet' : STATE[st.state]}</span>${st.why ? `<p>${esc(st.why)}${st.state === 'dark' || st.state === 'striking' ? ` ${esc(st.dark)}` : ''}</p>` : ''}</li>`;
      h += '</ul>';
      if ((s.strikes || []).length) {
        const pd = V.parleyPlan(rules, s, 'day'), pp = V.parleyPlan(rules, s, 'pay');
        h += `<div class="parley"><button type="button" data-act="parley" data-k="day" ${pd.ok ? '' : 'disabled'}>Parley: a day of talking</button><button type="button" data-act="parley" data-k="pay" ${pp.ok ? '' : 'disabled'} title="${esc(pp.ok ? '' : pp.why)}">Pay them: ${pp.cogmarks} cogmarks</button></div><p class="fp-note">The strikers go back once morale is over ${Mo.Back}, or after a parley.</p>`;
      }
      const cv = V.crewView(rules, s);
      const when = (w) => w.replace(/^day >= (\d+)$/, 'from day $1').replace(/^morale >= (\d+)$/, 'while morale is $1 or more').replace(/^morale <= (\d+)$/, 'while morale is $1 or less');
      const trait = (p) => `<span class="trait${p.active ? '' : ' off'}" title="${esc(p.text)}${p.when ? ` (${esc(when(p.when))})` : ''}">${esc(p.trait)}</span>`;
      const eff = (p) => (p.effects.length ? `<span class="eff${p.active ? '' : ' off'}">${esc(p.effects.join(', '))}${p.active || !p.when ? '' : ` · ${esc(when(p.when))}`}</span>` : '');
      h += '<h3>Officers</h3><ul class="people">';
      for (const o of cv.officers) {
        h += o.vacant ? `<li class="vacant" title="${esc(o.duty)}"><span class="post">${esc(o.post)}</span><b>Vacant</b><span class="eff">nobody among the ${esc(o.role)} to promote</span></li>`
          : `<li title="${esc(o.duty)}"><span class="post">${esc(o.post)}</span><b>${esc(o.name)}</b>${trait(o)}${eff(o)}</li>`;
      }
      h += '</ul>';
      h += `<h3>Crew: ${count(s.crew)}</h3><table class="ct"><thead><tr><th></th><th>Aboard</th><th>Flying</th><th>Free</th></tr></thead><tbody>`;
      for (const r of ROLES) h += `<tr><th>${r[0].toUpperCase() + r.slice(1)}</th><td>${s.crew.roles[r]}</td><td>${s.crew.assigned[r]}</td><td>${free(s.crew, r)}</td></tr>`;
      h += '</tbody></table><p class="fp-note">Officers are counted with their role and never fly. Every ship needs crew: building one takes them from the free crew. When a ship is destroyed, half its crew get away in pods; its named lead goes down with it.</p>';
      h += '<h3>Hangar</h3><ul class="people ships">';
      for (const e of [...cv.ships].sort((a, b) => b.xp - a.xp)) {
        h += `<li><span class="post">${esc(e.ship)} <i class="${e.level > 1 ? 'rk' : ''}">${e.rank} · ${e.hp}%${e.perks.length ? ` · ${esc(e.perks.join(', '))}` : ''}</i></span>${e.lead ? `<b>${esc(e.lead.title)} ${esc(e.lead.name)}</b>${trait(e.lead)}${eff(e.lead)}${e.lead.kills ? `<span class="eff">${e.lead.kills} kill${e.lead.kills > 1 ? 's' : ''}</span>` : ''}` : '<span class="eff">no named lead</span>'}</li>`;
      }
      h += `</ul><p class="fp-note">${s.fleet.length ? `${s.fleet.length} of ${V.berthsOf(rules, s)} berths. A ship gains a level for every map it launches on, survives and comes home from, up to level 5; each adds 5% damage and hull. At levels 3 and 5 its pilot picks a perk. Ships aboard mend a little every day. Every armed ship has a named pilot or captain, whose trait changes it.` : 'Empty.'}</p>`;
      if (cv.standing.length) {
        h += '<h3>Standing by</h3><ul class="people">';
        for (const p of cv.standing) h += `<li><span class="post">${esc(p.title)}, no ship</span><b>${esc(p.name)}</b>${trait(p)}${eff(p)}</li>`;
        h += '</ul><p class="fp-note">They will take the next ship that needs them.</p>';
      }
      if (cv.fallen.length) {
        h += `<h3>In memory: ${cv.fallen.length}</h3><ol class="fallen">`;
        for (const f of cv.fallen.slice(0, 40)) h += `<li><span>Day ${f.day}</span><b>${esc(f.title)} ${esc(f.name)}</b> ${esc(f.how)}.${f.kills ? ` ${f.kills} kill${f.kills > 1 ? 's' : ''}.` : ''}</li>`;
        h += `</ol>${cv.fallen.length > 40 ? `<p class="fp-note">And ${cv.fallen.length - 40} more.</p>` : ''}`;
      }
      const before = (s.campaign && s.campaign.memorial) || [];
      if (before.length) {
        h += `<h3>Lost in earlier lives: ${before.length}</h3><ol class="fallen">`;
        for (const f of [...before].reverse().slice(0, 30)) h += `<li><span>Life ${f.life}, day ${f.day}</span><b>${esc(titleOf(rules, f))} ${esc(f.name)}</b> ${esc(f.how)}.</li>`;
        h += '</ol><p class="fp-note">They wake with you every time, and remember none of it. The ship\'s log does.</p>';
      }
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

  // The end of a life (the wake screen), or of the campaign (home).
  showEnd() {
    const s = this.s, won = s.won, life = (s.campaign && s.campaign.life) || 1;
    const lost = (s.crew.fallen || []).map((f) => `${titleOf(this.rules, f)} ${f.name}`);
    $('ce-title').textContent = won ? 'Home' : `Life ${life} ends`;
    $('ce-text').textContent = won ? s.over.text : `${s.over.text} Then white light, and the bridge, and the same alarms. You wake again, at the moment you first woke. The chart still holds what you found.`;
    const mems = Object.keys((s.campaign && s.campaign.memories) || {}).length;
    $('ce-stats').innerHTML = [['Days', s.day], ['Places visited', Object.keys(s.visited).length], ['Named crew lost', lost.length], won ? ['Lives', life] : ['Memories', `${mems} of ${Object.keys(this.rules.content.memories).length}`]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('ce-lost').textContent = lost.length ? `Lost in this life: ${lost.join(', ')}.` : '';
    $('ce-new').textContent = won ? 'New campaign' : 'Wake';
    $('chart-end').classList.toggle('dead', !won);
    $('chart-end').hidden = false;
    $('ce-new').onclick = () => this.onEnd(won ? 'new' : 'wake');
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
    const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.chart.setScale(scale);
    this.chart.dist = o.dist;
    this.chart.frame(dt, this.camera);
    renderer.render(this.scene, this.camera);
    this.t = (this.t || 0) + dt;
    this.drawLabels();
    // a faint ticking while a Hand is near
    const near = Wd.handsSeen(this.rules, this.s, this.g);
    if (near.length && !(this.comms && this.comms.isOpen)) {
      this.tickT = (this.tickT || 0) - dt;
      if (this.tickT <= 0) { this.tickT = near.some((h) => h.hops <= 1) ? 0.55 : 1.1; this.audio.play('tick', near.some((h) => h.hops <= 1) ? 1 : 0.6); }
    }
    this.hud.tickToasts();
  }

  drawLabels() {
    const ctx = this.ctx, dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = this.s, d = V.drive(this.rules, s), here = this.g.points[s.at];
    const known = new Set(s.known);
    const proj = (p) => { this.v.copy(chartPos(p)).project(this.camera); return this.v.z > 1 ? null : { x: (this.v.x + 1) * 0.5 * w, y: (1 - this.v.y) * 0.5 * h }; };
    const zoom = Math.max(0.6, Math.min(1.6, 95 / this.orbit.dist));
    // ink on parchment: every word gets a little paper behind it so lanes don't cut through it
    const write = (text, x, y, font, fill, halo = 'rgba(233,220,188,0.85)') => {
      ctx.font = font; ctx.lineJoin = 'round';
      if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = 3.5; ctx.strokeText(text, x, y); }
      ctx.fillStyle = fill; ctx.fillText(text, x, y);
    };
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // region names, hand-lettered on the far side of each ring; the Veil in violet
    const big = Math.round(Math.max(12, 15 * zoom));
    for (const R of Object.values(this.rules.content.regions)) {
      const [r0, r1] = this.g.rings ? this.g.rings[R.id] : String(R.Ring).split(',').map(Number), rm = (r0 + r1) / 2;
      const a = -Math.PI / 2 + 0.35;
      const q = proj({ x: Math.cos(a) * rm, y: Math.sin(a) * rm, z: 0 });
      if (q) write(R.Name.replace(/^The /, 'the '), q.x, q.y, `italic ${big}px 'IM Fell English', Georgia, serif`, 'rgba(59,42,26,0.78)');
    }
    if (this.g.veil) {
      const rm = (this.g.veil[0] + this.g.veil[1]) / 2, a = -Math.PI / 2 - 0.5;
      const q = proj({ x: Math.cos(a) * rm, y: Math.sin(a) * rm, z: 0 });
      if (q) write('the Veil', q.x, q.y, `italic ${big}px 'IM Fell English', Georgia, serif`, 'rgba(92,58,110,0.9)');
    }
    { const q = proj({ x: 0, y: 0, z: 0 }); if (q) write('Orrin', q.x, q.y + 34 * zoom, `${Math.round(13 * zoom)}px 'IM Fell English SC', Georgia, serif`, 'rgba(42,29,16,0.9)'); }
    this.drawHazards(proj, known, zoom);
    // place names: here, the selection, the hover, the signal, and known places within reach
    const label = (id, strong) => {
      const p = this.g.points[id], q = proj(p);
      if (!q || q.x < -50 || q.x > w + 50 || q.y < -20 || q.y > h + 20) return;
      // above the seal; under it where the Forge's token stands
      const k = known.has(id), off = id === s.at ? -30 * zoom : (strong ? 17 : 13) * zoom;
      if (strong) write(k ? p.name : '?', q.x, q.y - off, `${Math.round(14 * Math.min(1.25, zoom))}px 'IM Fell English SC', Georgia, serif`, '#2a1d10');
      else write(k ? p.name : '?', q.x, q.y - off, `${Math.round(12 * Math.min(1.2, zoom))}px Spectral, Georgia, serif`, k ? 'rgba(59,42,26,0.82)' : 'rgba(59,42,26,0.5)');
    };
    const clues = ((s.campaign && s.campaign.chart.clues) || []).filter((c) => !V.anchorDone(this.rules, s, c.id));
    const r2 = d.range * d.range, shown = new Set([s.at, this.selected, this.hover, ...clues.filter((c) => c.exact).map((c) => c.at)]);
    if (this.orbit.dist < 200) for (const p of this.g.points) if (!shown.has(p.id) && (known.has(p.id) || V.remembers(s, 'radar')) && (p.x - here.x) ** 2 + (p.y - here.y) ** 2 <= r2 * 1.1) label(p.id, false);
    for (const id of shown) if (id >= 0) label(id, true);
    // what each clue is about, in pencil: under the pinpointed place, or at the circle's edge
    const what = (c) => (this.rules.content.anchors || {})[c.id]?.Name || this.rules.content.items[c.id]?.Name || c.id;
    for (const c of clues) {
      const q = c.exact ? proj(this.g.points[c.at]) : proj({ x: c.x, y: c.y + c.r, z: 0 });
      if (q) write(c.exact ? what(c) : `${what(c)}: somewhere in here?`, q.x, q.y + (c.exact ? 34 * zoom : 16), `italic ${Math.round(13 * Math.min(1.2, zoom))}px 'IM Fell English', Georgia, serif`, 'rgba(60,60,60,0.92)');
    }
    this.drawWound(proj, known);
  }

  // Closed lanes into a hazard pocket: hatched across the middle, with the hazard's mark in a
  // little disc of paper (close in only; from far off the dashes say enough)
  drawHazards(proj, known, zoom) {
    if (this.orbit.dist > 170) return;
    const ctx = this.ctx, H = this.rules.content.hazards || {}, d = V.drive(this.rules, this.s), through = d.hazards || [];
    const dark = !V.remembers(this.s, 'radar'), w = window.innerWidth, h = window.innerHeight;
    ctx.save();
    for (const l of this.g.lanes) {
      if (!l.hazard || !H[l.hazard] || through.includes(l.hazard)) continue;
      if (dark && !known.has(l.a) && !known.has(l.b)) continue;
      const pa = this.g.points[l.a], pb = this.g.points[l.b], here = this.g.points[this.s.at], reach = (d.range * 1.8) ** 2;
      if ((pa.x - here.x) ** 2 + (pa.y - here.y) ** 2 > reach && (pb.x - here.x) ** 2 + (pb.y - here.y) ** 2 > reach) continue;
      const a = proj(this.g.points[l.a]), b = proj(this.g.points[l.b]);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (mx < -20 || mx > w + 20 || my < -20 || my > h + 20) continue;
      const n = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / n, uy = (b.y - a.y) / n, k = 4 * zoom;
      const col = hex(parseInt(H[l.hazard].Color, 16) || 0x884422);
      ctx.strokeStyle = 'rgba(59,42,26,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(mx + ux * i * k - uy * k, my + uy * i * k + ux * k); ctx.lineTo(mx + ux * i * k + uy * k, my + uy * i * k - ux * k); }
      ctx.stroke();
      const r = 7.5 * zoom, cx = mx - uy * (r + 6), cy = my + ux * (r + 6);
      ctx.fillStyle = '#e9dcbc'; ctx.strokeStyle = 'rgba(59,42,26,0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      hazardMark(ctx, l.hazard, cx, cy, r * 0.72, col);
    }
    ctx.restore();
  }

  // The Wound on the parchment: infested places as spreading red-ink stains (bigger the longer
  // they have festered), and the Hands the sensors can see, with their reach
  drawWound(proj, known) {
    const ctx = this.ctx, s = this.s, wd = Wd.woundOf(this.rules, s), t = this.t || 0;
    const scale = Math.max(0.4, Math.min(2.2, 95 / this.orbit.dist));
    ctx.save();
    for (const [id, day] of Object.entries(wd.infested)) {
      const pid = +id;
      if (!known.has(pid)) continue;
      const q = proj(this.g.points[pid]);
      if (!q) continue;
      const age = Math.max(0, s.day - day), r = (14 + Math.min(26, age * 1.5)) * scale;
      for (let k = 0; k < 6; k++) {
        const a = (pid * 2.4 + k * 1.9) % (Math.PI * 2), d = k ? r * (0.35 + ((pid + k * 7) % 5) * 0.08) : 0, rr = r * (k ? 0.55 : 0.8);
        const x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d * 0.7;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(190,20,40,0.42)'); gr.addColorStop(0.6, 'rgba(140,10,30,0.22)'); gr.addColorStop(1, 'rgba(120,0,20,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.textAlign = 'center';
    for (const h of Wd.handsSeen(this.rules, s, this.g)) {
      const q = proj(this.g.points[h.at]);
      if (!q) continue;
      const beat = 0.5 + 0.5 * Math.max(0, Math.sin(t * 2.4)) ** 4, r = (9 + beat * 4) * scale;
      ctx.strokeStyle = `rgba(150,22,36,${0.55 + beat * 0.4})`; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke();
      // the hand of a clock: it sweeps
      const a = t * 1.3 + h.id;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.cos(a) * r * 1.7, q.y + Math.sin(a) * r * 1.7); ctx.stroke();
      ctx.font = '700 11px "Cutive Mono", monospace'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(233,220,188,0.85)'; ctx.lineWidth = 3.5;
      const say = h.caught ? 'THE HAND HAS YOU' : h.strong ? 'A HAND (STRONG)' : 'A HAND';
      ctx.strokeText(say, q.x, q.y + r + 14); ctx.fillStyle = '#8e1a24'; ctx.fillText(say, q.x, q.y + r + 14);
    }
    ctx.restore();
  }
}

// A hazard's mark, inked small: rocks for shoals, a flame for embers, a spark for static, a
// staring sun for the Glare; anything else gets a cross
function hazardMark(ctx, id, x, y, r, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(42,29,16,0.9)'; ctx.lineWidth = 1;
  if (id === 'shoals') {
    for (const [dx, dy, rr] of [[-0.35, 0.1, 0.38], [0.3, 0.25, 0.3], [0.15, -0.4, 0.26], [-0.25, -0.35, 0.18]]) { ctx.beginPath(); ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else if (id === 'embers') {
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.55, r * 0.6); ctx.quadraticCurveTo(0, r * 1.05, -r * 0.55, r * 0.6); ctx.quadraticCurveTo(-r * 0.8, 0, -r * 0.1, -r * 0.35); ctx.quadraticCurveTo(-r * 0.05, -r * 0.7, 0, -r); ctx.fill(); ctx.stroke();
  } else if (id === 'static') {
    ctx.beginPath(); ctx.moveTo(r * 0.25, -r); ctx.lineTo(-r * 0.45, r * 0.1); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.5, -r * 0.15); ctx.lineTo(0, -r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'glare') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke();
  } else {
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.6, r * 0.6); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(-r * 0.6, r * 0.6); ctx.stroke();
  }
  ctx.restore();
}

// The deck plan as a cutaway of the Forge (the style guide's): two decks of compartments inside the
// hull, lit and named where a room is built, dashed where a slot is empty; Deck 9 at the bow is
// sealed until the whole truth is remembered. rooms: [{ name, tip, n (slots) }] in build order.
function deckCutaway(rooms, slots, open9) {
  const cols = Math.ceil(slots / 2), W = 52, H = 40, G = 4, x0 = 30, ys = [30, 30 + H + G];
  const cells = [];
  for (const r of rooms) for (let k = 0; k < r.n; k++) cells.push({ r, first: k === 0 });
  const box = (i) => ({ x: x0 + (i % cols) * (W + G), y: ys[Math.floor(i / cols)] });
  let out = '<svg class="deck-cut" viewBox="0 0 360 150" role="img" aria-label="' + esc(`The Forge in cutaway: ${rooms.map((r) => r.name).join(', ') || 'no rooms built'}; ${slots - cells.length} empty slots; Deck 9 ${open9 ? 'open' : 'sealed'}`) + '">';
  out += '<defs><linearGradient id="dkroom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4022"/><stop offset="1" stop-color="#2c2116"/></linearGradient></defs>';
  out += '<path d="M8 75 Q12 16 58 12 L282 12 Q330 16 354 75 Q330 134 282 138 L58 138 Q12 134 8 75 Z" fill="#221d17" stroke="#8c6a2c" stroke-width="2.5"/>';
  for (let x = 40; x < 330; x += 14) out += `<circle cx="${x}" cy="17" r="1.4" fill="#8c6a2c"/><circle cx="${x}" cy="133" r="1.4" fill="#8c6a2c"/>`;
  // the decks run the length of her: a keel line between them
  out += `<line x1="22" y1="${ys[1] - G / 2}" x2="${x0 + cols * (W + G)}" y2="${ys[1] - G / 2}" stroke="#3b2a1a" stroke-width="1"/>`;
  const words = (name) => { const w = name.split(' '); if (name.length <= 9 || w.length < 2) return [name]; const m = Math.ceil(w.length / 2); return [w.slice(0, m).join(' '), w.slice(m).join(' ')]; };
  for (let i = 0; i < slots; i++) {
    const { x, y } = box(i), c = cells[i];
    if (c) {
      // a room that runs on from the slot before it on the same deck joins up with it
      const joined = !c.first && i % cols !== 0;
      out += `<g><title>${esc(`${c.r.name}: ${c.r.tip || ''}`)}</title><rect x="${joined ? x - G - 1 : x}" y="${y}" width="${joined ? W + G + 1 : W}" height="${H}" rx="3" fill="url(#dkroom)" stroke="#c9a04e" stroke-width="1.2"/>`;
      out += `<circle cx="${x + 8}" cy="${y + 8}" r="3" fill="#ffb45a" opacity="0.9"/>`;
      if (c.first) { const ln = words(c.r.name); ln.forEach((l, k) => { out += `<text x="${x + W / 2}" y="${y + H / 2 + 4 + (k - (ln.length - 1) / 2) * 11}" text-anchor="middle" font-family="'IM Fell English SC', Georgia, serif" font-size="10.5" fill="#ede6d6">${esc(l)}</text>`; }); }
      out += '</g>';
    } else out += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="3" fill="none" stroke="#8c6a2c" stroke-width="1.1" stroke-dasharray="5 4"/><text x="${x + W / 2}" y="${y + H / 2 + 4}" text-anchor="middle" font-family="Spectral, Georgia, serif" font-size="9.5" fill="#8a7a62">empty</text>`;
  }
  // Deck 9, at the bow
  const bx = x0 + cols * (W + G) + 4, by = 52;
  if (open9) out += `<g><title>Deck 9: your quarters, open at last</title><rect x="${bx}" y="${by}" width="44" height="46" rx="3" fill="url(#dkroom)" stroke="#f1d58e" stroke-width="1.4"/><circle cx="${bx + 8}" cy="${by + 8}" r="3" fill="#ffd778"/>`;
  else {
    out += `<g><title>Deck 9: sealed</title><rect x="${bx}" y="${by}" width="44" height="46" rx="3" fill="#0e0c09" stroke="#c2402f" stroke-width="1.3"/>`;
    for (let k = 0; k < 3; k++) out += `<line x1="${bx + 6 + k * 13}" y1="${by + 5}" x2="${bx + 16 + k * 13}" y2="${by + 41}" stroke="#3a3127" stroke-width="2.5"/>`;
  }
  out += `<text x="${bx + 22}" y="${by + 27}" text-anchor="middle" font-family="'IM Fell English SC', Georgia, serif" font-size="10.5" fill="${open9 ? '#ede6d6' : '#ff9d8a'}">Deck 9</text></g>`;
  out += '<text x="22" y="148" font-family="\'Cutive Mono\', monospace" font-size="9" fill="#8a7a62">STERN</text><text x="338" y="148" text-anchor="end" font-family="\'Cutive Mono\', monospace" font-size="9" fill="#8a7a62">BOW</text>';
  return out + '</svg>';
}
