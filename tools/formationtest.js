// Formation and stance checks, no browser needed:  npm test
// Groups form up, hold their slots while moving, turning and climbing, travel at the pace
// of their slowest ship, and settle facing the way they went. Stances do what they say.
import { makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, isqrt, distSq3, angleDiff } from '../src/engine/math.js';
import { FORMATIONS, slotTemplate } from '../src/traits/formation.js';
import { reach } from '../src/engine/avoid.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const C = (x, y, z = 0) => ({ x: x * CELL, y: y * CELL, z: z * CELL });
const MIX = ['halberd', 'picket', 'picket', 'talon', 'dart', 'dart', 'dart', 'dart'];

async function arena(withEnemy = false) {
  const w = await makeWorld({
    players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'Them', faction: 'gaunt', team: 1, ships: [] }],
    sandbox: true, startingShips: [],
  });
  const [us, them] = w.players;
  const events = [];
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { w.tick(); events.push(...w.fxEvents); w.fxEvents.length = 0; } };
  const order = (name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), subjects[0].owner);
  void withEnemy;
  return { w, us, them, tick, order, events };
}
function fleet(w, owner, types, x0 = 80, y0 = 96) {
  return types.map((t, i) => w.createActor(t, owner, { ...C(x0 + (i % 3) * 3 - 3, y0 + Math.trunc(i / 3) * 3 - 4, (i % 2) * 2), yaw: (i * 97) & 1023 }));
}
function slotError(w, ships) {
  const F = w.formations;
  let max = 0, sum = 0;
  for (const a of ships) {
    const g = F.groupOf(a); const p = F.slotPos(g, a.id);
    const e = isqrt(distSq3(a.x, a.y, a.z, p[0], p[1], p[2]));
    max = Math.max(max, e); sum += e;
  }
  return { max, mean: Math.trunc(sum / ships.length) };
}
const settled = (ships) => ships.every((a) => !a.activity);

// 1. Slot templates never put two hulls on top of each other
{
  let worst = Infinity, where = '';
  for (const type of FORMATIONS) for (let n = 2; n <= 24; n++) {
    const s = slotTemplate(type, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = isqrt(distSq3(s[i][0], s[i][1], s[i][2], s[j][0], s[j][1], s[j][2]));
      if (d < worst) { worst = d; where = `${type} ${n}`; }
    }
  }
  check(worst >= 900, `slots in every formation of 2 to 24 ships are at least 0.88 spacings apart (closest ${(worst / 1024).toFixed(2)}, ${where})`);
}

// 2. Forming up, a long move with a turn and a climb, and settling
for (const type of FORMATIONS) {
  const { w, us, tick, order } = await arena();
  const ships = fleet(w, us, MIX);
  order('SetFormation', ships, null, type);
  let f = 0;
  for (; f < 25 * 60 && !settled(ships); f++) tick();
  const formed = slotError(w, ships);
  const g = w.formations.groupOf(ships[0]);
  // fly 50 cells up-range, 40 across and 12 up: a long curve
  order('Move', ships, C(130, 140, 12));
  let worst = 0, sumMean = 0, n = 0, maxAnchor = 0;
  const slowest = Math.trunc((Math.min(...ships.map((a) => a.mobile.info.MaxSpeed)) * 85) / 100);
  let t = 0;
  for (; t < 25 * 240 && !(settled(ships) && !g.dest); t++) {
    tick();
    maxAnchor = Math.max(maxAnchor, g.speed);
    if (t > 25 * 8 && g.dest) { const e = slotError(w, ships); worst = Math.max(worst, e.max); sumMean += e.mean; n++; }
  }
  const end = slotError(w, ships);
  const facing = ships.every((a) => Math.abs(angleDiff(a.yaw, g.yaw)) <= a.mobile.info.TurnSpeed);
  check(formed.max <= 300, `${type.padEnd(6)} forms up in ${(f / 25).toFixed(1)} s (worst ship ${formed.max} from its slot)`);
  check(n > 0 && sumMean / n < 700 && worst < 3 * CELL, `${type.padEnd(6)} holds formation on a 6.5 km curving climb (mean ${Math.trunc(sumMean / Math.max(1, n))}, worst ${worst} units off-slot)`);
  check(maxAnchor <= slowest, `${type.padEnd(6)} moves at the slowest ship's pace (top ${maxAnchor} ≤ ${slowest})`);
  check(end.max <= 200 && facing && settled(ships), `${type.padEnd(6)} settles on its slots, facing the way it went (${(t / 25).toFixed(0)} s, worst ${end.max})`);
}

// 3. Group life: deaths re-shape the group, a subset leaves, Loose and the last ship dissolve
{
  const { w, us, tick, order } = await arena();
  const ships = fleet(w, us, ['halberd', 'dart', 'dart', 'dart']);
  order('SetFormation', ships, null, 'wedge');
  tick(25 * 20);
  const g = w.formations.groupOf(ships[0]);
  ships[3].health.damage(null, 1e9, null);
  tick(2);
  check(g.members.length === 3 && g.slots.length === 3, 'a group re-shapes itself when a member is destroyed');
  order('Move', [ships[1]], C(100, 96));
  tick();
  check(!ships[1].formation && g.members.length === 2, 'a ship ordered off on its own leaves its group');
  order('SetFormation', [ships[0], ships[2]], null, 'loose');
  tick();
  check(!ships[0].formation && !ships[2].formation && !w.formations.get(g.id), 'Loose dissolves the formation');
}

