import * as THREE from '../lib/three.module.js';
import './traits/index.js';
import { loadRules } from './engine/rules.js';
import { World } from './engine/world.js';
import { OrderManager, LocalConnection, TICK_MS } from './engine/ordermanager.js';
import { SpaceScene, R } from './render/space.js';
import { WorldRenderer } from './render/worldrenderer.js';
import { OrbitCamera } from './ui/camera.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';
import { Audio } from './ui/audio.js';
import { newRun, visitSettings, applyReport } from './galaxy/run.js';
import * as V from './galaxy/voyage.js';
import { ChartScreen } from './ui/chart.js';
import { CommsPanel } from './ui/comms.js';
import { replayInto } from './engine/replay.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const canvas = $('view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 20000);
const audio = new Audio();
const hud = new Hud();
hud.audio = audio; // hint cards and toasts can play before any map has been visited
let rules = null, run = null, session = null, input = null, acc = 0;
// the voyage (galaxy map) and its star chart screen, when one is open
let voyage = null, chart = null;
const SAVE_KEY = 'driftforge.voyage', SLOTS_KEY = 'driftforge.saves';
// behind the start screen: just the sky, turning slowly
let menu = null;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  hud.resize(w, h, dpr);
  if (session) {
    const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    session.renderer.fx.glow.points.material.uniforms.scale.value = scale;
    session.renderer.fx.smoke.points.material.uniforms.scale.value = scale;
    session.renderer.combat.setScale(scale);
  }
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- sessions
// One map at a time: a point of interest on the voyage, or the Proving Grounds sandbox.
function startSession(settings, { place = '', onVoyage = false } = {}) {
  closeChart();
  if (input) input.dispose();
  const scene = new THREE.Scene();
  const world = new World(rules, settings);
  const viewer = world.players[0];
  const om = new OrderManager(world, new LocalConnection(), { localClient: 0, clients: [0], latency: 1 });
  const space = new SpaceScene(scene, world.bounds, settings.seed, settings.poi ? settings.poi.sky : '');
  const rd = new WorldRenderer(scene, world, viewer);
  const orbit = new OrbitCamera(camera);
  const b = world.bounds;
  const renderBounds = { x0: b.x0 * R, x1: b.x1 * R, y0: b.z0 * R, y1: b.z1 * R, z0: b.y0 * R, z1: b.y1 * R };
  orbit.bounds = renderBounds;
  session = { world, om, viewer, scene, space, camera, orbit, renderer: rd, renderBounds, speed: 1, place, reported: false, onVoyage };
  input = new Input(canvas, session, hud, audio);
  hud.attach(session, input);
  rd.syncViews();
  // start on the Forge, selected, seen from behind and above its port quarter
  const ship = input.forge() || world.actors.find((a) => a.owner === viewer);
  if (ship) {
    input.setSelection([ship], false);
    const v = rd.views.get(ship.id);
    rd.renderPos(ship, 1, v.pos);
    orbit.focus.copy(v.pos); orbit.focusT.copy(v.pos);
    orbit.yaw = orbit.yawT = Math.PI - 0.75; orbit.pitch = orbit.pitchT = 0.36; orbit.dist = orbit.distT = 95;
    input.followSelection();
  }
  acc = 0;
  resize();
  hud.showLauncher(false);
}

