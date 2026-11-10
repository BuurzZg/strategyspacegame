// Production checks, no browser needed:  npm test
// The Forge builds ships on time, launches them clear of its hull, sends them to the rally
// point, and refuses orders that break the ore, capacity or queue limits.
import { makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, dist3, sin as SIN, cos as COS } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const player = { name: 'Test', faction: 'meridian', client: 0 };
const run = (w, n) => { for (let i = 0; i < n; i++) w.tick(); };
const order = (w, name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), w.players[0]);
const settle = (w, ships, limit = 25 * 120) => { let f = 0; for (; f < limit && ships.some((s) => s.activity || s.mobile.speed > 0); f++) w.tick(); return f; };
async function setup(extra = {}) {
  const w = await makeWorld({ players: [player], ...extra });
  const forge = w.actors.find((a) => a.type === 'forge');
  const built = [], at = [];
  // where each ship appeared, in the builder's own frame: forward along its nose, out to port
  w.on('produced', (u, f) => {
    built.push(u);
    const rx = u.x - f.x, ry = u.y - f.y;
    at.push({ fwd: Math.trunc((rx * COS(f.yaw) + ry * SIN(f.yaw)) / 1024), port: Math.trunc((-rx * SIN(f.yaw) + ry * COS(f.yaw)) / 1024), up: u.z - f.z, yaw: f.yaw });
  });
  const notes = () => w.fxEvents.filter((e) => e.t === 'notify').map((e) => e.text);
  return { w, p: w.players[0], forge, q: forge.trait('ProductionQueue'), built, at, notes };
}

// 1. Build time, cost, launch and muster
{
  const { w, p, forge, q, built, at } = await setup();
  const cash0 = p.resources.cash;
  order(w, 'StartProduction', [forge], null, 'dart');
  check(p.resources.cash === cash0 - 60 && q.queue.length === 1, 'queueing a Dart takes its 60 ore up front');
  const dur = q.duration('dart');
  run(w, dur - 1);
  check(built.length === 0, `nothing launches before the build time (${dur} ticks, ${dur / 25} s)`);
  run(w, 1);
  check(built.length === 1 && built[0].type === 'dart', 'the Dart launches on the tick its build completes');
  const d = built[0];
  // spawned in the port bay mouth: ahead of centre by Forward, out to port by Side
  const bay = forge.info.traitInfo('LaunchBay');
  check(Math.abs(at[0].fwd - bay.Forward) <= 2 && Math.abs(at[0].port - bay.Side) <= 2, `it appears in the port bay mouth (forward ${at[0].fwd}, port ${at[0].port})`);
  check(Math.abs(d.x - forge.x - (at[0].fwd * COS(forge.yaw) - at[0].port * SIN(forge.yaw)) / 1024) <= 2, 'and is not pushed out of the bay on its first tick');
  let launching = 0;
  for (let i = 0; i < 25 * 10 && d.activity && d.activity.constructor.name === 'Launch'; i++) { w.tick(); if (d.mobile.launching) launching++; }
  const clear = dist3(d.x, d.y, d.z, forge.x, forge.y, forge.z);
  check(launching > 0 && clear >= forge.health.info.Radius + d.health.info.Radius, `it flies clear of the hull first (${(launching / 25).toFixed(1)} s, ${(clear / CELL).toFixed(1)} cells from the Forge's centre)`);
  const goal = d.mobile.goal;
  const f = settle(w, [d]);
  check(dist3(d.x, d.y, d.z, goal.x, goal.y, goal.z) === 0 && !d.activity, `then stops at its muster slot beside the bay (${(f / 25).toFixed(1)} s later)`);
}

// 2. Bays alternate; a rally point collects new ships
{
  const { w, forge, q, built, at } = await setup();
  const home = { x: forge.x, y: forge.y, z: forge.z };
  order(w, 'StartProduction', [forge], null, 'talon');
  order(w, 'StartProduction', [forge], null, 'picket');
  order(w, 'StartProduction', [forge], null, 'dart');
  // a rally point close enough that the new ships crowd the Forge's hull
  const rally = { x: forge.x + 7 * CELL, y: forge.y - 2 * CELL, z: 2 * CELL };
  order(w, 'SetRallyPoint', [forge], rally);
  run(w, q.duration('talon') + q.duration('picket') + q.duration('dart'));
  check(built.length === 3, 'Talon, Picket and Dart build one after the other');
  const sides = at.map((s) => (s.port > 0 ? 'port' : 'starboard'));
  check(sides.join() === 'port,starboard,port', `bays alternate: ${sides.join(', ')}`);
  settle(w, built);
  run(w, 25 * 20);
  const far = Math.max(...built.map((u) => dist3(u.x, u.y, u.z, rally.x, rally.y, rally.z)));
  check(far <= 8 * CELL && built.every((u) => !u.activity), `all three fly to the rally point (furthest ${(far / CELL).toFixed(1)} cells from it)`);
  check(forge.x === home.x && forge.y === home.y && forge.z === home.z, 'ships crowding round the Forge never shove it');
  order(w, 'ClearRallyPoint', [forge]);
  check(forge.trait('RallyPoint').point === null, 'the rally point can be cleared');
}

// 2b. A rally point inside the Forge's own hull: ships get as close as they can, then stop
{
  const { w, forge, q, built } = await setup();
  for (let i = 0; i < 4; i++) order(w, 'StartProduction', [forge], null, i % 2 ? 'talon' : 'dart');
  order(w, 'SetRallyPoint', [forge], { x: forge.x + 2 * CELL, y: forge.y, z: forge.z });
  run(w, 4 * q.duration('talon'));
  const f = settle(w, built, 25 * 90);
  check(built.length === 4 && built.every((u) => !u.activity && u.mobile.speed === 0), `with the rally point inside the Forge, ships stop at its hull instead of pushing forever (${(f / 25).toFixed(1)} s)`);
}

