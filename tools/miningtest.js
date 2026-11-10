// Mining checks, no browser needed:  npm test
// Gleaners mine, dock, unload and undock; ore is conserved; income lands in the expected
// range; fields deplete; Smelters, orders, dock slots and solid hulls behave.
import { makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, dist3 } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const player = { name: 'Test', faction: 'meridian', client: 0 };
const NEAR = { name: 'Near', at: [92, 82, 3], count: 6, spread: 5, ore: [800, 800] };

async function setup(startingShips, fields = [NEAR], extra = {}) {
  const w = await makeWorld({ players: [player], spawns: [[70, 96, 0]], startingShips, fields, ...extra });
  const p = w.players[0];
  const deposits = [];
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      w.tick();
      for (const e of w.fxEvents) if (e.t === 'deposit') deposits.push(e);
      w.fxEvents.length = 0;
    }
  };
  const order = (name, subjects, target, extra2) => w.resolveOrder(makeOrder(name, subjects, target, extra2), p);
  const of = (type) => w.actors.filter((a) => a.type === type);
  const fieldOre = () => w.traitsOfType('Asteroid').reduce((s, t) => s + (t.self.dead ? 0 : t.ore), 0);
  return { w, p, tick, order, of, deposits, fieldOre, forge: of('forge')[0] };
}
const label = (a) => (a.activity ? a.activity.label : 'idle');

// 1. One full trip
{
  const { w, p, tick, of, deposits, fieldOre, forge } = await setup(['forge', 'gleaner']);
  const g = of('gleaner')[0], cash0 = p.resources.cash, ore0 = fieldOre();
  const seen = [];
  let ghostDocked = true, onSlot = true, f = 0;
  for (; f < 25 * 120 && !deposits.length; f++) {
    tick();
    const l = label(g);
    if (seen[seen.length - 1] !== l) seen.push(l);
    if (l === 'Unloading') {
      const dt = forge.trait('OreDropoff'), slot = dt.slots.indexOf(g.id), pose = dt.slotPose(slot);
      if (!g.mobile.ghost) ghostDocked = false;
      if (dist3(g.x, g.y, g.z, pose.x, pose.y, pose.z) !== 0) onSlot = false;
    }
  }
  check(deposits.length === 1 && deposits[0].amount === 100, `a Gleaner fills its 100-ore hold and delivers it (${(f / 25).toFixed(1)} s for the first trip)`);
  check(p.resources.cash === cash0 + 100 && fieldOre() === ore0 - 100 && g.collector.cargo === 0, 'the bank gains exactly what the field lost');
  const want = ['Heading out', 'Mining', 'Returning', 'Docking', 'Unloading', 'Undocking'];
  check(want.every((s) => seen.includes(s)) && seen.indexOf('Mining') < seen.indexOf('Returning') && seen.indexOf('Docking') < seen.indexOf('Unloading'), `it goes through every stage in order: ${seen.join(' → ')}`);
  check(ghostDocked && onSlot, 'while unloading it sits exactly on its dock slot on the furnace maw, clear of crowding');
  tick(25 * 10);
  check(forge.trait('OreDropoff').slots.every((s) => s === 0) && g.collector.dock === 0 && label(g) !== 'idle', 'after undocking it frees the slot and heads back out');
}

// 2. Income rate from the near field
{
  const { tick, deposits } = await setup(['forge', 'gleaner'], [{ ...NEAR, count: 9, ore: [1500, 1500] }]);
  tick(25 * 60);
  const before = deposits.reduce((s, d) => s + d.amount, 0);
  tick(25 * 60 * 5);
  const rate = (deposits.reduce((s, d) => s + d.amount, 0) - before) / 5;
  check(rate >= 120 && rate <= 220, `one Gleaner on the near field (~2.6 km out) brings in ${rate} ore/min (expected 120-220)`);
}

