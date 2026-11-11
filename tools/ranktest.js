// Levels and the Forge's upgrades, no browser needed:  npm test
// Levels (not kills) add damage and hull; a level for each map a ship launched on, survived and
// came home from, once a map, riding home in the hangar and onto the next map; ships aboard mend between places; upgrades that need another
// are refused until it is built; the foundry line, launch rails and fire control do what they say.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();

async function map(prep) {
  const s = V.newVoyage(rules, { seed: 3 }), g = V.galaxyOf(rules, s);
  s.queue = [];
  s.at = g.points.find((p) => p.type === 'StillWater' && p.id !== g.start).id;
  if (prep) prep(s);
  const settings = V.visitSettings(rules, s);
  settings.fog = false;
  const w = await makeWorld(settings), me = w.players[0];
  const fauna = w.players.find((p) => p.faction === 'fauna');
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  return { s, w, me, fauna, forge, tick: (n) => { for (let i = 0; i < n; i++) w.tick(); }, order: (n, sub, t, x) => w.resolveOrder(makeOrder(n, sub, t, x), me) };
}

// 1. Levels: kills don't count; each level adds 5% hull and damage
{
  const m = await map();
  m.tick(25 * 6);
  // levels alone here: no named leads' touch (crewtest covers those)
  for (const a of m.w.actors) if (a.owner === m.me && a.lead) { a.leadDamage = a.leadHull = a.leadLearn = 0; m.w.ranks.fit(a); }
  m.me.slot.xpPct = 100;
  const hal = m.w.actors.find((a) => a.owner === m.me && a.type === 'halberd');
  const hp0 = hal.health.maxHp;
  for (let i = 0; i < 6; i++) { const g = m.w.createActor('picket', m.fauna, { x: hal.x + 2500, y: hal.y, z: hal.z }); g.health.kill(hal, m.me); }
  check((hal.xp | 0) === 0 && (hal.rank | 0) === 0 && hal.kills === 6, `a Halberd that kills 6 Pickets is still level 1 (kills no longer count; ${hal.kills} kills on its record)`);
  m.w.ranks.set(hal, 200);
  check(hal.rank === 2 && hal.health.maxHp === Math.trunc((hp0 * 110) / 100), `at level 3 it has 10% more hull (${hp0} → ${hal.health.maxHp})`);
  // and 10% more damage: the same bolt hits harder
  const t1 = m.w.createActor('halberd', m.fauna, { x: hal.x + 20 * CELL, y: hal.y, z: hal.z }), t2 = m.w.createActor('halberd', m.fauna, { x: hal.x - 20 * CELL, y: hal.y, z: hal.z });
  const green = m.w.actors.find((a) => a.owner === m.me && a.type === 'dart');
  const wh = m.w.rules.weapons.get('PulseBattery').warheads[0];
  const hit = (firer, target) => { const h = target.health.hp; wh.W.apply({ world: m.w, owner: m.me, firer }, wh, target.x, target.y, target.z, target); return h - target.health.hp; };
  let d1 = 0, d2 = 0;
  try { d1 = hit(hal, t1); d2 = hit(green, t2); } catch (e) { d1 = d2 = -1; console.log(e.message); }
  check(d1 > 0 && d1 === Math.trunc((d2 * 110) / 100), `a level 3 Halberd's pulse battery does ${d1} where a level 1 ship's does ${d2}`);
  m.w.ranks.set(hal, 9999);
  check(hal.rank === 4 && m.w.ranks.nameOf(hal.rank) === 'Level 5', 'and no higher than level 5');
}

// 2. A level for each map a ship launched on, survived and came home from; it rides on
{
  const m = await map();
  m.tick(25 * 6);
  const out = m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge);
  const dart = out.find((a) => a.type === 'dart');
  const xp0 = dart.xp | 0;
  m.order('Recall', out);
  m.tick(25 * 90);
  // launched again and recalled again on the same map: still one level
  m.order('LaunchAll', [m.forge]);
  m.tick(25 * 20);
  m.order('Recall', m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge));
  m.tick(25 * 90);
  m.order('SpoolSkein', [m.forge]);
  for (let i = 0; i < m.forge.skein.time + 2 && !m.w.report; i++) m.w.tick();
  V.returnFromMap(rules, m.s, m.w.report);
  const darts = m.s.fleet.filter((x) => x.type === 'dart');
  check(darts.length === 2 && darts.every((e) => e.xp >= xp0 + 100 && e.xp < xp0 + 200) && V.levelOf(rules, darts[0]) === 2, `a Dart that launched and came home is level ${V.levelOf(rules, darts[0])} (${darts[0].xp} points), once, however often it docked`);
  const n = await map((s) => { s.fleet = m.s.fleet; });
  n.tick(25 * 8);
  const best = n.w.actors.filter((a) => a.owner === n.me && a.type === 'dart').sort((a, b) => (b.xp | 0) - (a.xp | 0))[0];
  check(best && best.xp === darts[0].xp && best.rank === 1, 'and launches on the next map at that level');
}

// 3. Mending aboard, and repair bays
{
  const s = V.newVoyage(rules, { seed: 5 });
  s.queue = [];
  const e = s.fleet.find((x) => x.type === 'halberd'), max = V.shipMaxHp(rules, e, s);
  e.hp = Math.trunc(max / 2);
  V.dayTick(rules, s);
  const one = e.hp - Math.trunc(max / 2);
  s.items['repair-bays'] = 'installed';
  const before = e.hp;
  V.dayTick(rules, s);
  check(one === Math.trunc((max * 5) / 100) && e.hp - before === Math.trunc((max * 20) / 100), `a damaged Halberd aboard mends 5% a day, 20% with repair bays`);
}

// 4. Upgrades: prerequisites, the foundry line, launch rails, fire control
{
  const s = V.newVoyage(rules, { seed: 6 });
  s.queue = []; s.stores.ore = 20000; s.stores.salvage = 20000;
  const no = V.installPlan(rules, s, 'second-hangar');
  V.install(rules, s, 'hangar');
  const yes = V.installPlan(rules, s, 'second-hangar');
  check(!no.ok && /Expanded hangar/.test(no.why) && yes.ok, `the second hangar needs the first ("${no.why}")`);
  for (const id of ['second-hangar', 'foundry-line', 'launch-rails', 'fire-control']) V.install(rules, s, id);
  const plain = await map(), up = await map((v) => { v.items = { ...s.items }; });
  check(up.me.capacity.cap() === 50, `two hangars: fleet capacity ${up.me.capacity.cap()}`);
  // launch rails: the fleet is out sooner
  plain.tick(40); up.tick(40);
  const out = (m) => m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge).length;
  check(out(up) > out(plain), `launch rails: ${out(up)} ships out after 40 ticks instead of ${out(plain)}`);
  // the foundry line builds faster
  const qa = plain.forge.trait('ProductionQueue'), qb = up.forge.trait('ProductionQueue');
  plain.order('StartProduction', [plain.forge], null, 'dart'); up.order('StartProduction', [up.forge], null, 'dart');
  let ta = 0, tb = 0;
  for (let i = 1; i < 400 && (!ta || !tb); i++) { plain.w.tick(); up.w.tick(); if (!ta && !qa.queue.length) ta = i; if (!tb && !qb.queue.length) tb = i; }
  check(tb > 0 && tb < ta, `the foundry line: a Dart in ${tb} ticks instead of ${ta}`);
  check(up.me.slot.forgeDamagePct === 140, `fire control: the Forge's own guns at 140%`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll rank checks passed');
process.exitCode = failures ? 1 : 0;
