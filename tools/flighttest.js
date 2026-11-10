// Flight-model checks, no browser needed:  npm test
// Every ship type must reach awkward 3D targets exactly, stop, and do it deterministically.
import { makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, dist3 } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const player = { name: 'Test', faction: 'meridian', client: 0 };

// Targets relative to the start (cells): [dx, dy, dz, label]
const CASES = [
  [60, 0, 0, 'long run ahead'],
  [-30, 0, 0, 'target behind'],
  [0, 0, 20, 'straight up'],
  [0, 0, -20, 'straight down'],
  [25, 25, 15, 'climbing diagonal'],
  [1, 0, 0, 'tiny hop'],
  [-40, -40, -25, 'dive behind and left'],
];

async function fly(type, [dx, dy, dz]) {
  const w = await makeWorld({ players: [player] });
  w.actors.forEach((a) => w.removeActor(a));
  const ship = w.createActor(type, w.players[0], { x: 96 * CELL, y: 96 * CELL, z: 0, yaw: 0 });
  const t = { x: ship.x + dx * CELL, y: ship.y + dy * CELL, z: ship.z + dz * CELL };
  w.resolveOrder(makeOrder('Move', [ship], t), w.players[0]);
  let f = 0, maxSpeed = 0;
  for (; f < 25 * 240 && (ship.activity || ship.mobile.speed > 0); f++) { w.tick(); maxSpeed = Math.max(maxSpeed, ship.mobile.speed); }
  return { ship, t, f, maxSpeed, miss: dist3(ship.x, ship.y, ship.z, t.x, t.y, t.z), hash: w.syncHash() };
}

for (const type of ['halberd', 'dart']) {
  for (const c of CASES) {
    const r = await fly(type, c);
    const secs = (r.f / 25).toFixed(1);
    check(r.miss === 0 && r.ship.mobile.speed === 0 && !r.ship.activity, `${type.padEnd(8)} ${c[3].padEnd(22)} arrived in ${secs.padStart(5)} s (top speed ${r.maxSpeed}, miss ${r.miss})`);
  }
}

// Determinism: same orders, same result.
const a = await fly('halberd', CASES[4]), b = await fly('halberd', CASES[4]);
check(a.hash === b.hash && a.f === b.f, `deterministic (hash ${a.hash.toString(16)} both runs)`);

// Group move keeps the group's shape (roughly) and everyone arrives.
{
  const w = await makeWorld({ players: [player], extraShips: ['dart', 'dart', 'dart', 'dart'] });
  const ships = w.actors.slice();
  const t = { x: 140 * CELL, y: 70 * CELL, z: 12 * CELL };
  w.resolveOrder(makeOrder('Move', ships, t), w.players[0]);
  let f = 0;
  for (; f < 25 * 240 && ships.some((s) => s.activity || s.mobile.speed > 0); f++) w.tick();
  let cx = 0, cy = 0, cz = 0;
  for (const s of ships) { cx += s.x; cy += s.y; cz += s.z; }
  const n = ships.length, off = dist3(cx / n, cy / n, cz / n, t.x, t.y, t.z);
  const spread = Math.max(...ships.map((s) => dist3(s.x, s.y, s.z, cx / n, cy / n, cz / n)));
  check(off < 2 * CELL && spread < 12 * CELL, `group of ${n} arrived in ${(f / 25).toFixed(1)} s, centre ${(off / CELL).toFixed(2)} cells from target, spread ${(spread / CELL).toFixed(1)} cells`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll flight checks passed');
process.exit(failures ? 1 : 0);