// 4. A group only moves as a formation when you move the whole group
{
  const { w, us, tick, order } = await arena();
  const a = fleet(w, us, ['dart', 'dart', 'dart']);
  const b = fleet(w, us, ['picket', 'picket'], 90, 110);
  order('SetFormation', a, null, 'column');
  order('SetFormation', b, null, 'ring');
  tick(10);
  order('Move', [...a, ...b], C(120, 90));
  tick();
  check(a.concat(b).every((s) => !s.formation), 'moving two groups at once breaks them into a loose move');
  void w;
}

// 5. Stances
{
  const { w, us, them, tick, order, events } = await arena();
  const passive = w.createActor('dart', us, { ...C(90, 96), yaw: 0 });
  order('SetStance', [passive], null, 'passive');
  const enemy = w.createActor('picket', them, { ...C(93, 96), yaw: 512 });
  tick(25 * 10);
  check(!events.some((e) => e.t === 'fire' && e.actor === passive.id), 'a Passive ship never fires, even with an enemy in its sights');
  check(passive.dead || isqrt(distSq3(passive.x, passive.y, passive.z, enemy.x, enemy.y, enemy.z)) > 12 * CELL || (passive.activity && passive.activity.label === 'Fleeing'), 'and it flees when it is shot at');
  const { w: w2, us: u2, them: t2, tick: k2, order: o2, events: e2 } = await arena();
  const def = w2.createActor('halberd', u2, { ...C(90, 96), yaw: 0 });
  o2('SetStance', [def], null, 'defensive');
  const bait = w2.createActor('picket', t2, { ...C(93, 96), yaw: 512 });
  bait.trait('Attacks').info = { ...bait.trait('Attacks').info, HoldFire: true };
  bait.trait('AutoTarget').timer = 1e9;
  w2.resolveOrder(makeOrder('Move', [bait], C(110, 96)), t2);
  const x0 = def.x, y0 = def.y;
  k2(25 * 20);
  const moved = isqrt(distSq3(def.x, def.y, 0, x0, y0, 0));
  check(e2.some((e) => e.t === 'fire' && e.actor === def.id) && moved < 512, `a Defensive Halberd fires at an enemy in range but does not chase it (moved ${moved})`);
  const { w: w3, us: u3, them: t3, tick: k3, order: o3 } = await arena();
  const agg = w3.createActor('halberd', u3, { ...C(90, 96), yaw: 0 });
  const runner = w3.createActor('picket', t3, { ...C(93, 96), yaw: 512 });
  runner.trait('Attacks').info = { ...runner.trait('Attacks').info, HoldFire: true };
  runner.trait('AutoTarget').timer = 1e9;
  k3(16);
  w3.resolveOrder(makeOrder('Move', [runner], C(104, 96)), t3);
  const ax = agg.x;
  k3(25 * 15);
  check(agg.x - ax > 3 * CELL, 'an Aggressive Halberd chases it');
  void o3;
  // collectors are Passive by default
  const { w: w4, us: u4 } = await arena();
  const gl = w4.createActor('gleaner', u4, { ...C(90, 96) });
  check(gl.stance.mode === 'passive' && w4.createActor('forge', u4, { ...C(60, 96) }).stance.mode === 'defensive', 'Gleaners start Passive and the Forge Defensive');
}

// 6. An advancing formation stops to fight, then carries on in formation
{
  const { w, us, them, tick, order } = await arena();
  const ships = fleet(w, us, ['halberd', 'picket', 'picket', 'dart', 'dart']);
  order('SetFormation', ships, null, 'wedge');
  tick(25 * 20);
  const enemy = w.createActor('talon', them, { ...C(100, 96), yaw: 512 });
  enemy.trait('AutoTarget').timer = 1e9;
  order('AttackMove', ships, C(125, 96));
  let fought = false;
  const g = w.formations.groupOf(ships[0]);
  for (let i = 0; i < 25 * 120 && !(settled(ships) && !g.dest); i++) { tick(); if (ships.some((a) => a.activity && a.activity.label === 'Attacking')) fought = true; }
  const e = slotError(w, ships.filter((a) => !a.dead));
  check(fought && enemy.dead && e.max <= 300, `an advancing wedge destroys an enemy in its path and reforms at the destination (worst ${e.max})`);
}

// 7. Determinism
async function run() {
  const { w, us, them, tick, order } = await arena();
  const ships = fleet(w, us, MIX);
  order('SetFormation', ships, null, 'sphere');
  tick(25 * 10);
  w.createActor('dart', them, { ...C(110, 110), yaw: 0 });
  order('AttackMove', ships, C(120, 120, 6));
  tick(25 * 40);
  order('SetFormation', ships.filter((a) => !a.dead), null, 'wall');
  tick(25 * 20);
  return w.syncHash();
}
{
  const a = await run(), b = await run();
  check(a === b, `deterministic (hash ${a.toString(16)} both runs)`);
}
void reach;

console.log(failures ? `\n${failures} check(s) failed` : '\nAll formation checks passed');
process.exitCode = failures ? 1 : 0;
