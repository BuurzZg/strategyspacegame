// Obstacle avoidance checks, no browser needed:  npm test
// Ships steer round asteroids and the Forge's hull instead of bumping and sliding along them.
// "Scraped" means crowding had to push the ship off a rock or a much bigger hull that tick.
import { makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const player = { name: 'Test', faction: 'meridian', client: 0 };
const C = (x, y, z = 0) => ({ x: x * CELL, y: y * CELL, z: z * CELL });

async function world(fields = []) {
  const w = await makeWorld({ players: [player], startingShips: [], fields });
  return w;
}
function rock(w, at, ore, radius) {
  return w.createActor('asteroid', w.neutral, { ...at, ore, radius, field: -1 });
}
// Fly one ship to a target; count ticks it scraped something.
function fly(w, ship, target, limit = 25 * 300) {
  w.resolveOrder(makeOrder('Move', [ship], target), w.players[0]);
  let f = 0, scraped = 0;
  for (; f < limit && (ship.activity || ship.mobile.speed > 0); f++) { w.tick(); if (ship.mobile.scraped === w.frame - 1) scraped++; }
  const miss = Math.abs(ship.x - target.x) + Math.abs(ship.y - target.y) + Math.abs(ship.z - target.z);
  return { f, scraped, miss };
}
const HULLS = ['dart', 'talon', 'gleaner', 'picket', 'halberd', 'smelter'];

// 1. A big rock dead ahead
for (const type of HULLS) {
  const w = await world();
  rock(w, C(80, 96), 5000, 1500);
  const ship = w.createActor(type, w.players[0], { ...C(62, 96), yaw: 0 });
  const r = fly(w, ship, C(98, 96));
  check(r.scraped === 0 && r.miss === 0, `${type.padEnd(8)} steers round a rock dead ahead (${(r.f / 25).toFixed(1)} s, scraped ${r.scraped} ticks)`);
}

// 2. Straight through a dense field
const FIELD = { name: 'Dense', at: [100, 96, 0], count: 16, spread: 7, ore: [800, 2200] };
for (const type of ['dart', 'talon', 'gleaner', 'picket', 'halberd']) {
  const w = await world([FIELD]);
  const ship = w.createActor(type, w.players[0], { ...C(76, 96), yaw: 0 });
  const r = fly(w, ship, C(124, 96, 2));
  check(r.scraped === 0 && r.miss === 0, `${type.padEnd(8)} threads a dense field without touching a rock (${(r.f / 25).toFixed(1)} s)`);
}

// 3. The Forge's hull: across it, and along it from stern to prow
for (const [label, from, to] of [['across', C(96, 80), C(96, 112)], ['along', C(80, 96), C(114, 96)], ['diagonally over', C(84, 86, -3), C(108, 106, 3)]]) {
  for (const type of ['dart', 'gleaner', 'halberd']) {
    const w = await world();
    w.createActor('forge', w.players[0], { ...C(96, 96), yaw: 0 });
    const ship = w.createActor(type, w.players[0], { ...from, yaw: 0 });
    const r = fly(w, ship, to);
    check(r.scraped === 0 && r.miss === 0, `${type.padEnd(8)} flies ${label} the Forge without scraping its hull (${(r.f / 25).toFixed(1)} s)`);
  }
}

// 4. A Gleaner coming home from behind the Forge flies round the hull to the furnace maw
{
  const w = await world();
  const forge = w.createActor('forge', w.players[0], { ...C(96, 96), yaw: 0 });
  const g = w.createActor('gleaner', w.players[0], { ...C(80, 97, -1), yaw: 0 });
  g.collector.cargo = 100;
  w.resolveOrder(makeOrder('Dock', [g], { actor: forge }), w.players[0]);
  let f = 0, scraped = 0;
  for (; f < 25 * 120 && !(g.activity && g.activity.label === 'Unloading'); f++) { w.tick(); if (g.mobile.scraped === w.frame - 1) scraped++; }
  check(g.activity && g.activity.label === 'Unloading' && scraped === 0, `a Gleaner behind the stern flies round the Forge to dock at the prow without touching the hull (${(f / 25).toFixed(1)} s)`);
}

// 5. A working economy: Gleaners criss-crossing a field and docking for four minutes
{
  const w = await makeWorld({ players: [player], spawns: [[70, 96, 0]], startingShips: ['forge', 'gleaner', 'gleaner', 'gleaner', 'gleaner'], fields: [{ name: 'Near', at: [92, 82, 3], count: 12, spread: 6, ore: [600, 1400] }] });
  const gs = w.actors.filter((a) => a.collector);
  let scraped = 0, flying = 0;
  for (let f = 0; f < 25 * 240; f++) {
    w.tick();
    for (const g of gs) { if (g.mobile.moving) flying++; if (g.mobile.scraped === w.frame - 1) scraped++; }
  }
  check(scraped * 100 <= flying, `four Gleaners mining for 4 minutes scrape a rock or the hull in ${scraped} of ${flying} moving ticks (under 1%)`);
}

// 6. Determinism with detours
async function run() {
  const w = await world([FIELD]);
  w.createActor('forge', w.players[0], { ...C(70, 120), yaw: 100 });
  const ships = ['dart', 'halberd', 'gleaner', 'picket'].map((t, i) => w.createActor(t, w.players[0], { ...C(74, 90 + i * 3), yaw: 0 }));
  w.resolveOrder(makeOrder('Move', ships, C(126, 100, 3)), w.players[0]);
  for (let f = 0; f < 25 * 90; f++) w.tick();
  return w.syncHash();
}
{
  const a = await run(), b = await run();
  check(a === b, `deterministic (hash ${a.toString(16)} both runs)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll avoidance checks passed');
process.exitCode = failures ? 1 : 0;