// 3. Fleet capacity
{
  const { w, p, forge, q, notes } = await setup();
  p.resources.cash = 100000;
  const cap = p.capacity.cap(), used0 = p.capacity.used();
  check(cap === 30 && used0 === 8, `the Forge provides 30 capacity; the starting Halberd and two Darts use ${used0}`);
  for (let i = 0; i < 4; i++) order(w, 'StartProduction', [forge], null, 'halberd');
  check(q.queue.length === 3 && p.capacity.used() === 26, 'three Halberds fit (26/30); queued ships count against the cap');
  check(p.resources.cash === 100000 - 3 * 450 && notes().includes('Fleet capacity reached'), 'the fourth is refused with "Fleet capacity reached" and costs nothing');
  for (let i = 0; i < 5; i++) order(w, 'StartProduction', [forge], null, 'dart');
  check(p.capacity.used() === 30 && q.queue.length === 7, 'four Darts fill the last of it; the fifth is refused');
  order(w, 'CancelProduction', [forge], null, 0);
  check(p.capacity.used() === 24 && p.resources.cash === 100000 - 2 * 450 - 4 * 60, 'cancelling a Halberd frees its capacity and refunds its ore');
}

// 4. Cancelling, ore and queue limits
{
  const { w, p, forge, q, notes } = await setup();
  order(w, 'StartProduction', [forge], null, 'picket');
  order(w, 'StartProduction', [forge], null, 'dart');
  order(w, 'StartProduction', [forge], null, 'talon');
  run(w, 100);
  const cash = p.resources.cash;
  order(w, 'CancelProduction', [forge], null, 1);
  check(q.queue.join() === 'picket,talon' && q.progress === 100 && p.resources.cash === cash + 60, 'cancelling a waiting item keeps the current build going');
  order(w, 'CancelProduction', [forge], null, 0);
  check(q.queue.join() === 'talon' && q.progress === 0 && p.resources.cash === cash + 60 + 140, 'cancelling the item in progress resets progress and refunds it');
  order(w, 'CancelProduction', [forge], null, 7);
  check(q.queue.length === 1, 'cancelling an index past the end does nothing');
  p.resources.cash = 50;
  order(w, 'StartProduction', [forge], null, 'dart');
  check(q.queue.length === 1 && notes().includes('Not enough ore'), 'a Dart is refused at 50 ore with "Not enough ore"');
  p.resources.cash = 100000;
  order(w, 'CancelProduction', [forge], null, 0);
  for (let i = 0; i < 12; i++) order(w, 'StartProduction', [forge], null, 'dart');
  check(q.queue.length === 10 && notes().includes('Build queue is full'), 'the queue holds 10; the 11th is refused with "Build queue is full"');
  order(w, 'StartProduction', [forge], null, 'forge');
  check(q.queue.length === 10 && notes().includes('The Forge cannot build that'), 'it refuses to build something that is not buildable');
}

// 5. Losing the Forge refunds its queue
{
  const { w, p, forge } = await setup();
  const cash0 = p.resources.cash;
  order(w, 'StartProduction', [forge], null, 'halberd');
  order(w, 'StartProduction', [forge], null, 'dart');
  run(w, 50);
  forge.health.kill(null, null);
  run(w, 1);
  check(p.resources.cash === cash0 && p.capacity.cap() === 0, 'a destroyed Forge refunds its queue and its capacity is gone');
}

// 6. A Forge that has turned launches from its own flanks
{
  const { w, forge, q, built, at } = await setup();
  const bay = forge.info.traitInfo('LaunchBay');
  order(w, 'Move', [forge], { x: forge.x - 10 * CELL, y: forge.y + 30 * CELL, z: forge.z + 8 * CELL });
  order(w, 'StartProduction', [forge], null, 'dart');
  order(w, 'StartProduction', [forge], null, 'dart');
  run(w, 2 * q.duration('dart'));
  const ok = at.length === 2 && at.every((s, i) => Math.abs(s.fwd - bay.Forward) <= 2 && Math.abs(s.port - (i ? -bay.Side : bay.Side)) <= 2 && s.up === bay.Up);
  check(ok && at[0].yaw !== at[1].yaw, `a turning Forge launches from its own flanks (yaw ${at[0].yaw} then ${at[1].yaw})`);
  const f = settle(w, built);
  check(built.every((u) => !u.activity), `and both ships reach their muster slots (${(f / 25).toFixed(1)} s)`);
}

// 7. Determinism through a production-heavy run
async function scripted() {
  const { w, forge } = await setup();
  order(w, 'StartProduction', [forge], null, 'dart');
  order(w, 'StartProduction', [forge], null, 'picket');
  order(w, 'SetRallyPoint', [forge], { x: forge.x + 20 * CELL, y: forge.y + 10 * CELL, z: 5 * CELL });
  order(w, 'StartProduction', [forge], null, 'talon');
  run(w, 300);
  order(w, 'Move', [forge], { x: forge.x + 15 * CELL, y: forge.y, z: forge.z });
  order(w, 'CancelProduction', [forge], null, 1);
  run(w, 25 * 60);
  return { hash: w.syncHash(), n: w.actors.length };
}
{
  const a = await scripted(), b = await scripted();
  check(a.hash === b.hash && a.n === b.n, `deterministic (hash ${a.hash.toString(16)} both runs, ${a.n} ships)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll production checks passed');
process.exitCode = failures ? 1 : 0;