// The Proving Grounds: your Forge, escorts and Gleaners beside four asteroid fields, with
// hostiles on call from the sandbox panel (G).
function startProvingGrounds(testFleet = false) {
  const seed = parseInt(params.get('seed'), 10) || 7;
  startSession({
    seed, latency: 1, mode: 'skirmish', sandbox: true,
    space: { w: 192, d: 192, h: 64 },
    spawns: [[70, 96, 0]],
    fields: [
      { name: 'Tessel Shoal', at: [92, 82, 3], count: 9, spread: 5, ore: [500, 1100] },
      { name: 'Marrow Bank', at: [62, 128, -5], count: 10, spread: 6, ore: [700, 1400] },
      { name: 'Halvard Reach', at: [118, 118, 8], count: 11, spread: 7, ore: [800, 1700] },
      { name: 'Ostrel Deep', at: [158, 44, -8], count: 13, spread: 8, ore: [1400, 2400] },
    ],
    players: [
      { name: 'You', faction: params.get('faction') === 'cinder' ? 'cinder' : 'meridian', client: 0 },
      { name: 'Ashen Gaunt', faction: 'gaunt', team: 1, ships: [] },
      { name: 'Drift fauna', faction: 'fauna', team: 2, ships: [] },
    ],
    extraShips: testFleet ? ['dart', 'dart', 'halberd', 'dart', 'dart'] : [],
  }, { place: 'Proving Grounds' });
}

// A visit to a place on the voyage, with the run's stores and fleet aboard.
function startVisit(type, seed) {
  run ||= newRun(rules, { seed: (Math.random() * 1e9) | 0 });
  const settings = visitSettings(rules, run, { type, seed });
  startSession(settings, { place: settings.poi.name });
}

function showLauncher() {
  if (input) { input.dispose(); input = null; }
  session = null;
  closeChart();
  const saved = readSave();
  const sv = saved && saved.voyage;
  hud.showLauncher(true, {
    rules, run,
    save: sv ? { day: sv.day, life: (sv.campaign && sv.campaign.life) || 1, dead: V.lifeOver(sv), place: V.galaxyOf(rules, sv).points[sv.at].name, inMap: !!saved.map } : null,
    onContinue: () => { const d = readSave(); if (d) loadData(d); },
    onNewVoyage: (o) => newVoyage(o),
    slots: listSlots(),
    onLoad: (name) => { const d = readSlot(name); if (d) loadData(d); },
    onDelete: (name) => deleteSlot(name),
    onVisit: (type, seed) => startVisit(type, seed),
    onGrounds: () => startProvingGrounds(false),
    onNewRun: () => { run = null; showLauncher(); },
  });
}

// ---------------------------------------------------------------- the voyage and saving
// A save is { voyage, map? }: the campaign's current life (with the campaign inside it), and when
// saved in the middle of a map, the map's order log up to that frame (the map is rebuilt and
// replayed, exactly). One campaign save, written after every action on the chart and every
// visit; a life that has ended is saved too, so Continue comes back to the wake screen. It is
// removed only when the campaign is won or a new one starts. Named saves from before campaigns
// can still be loaded (they become the campaign); new ones are not made.
function snapshot() {
  const data = { voyage: JSON.parse(V.saveVoyage(voyage)) };
  if (session && session.onVoyage && !session.world.report) data.map = { frames: session.om.replay.frames.slice(), frame: session.world.frame };
  return data;
}
function parseSave(t) {
  if (!t) return null;
  const d = JSON.parse(t);
  const raw = d && d.kind === 'voyage' ? { voyage: d } : d; // saves from before Milestone 12 held only the voyage
  raw.voyage = V.loadVoyage(rules, JSON.stringify(raw.voyage));
  return raw;
}
function readSave() { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch (e) { console.warn(e); return null; } }
function writeSave(withMap = false) {
  try {
    if (!voyage || voyage.won) return;
    const d = snapshot();
    if (!withMap) delete d.map;
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch (e) { console.warn(e); }
}
function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { void e; } }
function slotsAll() { try { return JSON.parse(localStorage.getItem(SLOTS_KEY) || '{}'); } catch (e) { return {}; } }
function listSlots() { return Object.entries(slotsAll()).map(([name, x]) => ({ name, ...x, data: undefined })).sort((a, b) => b.when - a.when); }
function readSlot(name) { const x = slotsAll()[name]; try { return x ? parseSave(JSON.stringify(x.data)) : null; } catch (e) { console.warn(e); return null; } }
function deleteSlot(name) { const all = slotsAll(); delete all[name]; localStorage.setItem(SLOTS_KEY, JSON.stringify(all)); }
function saveSlot() {
  const g = V.galaxyOf(rules, voyage), place = g.points[voyage.at].name;
  const name = window.prompt('Name this save', `Day ${voyage.day}, ${place}`);
  if (!name) return false;
  const all = slotsAll();
  all[name] = { when: Date.now(), day: voyage.day, place, inMap: !!(session && session.onVoyage), data: snapshot() };
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(all)); hud.toast(`Saved: ${name}`, 'good'); return true; } catch (e) { hud.toast('Could not save: storage is full', 'bad'); return false; }
}
function loadData(d) {
  voyage = d.voyage;
  hud.saveMode = voyage.saves;
  if (d.map) resumeMap(d.map); else startChart();
}
// Back into a map saved part-way: rebuild it from the voyage and replay its orders.
function resumeMap(m) {
  const settings = V.visitSettings(rules, voyage);
  startSession(settings, { place: settings.poi.name, onVoyage: true });
  replayInto(session.world, m.frames, m.frame);
  const om = session.om;
  om.replay.frames = m.frames.slice();
  om.sentUpTo = m.frame;
  om.store(m.frame, om.local, []);
  const forge = input.forge();
  if (forge) { input.setSelection([forge], false); input.followSelection(); }
  hud.toast('Back where you left off', 'info');
}
// guided first voyage: each hint card once
function hint(when) {
  if (!voyage || !voyage.guided || voyage.over) return;
  for (const h of Object.values(rules.content.hints || {})) {
    if (h.When !== when || voyage.hints.includes(h.id)) continue;
    voyage.hints.push(h.id);
    hud.showHint(h.Title, h.Text);
    return;
  }
}
hud.hintFn = hint;
hud.onMapSave = () => {
  if (!voyage) return;
  writeSave(true);
  showLauncher();
};