// 3. Several Gleaners: ore is conserved, work is spread, dock slots are respected
{
  const { w, p, tick, of, deposits, fieldOre, forge } = await setup(['forge', 'gleaner', 'gleaner', 'gleaner', 'gleaner', 'gleaner']);
  const gs = of('gleaner'), cash0 = p.resources.cash, ore0 = fieldOre();
  let maxDocked = 0, maxTargets = 0;
  for (let f = 0; f < 25 * 240; f++) {
    tick();
    maxDocked = Math.max(maxDocked, gs.filter((g) => label(g) === 'Unloading').length);
    maxTargets = Math.max(maxTargets, new Set(gs.map((g) => g.collector.target).filter(Boolean)).size);
  }
  const aboard = gs.reduce((s, g) => s + g.collector.cargo, 0);
  check(ore0 === fieldOre() + (p.resources.cash - cash0) + aboard, `ore is conserved: ${ore0} in the field = ${fieldOre()} left + ${p.resources.cash - cash0} banked + ${aboard} aboard`);
  check(maxTargets >= 3, `five Gleaners spread over the rocks (up to ${maxTargets} different rocks at once)`);
  check(maxDocked <= 3 && deposits.length >= 15, `never more than three dock at the Forge at once (max ${maxDocked}); ${deposits.length} deliveries in 4 minutes`);
  void w; void forge;
}

// 4. Depletion: rocks break up, the Gleaner moves on, then brings home the last of it and stops
{
  const { w, p, tick, of, deposits } = await setup(['forge', 'gleaner'], [{ ...NEAR, count: 3, ore: [150, 150] }]);
  const g = of('gleaner')[0], cash0 = p.resources.cash;
  const rocks = () => w.actors.filter((a) => a.asteroid).length;
  const r0 = rocks();
  let f = 0;
  for (; f < 25 * 300 && (rocks() > 0 || g.activity || g.collector.cargo); f++) tick();
  check(r0 === 3 && rocks() === 0, 'each rock is removed from space when its last ore is taken');
  check(p.resources.cash === cash0 + 450 && g.collector.cargo === 0 && !g.activity, `the Gleaner banks all 450 ore, then waits (${deposits.length} trips, ${(f / 25).toFixed(0)} s)`);
  const fr = w.frame;
  tick(25 * 10);
  check(!g.activity && g.collector.auto && w.frame === fr + 250, 'with nothing left to mine it stays idle instead of looping');
}

// 5. A Smelter by a distant field takes the deliveries
{
  const far = { name: 'Far', at: [150, 50, -6], count: 8, spread: 5, ore: [1400, 2400] };
  const { w, tick, of, order, deposits } = await setup(['forge', 'smelter', 'gleaner', 'gleaner'], [far]);
  const sm = of('smelter')[0], forge = of('forge')[0];
  order('Move', [sm], { x: 142 * CELL, y: 56 * CELL, z: -6 * CELL });
  tick(25 * 300);
  const toSm = deposits.filter((d) => d.dock === sm.id).length, toForge = deposits.filter((d) => d.dock === forge.id).length;
  check(toSm >= 6 && toSm > toForge * 3, `Gleaners mining the far field unload at the Smelter parked beside it (${toSm} trips to the Smelter, ${toForge} to the Forge)`);
  void w;
}

// 6. A docked Gleaner rides along when its dock moves
{
  const { w, tick, of, order, forge } = await setup(['forge', 'gleaner']);
  const g = of('gleaner')[0], dt = forge.trait('OreDropoff');
  for (let f = 0; f < 25 * 120 && label(g) !== 'Unloading'; f++) tick();
  order('Move', [forge], { x: forge.x + 20 * CELL, y: forge.y + 20 * CELL, z: forge.z + 5 * CELL });
  let stuckOn = true, n = 0;
  for (; n < 25 * 3 && label(g) === 'Unloading'; n++) {
    tick();
    const pose = dt.slotPose(dt.slots.indexOf(g.id));
    if (label(g) === 'Unloading' && dist3(g.x, g.y, g.z, pose.x, pose.y, pose.z) !== 0) stuckOn = false;
  }
  check(n > 0 && stuckOn && forge.mobile.speed > 0, `it stays on its slot while the Forge gets under way (${n} ticks unloading on the move)`);
  void w;
}

