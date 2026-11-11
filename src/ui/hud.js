import { R } from '../render/space.js';
import { CELL } from '../engine/math.js';
import { fieldOre } from '../traits/economy.js';
import { FORMATIONS } from '../traits/formation.js';
import { STANCES } from '../traits/combat.js';
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const hex = (c) => `#${c}`;
// What a deposit is called, and what gathering it is called.
const DEPOSIT_NAMES = { ore: 'Ore rock', ice: 'Ice rock', glim: 'Glim cloud', spores: 'Spore drift', salvage: 'Wreck' };
const VERBS = { ore: 'Mine', ice: 'Mine', salvage: 'Cut', glim: 'Skim', spores: 'Skim' };
export { VERBS };
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
    this.deposits = []; this.groupSig = null; this.queueSig = null;
    for (const t of this.toasts) t.el.remove();
    this.toasts = [];
    if (!this.panelsBuilt) { this.panelsBuilt = true; this.buildPanel(); this.groundsPanel(); this.fleetPanel(); this.resourceBar(); this.skeinPanel(); }
    // per map: the sandbox panel only in the Proving Grounds, the Skein panel only on the voyage
    $('btn-grounds').hidden = !this.world.settings.sandbox;
    if (!this.world.settings.sandbox && this.groundsOpen) this.toggleGrounds(false);
    const voyage = this.world.settings.mode === 'poi';
    $('skein').hidden = !voyage;
    $('btn-mapsave').hidden = !session.onVoyage;
    $('btn-mapsave').textContent = this.saveMode === 'free' ? 'Save…' : 'Save and quit';
    document.body.classList.toggle('voyage', voyage);
    $('help-intro').innerHTML = voyage
      ? 'Gather what the Forge needs, build what you must, and leave before the place turns on you. <b>Recall</b> your ships and <b>spool the Skein</b> (bottom right) to go on to the next place.'
      : 'Your Forge, its escorts and two Gleaners, in a quiet corner of the Drift. Press <kbd>G</kbd> to call in Ashen Gaunt raiders or a Gnasher pack and test your fleet against them. Press <kbd>B</kbd> to build warships.';
    $('report').hidden = true;
    const poi = this.world.settings.poi;
    $('place').textContent = poi ? poi.name : 'Proving Grounds';
    $('place').classList.remove('warn');
    this.dayShown = -1;
    if (poi) this.toast(`Arrived: ${poi.name}`, 'info');
  }

  // ---------------------------------------------------------------- resources
  resourceBar() {
    const res = this.world.rules.content.resources;
    $('res-stores').innerHTML = Object.values(res).filter((r) => !r.Galaxy).map((r) => `<div class="res-item" title="${esc(r.Name)}: ${esc(r.Description || '')}"><span class="res-k" style="color:${hex(r.Color)}">${esc(r.Name)}</span><b id="res-${r.id}" style="color:${hex(r.Color)}">0</b>${r.id === 'ore' ? '<span id="res-rate"></span>' : ''}</div>`).join('');
  }

  // ---------------------------------------------------------------- leaving: the Skein Drive
  skeinPanel() {
    $('btn-hail').addEventListener('click', () => this.hail());
    $('btn-mapsave').addEventListener('click', () => { if (this.onMapSave) this.onMapSave(); });
    $('btn-recall').addEventListener('click', () => {
      const ships = this.input.world.actors.filter((a) => a.owner === this.s.viewer && a.mobile && !a.dead && !a.has('Hangar'));
      if (ships.length) { this.input.issue('Recall', ships); this.audio.play('order'); this.toast(`Recalling ${ships.length} ship${ships.length > 1 ? 's' : ''}`, 'info'); }
    });
    $('btn-launch').addEventListener('click', () => { const f = this.forge(); if (f) { this.input.issue('LaunchAll', [f]); this.audio.play('order'); } });
    $('btn-spool').addEventListener('click', () => {
      const f = this.forge();
      if (!f) return;
      if (f.skein.spooling) this.input.issue('CancelSpool', [f]);
      else { this.input.issue('SpoolSkein', [f]); this.audio.play('alert'); this.toast('Spooling the Skein: one minute until the Forge leaves', 'info'); this.hint('spool'); }
    });
  }
  // On the voyage: the day, and how long water, food and air will last at today's rate.
  refreshDay() {
    const v = this.world.settings.voyage, poi = this.world.settings.poi;
    if (!v || !poi) return;
    const gone = Math.trunc((v.ticks + this.world.frame) / v.dayTicks), day = v.day + gone;
    if (day === this.dayShown) return;
    this.dayShown = day;
    const p = this.s.viewer, ice = (p.resources.amounts.ice | 0) + v.forecast.ice * gone;
    const left = (have, rate) => (rate >= 0 ? Infinity : Math.max(0, Math.trunc(have / -rate)));
    const d = { water: left(ice, v.forecast.ice), food: left(v.stores.food + v.forecast.food * gone, v.forecast.food), air: left(v.stores.air + v.forecast.air * gone, v.forecast.air) };
    const worst = Object.entries(d).sort((a, b) => a[1] - b[1])[0];
    $('place').textContent = `${poi.name} · Day ${day}${worst[1] < 10 ? ` · ${worst[0]} ${worst[1]} d` : ''}`;
    $('place').classList.toggle('warn', worst[1] < 4);
    if (gone > 0 && worst[1] < 4) this.toast(`Day ${day}: ${worst[1] ? `${worst[0]} for ${worst[1]} more day${worst[1] > 1 ? 's' : ''}` : `the ${worst[0]} is gone`}`, 'bad');
  }

  refreshSkein() {
    if ($('skein').hidden) return;
    const f = this.forge(), w = this.world;
    if (!f || !f.skein) return;
    const out = w.actors.filter((a) => a.owner === this.s.viewer && a.mobile && !a.dead && a !== f).length;
    const aboard = f.trait('Hangar').aboard.length;
    const sk = f.skein, spooling = sk.spooling;
    const left = spooling ? Math.ceil((sk.time - sk.spool) / TICKS_PER_S) : 0;
    $('skein-state').textContent = w.departed ? 'Gone' : spooling ? `Spooling · ${left} s` : 'Ready';
    $('skein-bar').style.width = `${spooling ? (sk.spool / sk.time) * 100 : 0}%`;
    $('skein-fleet').textContent = `${aboard} aboard · ${out} outside${spooling && out ? ' (they will be left behind)' : ''}`;
    $('skein-fleet').classList.toggle('warn', spooling && out > 0);
    $('btn-spool').textContent = spooling ? 'Cancel spool' : 'Spool the Skein';
    $('btn-launch').disabled = !aboard || spooling;
    $('btn-recall').disabled = !out;
  }

  // ---------------------------------------------------------------- comms on a map
  // The faction ship or station selected (or hovered) that can be hailed, if any.
  hailTarget() {
    const sel = this.input.selection, w = this.world;
    const a = sel.length === 1 ? sel[0] : this.input.hover;
    if (!a || a.dead || !a.owner.slot || a.owner.slot.tier === undefined || !w.diplomacy) return null;
    return a;
  }
  hail() {
    const a = this.hailTarget();
    if (!a || !this.comms) return;
    const w = this.world, me = this.s.viewer, p = a.owner, fid = p.faction, v = w.settings.voyage || {}, rules = w.rules;
    this.savedSpeed = this.s.speed || 1;
    this.s.speed = 0; // the map waits while you talk
    this.comms.open({
      fid,
      context: () => ({ rules, fid, factionName: p.name, tier: p.slot.tier, station: !!a.station, where: 'map', atWar: me.isEnemy(p), treaties: w.diplomacy.treatiesWith(fid), flags: new Set(v.flags || []), stores: { ...(v.stores || {}), ...me.resources.amounts }, place: w.settings.poi ? w.settings.poi.name : '', region: v.region || '' }),
      apply: (effects) => { this.input.issueWorld('Comms', { faction: fid, effects }); return { close: effects.some((e) => e.op === 'close'), notes: [] }; },
      trade: null,
      onClose: () => { this.s.speed = this.savedSpeed; },
    });
  }

  // ---------------------------------------------------------------- the report
  showReport(r, onContinue, { next = 'Choose the next place' } = {}) {
    const res = this.world.rules.content.resources;
    const name = (t) => this.world.rules.actors.get(t)?.traitInfo('Tooltip')?.Name || t;
    const list = (m) => Object.entries(m).map(([t, n]) => `${n} × ${name(t)}`).join(', ') || 'none';
    const rows = Object.entries(r.stores).map(([k, s]) => {
      const ch = s.changes, gathered = ch.gathered || 0, spent = -(ch.spent || 0) - (ch.refunded || 0);
      return `<tr><th scope="row" style="color:${hex(res[k].Color)}">${esc(res[k].Name)}</th><td>${fmtNum(s.start)}</td><td class="g">${gathered ? `+${fmtNum(gathered)}` : '—'}</td><td>${spent ? `−${fmtNum(spent)}` : '—'}</td><td><b>${fmtNum(s.end)}</b></td></tr>`;
    }).join('');
    const aboard = r.ships.aboard.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {});
    const lost = Object.values(r.ships.destroyed).reduce((a, b) => a + b, 0), behind = Object.values(r.ships.leftBehind).reduce((a, b) => a + b, 0);
    $('report-title').textContent = r.forgeLost ? `The Forge is lost at ${r.place ? r.place.name : 'this place'}` : `Leaving ${r.place ? r.place.name : 'this place'}`;
    const crewLost = r.crew ? Object.values(r.crew.lost).reduce((a, b) => a + b, 0) : 0;
    const found = (r.found || []).map((id) => this.world.rules.content.items[id]?.Name || id);
    $('report-sub').textContent = `${Math.floor(r.seconds / 60)} min ${r.seconds % 60} s here${r.ticks ? ` (${(r.ticks / 6000).toFixed(1)} days)` : ''}. ${lost + behind ? `${lost + behind} ship${lost + behind > 1 ? 's' : ''} did not come home${crewLost ? `, and ${crewLost} crew with them` : ''}.` : 'Everyone came home.'}${r.crew && r.crew.leadsLost && r.crew.leadsLost.length ? ` Lost: ${r.crew.leadsLost.map((l) => l.name).join(', ')}.` : ''}${r.crew && r.crew.leadsSaved && r.crew.leadsSaved.length ? ` Got out: ${r.crew.leadsSaved.map((l) => l.name).join(', ')}.` : ''}${found.length ? ` Found: the ${found.join(' and the ')}.` : ''}`;
    $('report-stores').innerHTML = `<thead><tr><th></th><th>Arrived with</th><th>Gathered</th><th>Spent</th><th>Leaving with</th></tr></thead><tbody>${rows}</tbody>`;
    $('report-ships').innerHTML = [
      ['Aboard', list(aboard)],
      ['Built here', list(r.ships.built)],
      ['Destroyed', list(r.ships.destroyed)],
      ['Left behind', list(r.ships.leftBehind)],
      ['In the holds', Object.entries(r.ships.aboard.reduce((m, e) => { if (e.cargo) m[e.kind] = (m[e.kind] || 0) + e.cargo; return m; }, {})).map(([k, n]) => `${fmtNum(n)} ${res[k] ? res[k].Name.toLowerCase() : k}`).join(', ') || 'empty'],
      ['Forge hull', r.forge ? `${Math.ceil((r.forge.hp / r.forge.maxHp) * 100)}%` : '—'],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('report-next').textContent = next;
    $('report').hidden = false;
    this.hint('report');
    $('report-next').onclick = () => { $('report').hidden = true; onContinue(); };
    $('report-next').focus();
  }

  // ---------------------------------------------------------------- the start screen
  showLauncher(open, opts) {
    $('launcher').hidden = !open;
    document.body.classList.toggle('at-launcher', open);
    if (!open) return;
    const { rules, run, onVisit, onGrounds, onNewRun, save, onContinue, onNewVoyage, slots = [], onLoad, onDelete } = opts;
    const res = rules.content.resources, types = rules.content.poiTypes;
    $('launch-seed').value = '';
    $('setup').hidden = true; $('slots').hidden = true;
    $('voyage-continue').hidden = !save;
    if (save) $('voyage-continue').textContent = save.dead ? `Continue: life ${save.life} has ended` : `Continue: life ${save.life}, day ${save.day}, ${save.place}${save.inMap ? ' (on a map)' : ''}`;
    $('voyage-continue').onclick = onContinue;
    $('voyage-new').onclick = () => { $('setup').hidden = false; $('slots').hidden = true; };
    $('setup-back').onclick = () => { $('setup').hidden = true; };
    $('setup-start').onclick = () => {
      const pick = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
      if (save && !window.confirm('Start a new campaign? The campaign you have now, and everything it remembers, will be lost.')) return;
      const v = $('voyage-seed').value.trim();
      onNewVoyage({ seed: v ? parseInt(v, 10) || 0 : undefined, length: pick('length'), guided: $('setup-guided').checked });
    };
    // named saves from before campaigns (free-save voyages): loading one makes it the campaign
    $('voyage-load').hidden = !slots.length;
    const listSlots = () => {
      $('slot-list').innerHTML = slots.map((x) => `<li><b>${esc(x.name)}</b><span>Day ${x.day}, ${esc(x.place)}${x.inMap ? ' (on a map)' : ''} · ${new Date(x.when).toLocaleString()}</span><button type="button" data-load="${esc(x.name)}">Load</button><button type="button" data-del="${esc(x.name)}">Delete</button></li>`).join('') || '<li>No saves.</li>';
    };
    $('voyage-load').onclick = () => { listSlots(); $('slots').hidden = false; $('setup').hidden = true; };
    $('slots-back').onclick = () => { $('slots').hidden = true; };
    $('slot-list').onclick = (e) => {
      const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
      if (l) onLoad(l.dataset.load);
      else if (d && window.confirm(`Delete the save "${d.dataset.del}"?`)) { onDelete(d.dataset.del); const i = slots.findIndex((x) => x.name === d.dataset.del); if (i >= 0) slots.splice(i, 1); listSlots(); $('voyage-load').hidden = !slots.length; }
    };
    $('title-practice').open = !!run;
    $('launch-head').textContent = run ? `Practice, visit ${run.visits + 1}: where next?` : 'Pick a place';
    $('launch-intro').textContent = 'Practice skips the star chart: pick any kind of place, play it, leave, and pick another. Stores and fleet carry over; there is no day clock.';
    $('launch-run').hidden = !run;
    if (run) {
      const fleet = run.fleet.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {});
      $('launch-run').innerHTML = `<div class="lr-stores">${Object.values(res).map((r) => `<span><i style="background:${hex(r.Color)}"></i>${esc(r.Name)} <b>${fmtNum(run.stores[r.id] || 0)}</b></span>`).join('')}</div>
        <div class="lr-fleet">Aboard: ${Object.entries(fleet).map(([t, n]) => `${n} × ${esc(rules.actor(t).traitInfo('Tooltip').Name)}`).join(', ') || 'no ships'} · Forge hull ${Math.ceil((run.forge.hp / rules.actor('forge').traitInfo('Health').HP) * 100)}%</div>`;
    }
    // what each kind of place has to offer
    const offers = (t) => {
      const kinds = new Set();
      for (const n of t.nodes) {
        const [k] = n.key.split('@');
        const kind = n.nodes.find((c) => c.key === 'Kind')?.value;
        if ((k === 'Deposit' || k === 'Clouds') && kind) kinds.add(kind);
        if (k === 'Wrecks' || k === 'Hulk') kinds.add('salvage');
      }
      return [...kinds].map((k) => `<span class="chip" style="color:${hex(res[k].Color)};border-color:${hex(res[k].Color)}55">${esc(res[k].Name)}</span>`).join('');
    };
    $('launch-places').innerHTML = Object.values(types).map((t) => `<button type="button" class="place" data-t="${esc(t.id)}"><b>${esc(t.Name)}</b><span>${esc(t.Description)}</span><span class="chips">${offers(t)}</span></button>`).join('');
    $('launch-places').onclick = (e) => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      const s = $('launch-seed').value.trim();
      onVisit(b.dataset.t, s ? parseInt(s, 10) || 0 : undefined);
    };
    $('launch-grounds').onclick = onGrounds;
    $('launch-new').hidden = !run;
    $('launch-new').onclick = onNewRun;
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
  // A hint card (a guided first voyage); `ok` runs when it is dismissed.
  showHint(title, text) {
    $('hint-title').textContent = title; $('hint-text').textContent = text;
    $('hint').hidden = false;
    $('hint-ok').onclick = () => { $('hint').hidden = true; };
    this.audio.play('hint');
  }
  hint(when) { if (this.hintFn) this.hintFn(when); }

  toggleBuild(force) {
    this.buildOpen = force !== undefined ? force : !this.buildOpen;
    if (this.buildOpen) this.hint('build');
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
        <span class="bi-stats"><span class="bi-ore" title="Ore">${fmtNum(info.traitInfo('Valued').Cost)}</span><span title="Build time">${fmtTime(b.BuildDuration)}</span><span title="Fleet capacity">cap ${info.traitInfo('ConsumesCapacity')?.Amount || 0}</span>${info.traitInfo('Crew')?.Count ? `<span title="Crew it takes from the free crew">${info.traitInfo('Crew').Count} ${info.traitInfo('Crew').Role}</span>` : ''}</span>
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
        if (!e.kind || e.kind === 'ore') this.deposits.push([e.frame, e.amount]);
        const el = $(`res-${e.kind || 'ore'}`) || $('res-ore');
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
        this.audio.play('deposit');
        this.dirty = true;
      } else if (e.t === 'ready' && e.owner === me) {
        this.toast(`${this.world.rules.actor(e.type).traitInfo('Tooltip').Name} launched`, 'good');
        this.audio.play('ready');
        this.dirty = true;
      } else if (e.t === 'fire' && e.report) this.audio.play(e.report, this.near(e) * 0.8);
      else if (e.t === 'impact' && e.missile) this.audio.play('boom', this.near(e) * 0.6);
      else if (e.t === 'provoked' || (e.t === 'warn' && e.player !== undefined)) this.audio.play('alert');
      else if (e.t === 'rankup' && e.owner === me) this.audio.play('rankup');
      else if (e.t === 'surface') { this.toast('Something surfaces from the rocks!', 'bad'); this.audio.play('alert'); }
      else if (e.t === 'interdicted') this.audio.play('alert');
      else if (e.t === 'encounter') { this.toast(e.side === 'fauna' ? 'Something is coming out of the haze' : 'Raiders inbound', 'bad'); this.audio.play('alert'); }
      else if (e.t === 'aboard' && e.owner === me) this.dirty = true;
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
    for (const k in p.resources.amounts) { const el = $(`res-${k}`); if (el) el.textContent = fmtNum(p.resources.amounts[k]); }
    this.refreshDay();
    const ht = this.hailTarget();
    $('btn-hail').hidden = !ht;
    if (ht) $('btn-hail').firstChild.textContent = `Hail ${ht.owner.name} `;
    this.refreshSkein();
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
    if (sel.length === 1 && (sel[0].asteroid || sel[0].cloud)) {
      const t = sel[0].deposit, field = sel[0].asteroid ? this.world.fields[t.field] : null, rn = this.world.rules.content.resources[t.kind];
      const who = { ore: 'Gleaners', ice: 'Gleaners', glim: 'Skimmers', spores: 'Skimmers' }[t.kind];
      $('sel-name').textContent = DEPOSIT_NAMES[t.kind] || 'Deposit';
      $('sel-class').textContent = field ? `${rn.Name} · ${field.name}` : rn.Name;
      $('sel-desc').textContent = `${rn.Description} ${who}: select them, then right-click this to ${(VERBS[t.kind] || 'gather').toLowerCase()} it.`;
      $('sel-status').textContent = '';
      $('sel-stats').innerHTML = [
        [rn.Name, `${fmtNum(t.amount)} / ${fmtNum(t.maxAmount)}`],
        ['Size', `${fmtNum(t.radius() * 2 * M_PER_UNIT)} m`],
        ...(field ? [['In the field', fmtNum(fieldOre(field))]] : []),
      ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      return;
    }
    if (sel.length === 1 && sel[0].rock) {
      $('sel-name').textContent = 'Crystal formation'; $('sel-class').textContent = 'Fused crystal · Obstacle';
      $('sel-desc').textContent = sel[0].info.traitInfo('Tooltip').Description; $('sel-status').textContent = '';
      $('sel-stats').innerHTML = `<div><dt>Size</dt><dd>${fmtNum(sel[0].rock.radius() * 2 * M_PER_UNIT)} m</dd></div>`;
      return;
    }
    if (sel.length === 1 && sel[0].wreck) {
      const k = sel[0].wreck, of = this.world.rules.actors.get(k.of)?.traitInfo('Tooltip')?.Name || 'ship';
      $('sel-name').textContent = k.self.init.name ? `Wreck of the ${k.self.init.name}` : 'Wreck';
      $('sel-class').textContent = `Derelict · was a ${of}`;
      $('sel-desc').textContent = 'Dead and drifting. Shearers can cut salvage out of it: select them, then right-click the wreck.';
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
        if (!a.activity && !c.auto) status = `Holding (right-click a ${c.kinds.includes('salvage') ? 'wreck' : c.kinds.includes('glim') ? 'cloud' : 'rock'} to work it)`;
        const kn = this.world.rules.content.resources[c.kind || c.kinds[0]];
        stats.push(['Hold', `${c.cargo} / ${c.info.Capacity} ${c.cargo || c.kinds.length === 1 ? kn.Name.toLowerCase() : c.kinds.map((k) => this.world.rules.content.resources[k].Name.toLowerCase()).join(' or ')}`]);
      }
      const crew = a.info.traitInfo('Crew');
      if (crew && crew.Count) stats.push(['Crew', `${crew.Count} ${crew.Count === 1 ? crew.Role.replace(/s$/, '') : crew.Role}`]);
      if (this.world.ranks && a.mobile && !a.has('Hangar') && this.input.isMine(a)) {
        const R = this.world.ranks, next = R.steps[a.rank | 0];
        stats.push(['Rank', `${R.nameOf(a.rank) || 'Green'}${a.rank ? ` (+${R.bonus * a.rank}%)` : ''}`], ['Experience', next ? `${a.xp | 0} / ${next[1]}` : `${a.xp | 0}`]);
        // its named pilot or captain, and what they bring
        const l = a.lead && a.owner.crew ? a.owner.crew.lead(a.lead) : null;
        if (l) {
          const fx = [l.damage && `damage ${l.damage > 0 ? '+' : ''}${l.damage}%`, l.hull && `hull ${l.hull > 0 ? '+' : ''}${l.hull}%`, l.learn && `learns ${l.learn > 0 ? '+' : ''}${l.learn}%`, l.escape && 'lucky'].filter(Boolean).join(', ');
          stats.push([l.title, `${esc(l.name)} · <span title="${esc(l.text || '')}">${esc(l.traitName)}</span>${fx ? ` <span class="sub">(${fx})</span>` : ''}${(l.kills | 0) + (a.kills | 0) ? ` · ${(l.kills | 0) + (a.kills | 0)} kills` : ''}`]);
        }
      }
      const dropoff = a.trait('OreDropoff');
      if (dropoff) stats.push(['Docked', `${dropoff.slots.filter(Boolean).length} of ${dropoff.slots.length}`]);
      if (q) {
        const cur = q.queue[0];
        if (cur && status === 'Holding') status = 'Building';
        stats.push(['Building', cur ? `${this.world.rules.actor(cur).traitInfo('Tooltip').Name} ${Math.floor((q.progress / q.duration(cur)) * 100)}%` : 'Idle']);
      } else if (!dropoff) stats.splice(3, 0, ['Pitch', `${Math.round((a.pitch / 1024) * 360)}°`]);
      $('sel-status').textContent = status;
      $('sel-stats').innerHTML = stats.map(([k, v]) => `<div${k === 'Building' || k === 'Hold' || k === 'Pilot' || k === 'Captain' ? ' class="wide"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    } else {
      const counts = {};
      for (const a of sel) { const n = a.info.traitInfo('Tooltip').Name; counts[n] = (counts[n] || 0) + 1; }
      $('sel-name').textContent = `${sel.length} ships`;
      $('sel-class').textContent = Object.entries(counts).map(([n, c]) => `${c} × ${n}`).join(' · ');
      $('sel-desc').textContent = '';
      $('sel-status').textContent = sel.some((a) => a.activity) ? 'Under way' : 'Holding';
      const z = sel.reduce((s, a) => s + a.z, 0) / sel.length;
      const cargo = sel.filter((a) => a.collector).reduce((s, a) => s + a.collector.cargo, 0);
      $('sel-stats').innerHTML = `<div><dt>Mean altitude</dt><dd>${fmtAlt(z)}</dd></div>` + (sel.some((a) => a.collector) ? `<div><dt>In the holds</dt><dd>${fmtNum(cargo)}</dd></div>` : '');
    }
  }

  // ---------------------------------------------------------------- overlay
  // Sensor fog: where hostiles were last seen, fading with age.
  drawLastSeen(ctx) {
    const w = this.world, me = this.s.viewer;
    if (!w.shroud || !w.shroud.on || !me.lastSeen) return;
    const v3 = this.tmpV ||= this.renderer.tmp.clone();
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    for (const [id, e] of me.lastSeen) {
      if (me.seen.has(id) || !me.isEnemy(w.players[e.owner])) continue;
      const age = (w.frame - e.frame) / 25;
      if (age > 90) continue;
      v3.set(e.x * R, e.z * R, e.y * R);
      const p = this.input.project(v3);
      if (p.z > 1 || p.z < -1) continue;
      ctx.strokeStyle = `rgba(255,90,100,${Math.max(0.15, 0.7 - age / 120)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x + 6, p.y); ctx.lineTo(p.x, p.y + 6); ctx.lineTo(p.x - 6, p.y); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText('?', p.x + 9, p.y + 4);
    }
  }

  // ---------------------------------------------------------------- the Tactical Plot (Tab)
  // The whole map from above: your ships and their sensor reach, what you can see, where
  // hostiles were last seen, deposits and nebulae. Click to move the camera there.
  togglePlot(open = !this.plotOpen) { this.plotOpen = open; document.body.classList.toggle('plotting', open); }
  plotRect() {
    const W = window.innerWidth, H = window.innerHeight, b = this.world.bounds;
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0, size = Math.min(W - 120, H - 140), k = size / Math.max(bw, bh);
    return { x: (W - bw * k) / 2, y: (H - bh * k) / 2 + 10, w: bw * k, h: bh * k, k, b };
  }
  plotToWorld(px, py) { const r = this.plotRect(); return { x: r.b.x0 + (px - r.x) / r.k, y: r.b.y1 - (py - r.y) / r.k }; }
  drawPlot(ctx) {
    const w = this.world, me = this.s.viewer, r = this.plotRect(), rd = this.renderer;
    const X = (x) => r.x + (x - r.b.x0) * r.k, Y = (y) => r.y + (r.b.y1 - y) * r.k;
    ctx.fillStyle = 'rgba(5,6,11,0.88)'; ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.strokeStyle = 'rgba(95,227,208,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
    // grid every 20 cells (2 km)
    ctx.strokeStyle = 'rgba(127,142,163,0.12)';
    for (let gx = r.b.x0; gx <= r.b.x1; gx += 20 * CELL) { ctx.beginPath(); ctx.moveTo(X(gx), r.y); ctx.lineTo(X(gx), r.y + r.h); ctx.stroke(); }
    for (let gy = r.b.y0; gy <= r.b.y1; gy += 20 * CELL) { ctx.beginPath(); ctx.moveTo(r.x, Y(gy)); ctx.lineTo(r.x + r.w, Y(gy)); ctx.stroke(); }
    for (const n of w.nebulae || []) { ctx.fillStyle = `#${n.color}22`; ctx.beginPath(); ctx.arc(X(n.at[0]), Y(n.at[1]), n.radius * r.k, 0, Math.PI * 2); ctx.fill(); }
    const fog = w.shroud && w.shroud.on;
    for (const a of w.actors) {
      if (a.dead) continue;
      const x = X(a.x), y = Y(a.y);
      if (a.deposit && !a.wreck) { ctx.fillStyle = a.cloud ? 'rgba(255,240,176,0.35)' : 'rgba(217,165,119,0.45)'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); continue; }
      if (a.wreck) { ctx.fillStyle = 'rgba(201,184,166,0.45)'; ctx.fillRect(x - 2, y - 2, 4, 4); continue; }
      if (!a.health || a.burrowed) continue;
      if (a.owner === me) {
        const s = a.info.traitInfo('Sensors');
        if (fog && s) { ctx.strokeStyle = 'rgba(95,227,208,0.10)'; ctx.beginPath(); ctx.arc(x, y, ((s.Range * (me.sensorPct || 100)) / 100) * r.k, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = '#5fe3d0'; const z = a.has('Hangar') ? 5 : 2.5; ctx.fillRect(x - z, y - z, z * 2, z * 2);
        continue;
      }
      if (fog && !w.shroud.visible(me, a)) continue;
      ctx.fillStyle = me.isEnemy(a.owner) ? '#ff5a64' : rd.styleOf(a.owner).css;
      ctx.beginPath(); ctx.arc(x, y, a.station ? 6 : 3, 0, Math.PI * 2); ctx.fill();
    }
    if (fog) for (const [id, e] of me.lastSeen) {
      if (me.seen.has(id) || !me.isEnemy(w.players[e.owner])) continue;
      ctx.strokeStyle = 'rgba(255,90,100,0.6)'; ctx.strokeRect(X(e.x) - 3, Y(e.y) - 3, 6, 6);
    }
    // where the camera is looking
    const f = this.s.orbit.focus;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(X(f.x / R), Y(f.z / R), 7, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '600 11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#7f8ea3';
    ctx.fillText('TACTICAL PLOT  ·  click to look there  ·  Tab to close', r.x, r.y - 10);
  }

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
    this.drawLastSeen(ctx);
    if (this.plotOpen) { this.drawPlot(ctx); return; }
    for (const a of inp.selection) {
      const v = rd.views.get(a.id);
      if (!v) continue;
      const b = this.drawBrackets(ctx, v, a.deposit && !a.wreck ? ORE_CSS : rd.styleOf(a.owner).css, true);
      if (!b || a.wreck || a.rock) continue;
      // veterans: a chevron per rank above the bracket
      if (a.rank) { ctx.strokeStyle = '#ffd778'; ctx.lineWidth = 1.5; for (let i = 0; i < a.rank; i++) { const cy = b.p.y - b.r - 8 - i * 4; ctx.beginPath(); ctx.moveTo(b.p.x - 5, cy + 3); ctx.lineTo(b.p.x, cy); ctx.lineTo(b.p.x + 5, cy + 3); ctx.stroke(); } }
      const gn = inp.isMine(a) ? inp.groupNumberOf(a) : 0;
      if (gn) { ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillStyle = rd.styleOf(a.owner).css; ctx.fillText(String(gn), b.p.x - b.r - 2, b.p.y - b.r - 4); }
      const w = Math.max(18, Math.min(b.r * 1.4, 120));
      const bar = (y, f, color) => { ctx.fillStyle = 'rgba(5,6,11,0.7)'; ctx.fillRect(b.p.x - w / 2 - 1, y - 1, w + 2, 4); ctx.fillStyle = color; ctx.fillRect(b.p.x - w / 2, y, w * f, 2); };
      if (a.deposit) { bar(b.p.y + b.r + 6, a.deposit.amount / a.deposit.maxAmount, ORE_CSS); continue; }
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
          const rn = hv.deposit ? this.world.rules.content.resources[hv.deposit.kind] : null;
          const name = hv.wreck ? `${hv.init.name ? `Wreck of the ${hv.init.name}` : `Wreck of a ${this.world.rules.actors.get(hv.wreck.of)?.traitInfo('Tooltip')?.Name || 'ship'}`} · ${fmtNum(hv.wreck.salvage)} salvage`
            : hv.deposit ? `${DEPOSIT_NAMES[hv.deposit.kind]} · ${fmtNum(hv.deposit.amount)} ${rn.Name.toLowerCase()}`
              : hv.rock ? 'Crystal formation'
              : hostile ? `${tname} · ${this.world.factions.get(hv.owner.faction)?.Name || hv.owner.name}`
                : hv.owner.slot && hv.owner.slot.tier !== undefined ? `${tname} · ${hv.owner.name} · ${['Hostile', 'Wary', 'Neutral', 'Friendly', 'Allied'][hv.owner.slot.tier]}${this.s.viewer.isAlly(hv.owner) ? ' ally' : ''}` : tname;
          const text = action ? `${action}: ${name}` : name;
          ctx.font = '500 11px "IBM Plex Mono", monospace';
          const tw = ctx.measureText(text).width, tx = b.p.x + b.r + 6, ty = b.p.y - b.r + 10;
          ctx.fillStyle = 'rgba(5,6,11,0.72)'; ctx.fillRect(tx - 4, ty - 11, tw + 8, 15);
          ctx.fillStyle = action === 'Attack' || hostile || (action && action.startsWith('Attack')) ? HOSTILE_CSS : action ? ORE_CSS : hv.owner.slot && hv.owner.slot.tier !== undefined ? rd.styleOf(hv.owner).css : 'rgba(223,232,242,0.9)';
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
      ctx.fillText(ore ? `${fmtNum(ore)} ${(this.world.rules.content.resources[f.kind || 'ore']?.Name || 'ore').toLowerCase()}` : 'mined out', p.x, p.y + 14);
    }
    ctx.textAlign = 'start';
  }

  // Does a screen rectangle overlap a visible HUD panel?
  covered(x, y, w, h) {
    for (const id of ['help', 'sel', 'move-hint', 'build', 'grounds', 'fleetbar', 'skein']) {
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
