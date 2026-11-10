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

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const canvas = $('view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 20000);
const audio = new Audio();
const hud = new Hud();
let session = null, input = null, space = null, acc = 0;

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
  }
}
window.addEventListener('resize', resize);

// Milestone 2 sandbox: your Forge and escorts in an empty stretch of the Drift.
function startSkirmish(rules) {
  const seed = parseInt(params.get('seed'), 10) || 7;
  const test = params.get('fleet') === 'test' || location.hash === '#fleet'; // the hash form works where query strings can't
  const settings = {
    seed, latency: 1, mode: 'skirmish',
    space: { w: 192, d: 192, h: 64 },
    spawns: [[70, 96, 0]],
    players: [{ name: 'You', faction: params.get('faction') === 'cinder' ? 'cinder' : 'meridian', client: 0 }],
    extraShips: test ? ['dart', 'dart', 'halberd', 'dart', 'dart'] : [],
  };
  const world = new World(rules, settings);
  const viewer = world.players[0];
  const om = new OrderManager(world, new LocalConnection(), { localClient: 0, clients: [0], latency: 1 });
  space = new SpaceScene(scene, world.bounds, seed);
  const rd = new WorldRenderer(scene, world, viewer);
  const orbit = new OrbitCamera(camera);
  const b = world.bounds;
  const renderBounds = { x0: b.x0 * R, x1: b.x1 * R, y0: b.z0 * R, y1: b.z1 * R, z0: b.y0 * R, z1: b.y1 * R };
  orbit.bounds = renderBounds;
  session = { world, om, viewer, scene, camera, orbit, renderer: rd, renderBounds, speed: 1 };
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
    input.followSelection(); // the camera rides with the selection until you pan away
  }
  resize();
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
  if (!session) return;
  pump();
  const alpha = session.om.stalled ? 1 : Math.min(1, acc / TICK_MS);
  const events = session.world.fxEvents;
  session.renderer.consumeEvents(events);
  hud.consumeEvents(events);
  events.length = 0;
  input.update(dt);
  session.orbit.update(dt);
  space.update(camera, renderer.getPixelRatio());
  session.renderer.update(elapsed, dt, alpha);
  hud.update(dt);
  renderer.render(scene, camera);
}

$('btn-help').addEventListener('click', () => hud.toggleHelp());
$('help-close').addEventListener('click', () => hud.toggleHelp(false));

(async () => {
  try {
    const rules = await loadRules(async (f) => { const r = await fetch(f); if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`); return r.text(); });
    startSkirmish(rules);
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    $('boot-error').hidden = false;
    $('boot-error').textContent = `Driftforge could not start: ${e.message}`;
  }
})();

// Console helpers (also used by the browser tests)
window.driftforge = { get session() { return session; }, get world() { return session && session.world; }, get input() { return input; } };