// 7. Orders
{
  const { w, tick, of, order, forge, p } = await setup(['forge', 'gleaner']);
  const g = of('gleaner')[0];
  tick(25 * 8);
  order('Move', [g], { x: g.x + 10 * CELL, y: g.y, z: g.z });
  tick(25 * 30);
  check(!g.activity && !g.collector.auto && g.collector.target === 0, 'a move order takes a Gleaner off mining, and it stays put afterwards');
  const rock = w.actors.filter((a) => a.asteroid).sort((a, b) => b.asteroid.ore - a.asteroid.ore)[0];
  order('Harvest', [g], { actor: rock });
  tick(25 * 20);
  check(g.collector.auto && (g.collector.target === rock.id || g.collector.cargo > 0) && rock.asteroid.ore < rock.asteroid.maxOre, 'right-clicking a rock (Harvest) sends it to mine that rock');
  // wait for the hold to be part-full (between trips: empty it first if it is already full)
  for (let i = 0; i < 25 * 90 && !(label(g) === 'Mining' && g.collector.cargo >= 30 && g.collector.cargo < 70); i++) tick();
  const cash = p.resources.cash, aboard = g.collector.cargo;
  order('Dock', [g], { actor: forge });
  let delivered = 0;
  for (let i = 0; i < 25 * 60 && !delivered; i++) { tick(); if (p.resources.cash > cash) delivered = p.resources.cash - cash; }
  tick(25);
  check(aboard < 100 && delivered > 0 && p.resources.cash - cash === aboard, `Dock brings a part-full hold home at once (${aboard} ore delivered)`);
  tick(25 * 10);
  check(label(g) !== 'idle', 'and then it goes back to mining');
}

// 8. A new Gleaner goes straight to work
{
  const { tick, of, order, forge } = await setup(['forge']);
  order('StartProduction', [forge], null, 'gleaner');
  tick(forge.trait('ProductionQueue').duration('gleaner') + 25 * 8);
  const g = of('gleaner')[0];
  check(!!g && ['Heading out', 'Mining'].includes(label(g)), `a Gleaner built by the Forge launches and starts mining on its own (${g ? label(g) : 'none'})`);
}

// 9. Solid hulls and rocks
{
  const { w, tick, of, forge } = await setup(['forge', 'dart', 'dart'], [{ ...NEAR, count: 1, ore: [2000, 2000] }]);
  const [side, tip] = of('dart');
  const c = Math.cos((forge.yaw / 1024) * 2 * Math.PI), s = Math.sin((forge.yaw / 1024) * 2 * Math.PI);
  // one dart 45 m off the flank plating (190 m from the axis), one inside the prow
  side.x = forge.x - Math.trunc(s * 1900); side.y = forge.y + Math.trunc(c * 1900); side.z = forge.z;
  tip.x = forge.x + Math.trunc(c * 5600); tip.y = forge.y + Math.trunc(s * 5600); tip.z = forge.z;
  const sx = side.x, sy = side.y;
  tick(25);
  check(side.x === sx && side.y === sy, 'a ship can sit 190 m off the Forge\'s flank (the hull is a long capsule, not a big sphere)');
  // crowding lets hulls overlap by 10% of their combined radius, so "at the surface" means that
  const ra = forge.health.info.Radius, rb = tip.health.info.Radius, gap = Math.trunc(((ra + rb) * 90) / 100) - ra;
  check(w.edgeDist(tip, forge) >= gap - 2, `a ship inside the prow is pushed out to its surface (${w.edgeDist(tip, forge)} from the hull; crowding allows ${gap})`);
  const rock = w.actors.find((a) => a.asteroid);
  w.resolveOrder(makeOrder('Move', [side], { x: rock.x, y: rock.y, z: rock.z }), w.players[0]);
  for (let i = 0; i < 25 * 60 && side.activity; i++) tick();
  check(!side.activity && w.edgeDist(side, rock) >= Math.trunc(side.health.info.Radius * 0.8) - 2, `a ship sent into a rock stops at its surface (${w.edgeDist(side, rock)} from it) instead of flying through`);
}

// 10. Determinism with the whole economy running
async function scripted() {
  const { w, tick, of, order, forge } = await setup(['forge', 'smelter', 'gleaner', 'gleaner', 'gleaner'], [NEAR, { name: 'Far', at: [140, 60, -4], count: 6, spread: 4, ore: [900, 1600] }]);
  order('StartProduction', [forge], null, 'gleaner');
  order('Move', [of('smelter')[0]], { x: 132 * CELL, y: 64 * CELL, z: -4 * CELL });
  tick(25 * 60);
  order('Move', [of('gleaner')[1]], { x: 100 * CELL, y: 100 * CELL, z: 0 });
  tick(25 * 90);
  return w.syncHash();
}
{
  const a = await scripted(), b = await scripted();
  check(a === b, `deterministic (hash ${a.toString(16)} both runs)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll mining checks passed');
process.exitCode = failures ? 1 : 0;
