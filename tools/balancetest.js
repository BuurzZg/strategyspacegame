// Balance matrix, no browser needed:  npm test
// Cost-matched battles for every counter in the plan. Each pair is fought twice, with the
// sides swapped, and the counter must win both with a clear margin.
import { makeWorld } from './headless.js';
import { makeWorldOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

const value = (w, p) => w.actors.filter((a) => a.owner === p && a.health && !a.dead)
  .reduce((s, a) => s + Math.trunc(((a.info.traitInfo('Valued')?.Cost || 300) * a.health.hp) / a.health.maxHp), 0);

export async function battle(left, right, limit = 25 * 300) {
  const w = await makeWorld({
    players: [{ name: 'Left', faction: 'meridian', client: 0, ships: [] }, { name: 'Right', faction: 'gaunt', team: 1, ships: [] }],
    sandbox: true, startingShips: [],
  });
  const L = [80 * CELL, 96 * CELL, 0], R = [112 * CELL, 96 * CELL, 0];
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: left, at: L, attack: R }), null);
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: right, at: R, attack: L }), null);
  const [pl, pr] = w.players;
  const v0 = [value(w, pl), value(w, pr)];
  let f = 0;
  for (; f < limit; f++) {
    w.tick();
    if (f % 25 === 0 && (!value(w, pl) || !value(w, pr))) break;
  }
  const v = [value(w, pl), value(w, pr)];
  return { left: v[0], right: v[1], leftPct: Math.round((v[0] * 100) / v0[0]), rightPct: Math.round((v[1] * 100) / v0[1]), secs: Math.round(f / 25), hash: w.syncHash() };
}
const n = (type, k) => Array(k).fill(type);

// [counter, its victim, why]
export const MATCHUPS = [
  [n('picket', 6), n('dart', 14), 'Pickets (flak) beat Darts'],
  [n('halberd', 2), n('picket', 6), 'Halberds beat Pickets'],
  [n('talon', 10), n('halberd', 2), 'Talons beat Halberds'],
  [n('dart', 15), n('talon', 10), 'Darts beat Talons'],
  [n('sabre', 1), n('halberd', 2), 'a Sabre beats Halberds'],
  [n('spindle', 2), n('sabre', 1), 'Spindles beat a Sabre'],
  [n('dart', 13), n('spindle', 2), 'Darts beat Spindles'],
  [n('picket', 6), n('gnasher', 8), 'Pickets beat a Gnasher pack'],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [win, lose, label] of MATCHUPS) {
    const a = await battle(win, lose), b = await battle(lose, win);
    const ok = a.right === 0 && a.leftPct >= 25 && b.left === 0 && b.rightPct >= 25;
    check(ok, `${label.padEnd(30)} kept ${a.leftPct}% / ${b.rightPct}% of their value (${a.secs} s / ${b.secs} s)`);
  }
  const x = await battle([...n('dart', 6), ...n('picket', 3), 'halberd', 'sabre'], [...n('talon', 6), ...n('gnasher', 4), 'spindle', 'halberd']);
  const y = await battle([...n('dart', 6), ...n('picket', 3), 'halberd', 'sabre'], [...n('talon', 6), ...n('gnasher', 4), 'spindle', 'halberd']);
  check(x.hash === y.hash, `a mixed battle is deterministic (hash ${x.hash.toString(16)} both runs)`);
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll balance checks passed');
  process.exitCode = failures ? 1 : 0;
}