function newVoyage(o = {}) {
  const seed = Number.isFinite(o.seed) ? o.seed : (Math.random() * 1e9) | 0;
  voyage = V.newVoyage(rules, { seed, length: o.length || 'full', guided: !!o.guided });
  hud.saveMode = voyage.saves;
  writeSave();
  startChart();
}
function closeChart() { if (chart) { chart.dispose(); chart = null; } }
function startChart() {
  if (input) { input.dispose(); input = null; }
  session = null;
  closeChart();
  hud.showLauncher(false);
  chart = new ChartScreen({
    canvas, camera, rules, voyage, audio, hud, comms: hud.comms, hint,
    onGoIn: () => goIn(),
    onChange: () => (voyage.won ? deleteSave() : writeSave()),
    onQuit: () => { writeSave(); showLauncher(); },
    onSave: () => saveSlot(),
    // the end of a life: wake into the next one; the end of the campaign: a new one or the title
    onEnd: (what) => {
      if (what === 'wake') { voyage = V.newLife(rules, voyage); writeSave(); startChart(); return; }
      if (voyage.won) deleteSave();
      if (what === 'new') { deleteSave(); newVoyage(); } else showLauncher();
    },
  });
  resize();
}
function goIn() {
  writeSave();
  const settings = V.visitSettings(rules, voyage);
  startSession(settings, { place: settings.poi.name, onVoyage: true });
  hint('map');
}

// When the Forge stitches away (or is destroyed): let the flash play, then the report; its
// button goes back to the star chart (or, for practice, the start screen).
function checkDeparture() {
  const w = session.world;
  if (!w.report || session.reported) return;
  session.reported = true;
  const report = w.report;
  if (session.onVoyage) {
    setTimeout(() => hud.showReport(report, () => {
      V.returnFromMap(rules, voyage, report);
      if (voyage.won) deleteSave(); else writeSave();
      startChart();
    }, { next: report.forgeLost ? 'Continue' : 'Back to the star chart' }), report.forgeLost ? 2400 : 1600);
    return;
  }
  setTimeout(() => hud.showReport(report, () => { run = applyReport(run, report); showLauncher(); }), 1600);
}

// ---------------------------------------------------------------- loop
// The simulation ticks at a fixed rate on its own timer; rendering interpolates between ticks.
let lastPump = performance.now();
function pump() {
  const now = performance.now();
  const dt = Math.min(1000, now - lastPump);
  lastPump = now;
  if (!session) return;
  acc += dt * session.speed;
  let n = 0;
  while (acc >= TICK_MS && n < 25) {
    if (!session.om.tryTick()) { acc = Math.min(acc, TICK_MS); break; }
    acc -= TICK_MS; n++;
  }
  if (n >= 25) acc = Math.min(acc, TICK_MS);
  // events wait for the next frame; a hidden tab (no frames) must not pile them up forever
  const ev = session.world.fxEvents;
  if (ev.length > 4000) ev.splice(0, ev.length - 2000);
}
setInterval(pump, 10);

let last = performance.now(), elapsed = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; elapsed += dt;
  if (chart) { chart.frame(dt, renderer); return; }
  if (!session) {
    if (!menu) { menu = { scene: new THREE.Scene() }; menu.space = new SpaceScene(menu.scene, { x0: 0, y0: 0, z0: -32 * 1024, x1: 192 * 1024, y1: 192 * 1024, z1: 32 * 1024 }, 23); }
    const c = 96 * 1024 * R;
    camera.position.set(c + Math.cos(elapsed * 0.02) * 10, 3, c + Math.sin(elapsed * 0.02) * 10);
    camera.lookAt(c, 2, c);
    menu.space.update(camera, renderer.getPixelRatio());
    renderer.render(menu.scene, camera);
    return;
  }
  pump();
  const alpha = session.om.stalled ? 1 : Math.min(1, acc / TICK_MS);
  const events = session.world.fxEvents;
  session.renderer.consumeEvents(events);
  hud.consumeEvents(events);
  events.length = 0;
  input.update(dt);
  session.orbit.update(dt);
  session.space.update(camera, renderer.getPixelRatio());
  session.renderer.update(elapsed, dt, alpha);
  hud.update(dt);
  checkDeparture();
  renderer.render(session.scene, camera);
}

$('btn-help').addEventListener('click', () => hud.toggleHelp());
$('btn-grounds').addEventListener('click', () => hud.toggleGrounds());
$('btn-build').addEventListener('click', () => hud.toggleBuild());
$('help-close').addEventListener('click', () => hud.toggleHelp(false));

(async () => {
  try {
    rules = await loadRules(async (f) => { const r = await fetch(f); if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`); return r.text(); });
    hud.comms = new CommsPanel(rules, audio);
    resize();
    // straight into a map from the address: ?grounds, ?poi=OreReef&seed=12, or #grounds, #fleet,
    // #OreReef (the hash forms work where query strings can't)
    const hash = location.hash.slice(1);
    const poi = params.get('poi') || (rules.content.poiTypes[hash] ? hash : '');
    if (params.has('grounds') || hash === 'grounds' || hash === 'fleet' || params.get('fleet') === 'test') startProvingGrounds(hash === 'fleet' || params.get('fleet') === 'test');
    else if (poi && rules.content.poiTypes[poi]) startVisit(poi, params.has('seed') ? parseInt(params.get('seed'), 10) : undefined);
    // #voyage or ?voyage=seed (&short, &guided): straight onto the star chart with a new voyage
    else if (hash === 'voyage' || params.has('voyage')) newVoyage({ seed: parseInt(params.get('voyage'), 10), length: params.has('short') ? 'short' : 'full', guided: params.has('guided') });
    else showLauncher();
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    $('boot-error').hidden = false;
    $('boot-error').textContent = `Driftforge could not start: ${e.message}`;
  }
})();

// Console helpers (also used by the browser tests)
window.driftforge = {
  get session() { return session; }, get world() { return session && session.world; }, get input() { return input; },
  get run() { return run; }, get rules() { return rules; }, get voyage() { return voyage; }, get chart() { return chart; },
  startVisit, startProvingGrounds, showLauncher, newVoyage, startChart, goIn, V, hud, snapshot, loadData,
};
