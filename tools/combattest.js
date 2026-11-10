// Combat checks, no browser needed:  npm test
// Damage maths, every projectile type, arcs, kills and wrecks, targeting, leashes, orders,
// point defence, a 40-a-side battle's speed, and determinism.
import { makeWorld } from './headless.js';
import { makeOrder, makeWorldOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const C = (x, y, z = 0) => ({ x: x * CELL, y: y * CELL, z: z * CELL });

async function arena() {
  const w = await makeWorld({
    players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'Them', faction: 'gaunt', team: 1, ships: [] }],
    sandbox: true, startingShips: [],
  });
  const [us, them] = w.players;
  const events = [];
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { w.tick(); events.push(...w.fxEvents); w.fxEvents.length = 0; } };
  const make = (type, owner, at, yaw = 0) => w.createActor(type, owner, { ...at, yaw });
  const order = (name, subjects, target) => w.resolveOrder(makeOrder(name, subjects, target), subjects[0].owner);
  return { w, us, them, tick, make, order, events };
}
const hold = (a) => { a.trait('AutoTarget') && (a.trait('AutoTarget').timer = 1e9); }; // keep a target dummy still

// 1. Damage maths: a lance (instant) on a Halberd (heavy, 110%) and on a Dart (light, 2%)
{
  const { tick, make, us, them } = await arena();
  const sp = make('spindle', us, C(90, 96), 0);
  const hb = make('halberd', them, C(94, 96), 512); hold(hb);
  for (let i = 0; i < 300 && hb.health.hp === hb.health.maxHp; i++) tick();
  check(hb.health.maxHp - hb.health.hp === 24200, `a lance hit takes exactly 22000 × 110% = 24200 off a Halberd (took ${hb.health.maxHp - hb.health.hp})`);
  const { tick: t2, make: m2, us: u2, them: th2 } = await arena();
  m2('spindle', u2, C(90, 96), 0);
  const dt = m2('dart', th2, C(93, 96), 512); hold(dt); dt.mobile.info = { ...dt.mobile.info, MaxSpeed: 0 };
  for (let i = 0; i < 300 && dt.health.hp === dt.health.maxHp; i++) t2();
  check(dt.health.maxHp - dt.health.hp === 440, `the same lance only does 2% (440) to a Dart (took ${dt.health.maxHp - dt.health.hp})`);
  void sp;
}

// 2. Unguided shots hit a target that holds its course, and miss one that turns away
{
  const { w, tick, make, us, them, events } = await arena();
  make('halberd', us, C(90, 96), 0);
  const still = make('picket', them, C(92, 96), 512); hold(still);
  tick(25 * 3);
  const hits = events.filter((e) => e.t === 'impact' && e.hit).length;
  check(hits > 0 && still.health.hp < still.health.maxHp, `pulse shots hit a corvette that sits still (${hits} hits in 3 s)`);
  // a dart crossing the battery's line of fire at full speed, not fighting back
  const { tick: t2, make: m2, us: u2, them: th2, w: w2 } = await arena();
  m2('halberd', u2, C(90, 96), 0);
  const cross = m2('dart', th2, C(93, 84), 256); hold(cross);
  cross.trait('AutoTarget').damaged = () => {};
  w2.resolveOrder(makeOrder('Move', [cross], C(93, 160)), th2);
  t2(25 * 6);
  const dmg = cross.dead ? cross.health.maxHp : cross.health.maxHp - cross.health.hp;
  check(!cross.dead && dmg < cross.health.maxHp / 2, `the same battery mostly misses a fighter crossing at full speed (took ${dmg} of ${cross.health.maxHp} in 6 s)`);
  void w;
}

// 3. Flak bursts hurt every enemy fighter nearby
{
  const { tick, make, us, them } = await arena();
  make('picket', us, C(90, 96), 0);
  const pack = [0, 1, 2].map((i) => { const d = make('dart', them, C(92.4, 95.6 + i * 0.4), 512); hold(d); d.mobile.info = { ...d.mobile.info, MaxSpeed: 0 }; return d; });
  tick(25 * 2);
  const hurt = pack.filter((d) => d.dead || d.health.hp < d.health.maxHp).length;
  check(hurt >= 2, `flak bursts damage several fighters at once (${hurt} of 3 hit in 2 s)`);
}

// 4. Torpedoes home in on a moving target
{
  const { tick, make, us, them, events } = await arena();
  make('sabre', us, C(80, 96), 0);
  const tgt = make('halberd', them, C(85, 96), 256); hold(tgt);
  tgt.queueActivity(new (await import('../src/activities/fly.js')).FlyTo(85 * CELL, 120 * CELL, 4 * CELL));
  tick(25 * 12);
  const torps = events.filter((e) => e.t === 'impact' && e.missile);
  check(torps.length > 0 && torps.filter((e) => e.hit).length * 2 >= torps.length, `torpedoes chase a frigate across the sky and hit (${torps.filter((e) => e.hit).length} of ${torps.length})`);
}

// 5. Fixed guns only fire forward; turrets fire all round
{
  const { tick, make, us, them, events } = await arena();
  const d = make('dart', us, C(90, 96), 0); hold(d); d.mobile.info = { ...d.mobile.info, MaxSpeed: 0, TurnSpeed: 0 };
  const behind = make('picket', them, C(88.5, 96), 0); hold(behind); behind.trait('Attacks').info = { ...behind.trait('Attacks').info, HoldFire: true };
  tick(25 * 2);
  check(!events.some((e) => e.t === 'fire' && e.actor === d.id), 'a Dart cannot shoot a target behind it with its fixed guns');
  const { tick: t2, make: m2, us: u2, them: th2, events: ev2 } = await arena();
  const p = m2('picket', u2, C(90, 96), 0); hold(p);
  const back = m2('dart', th2, C(88.5, 96), 0); hold(back);
  t2(25);
  check(ev2.some((e) => e.t === 'fire' && e.actor === p.id), 'a Picket\'s turret fires at a target behind it');
}

// 6. Kills: actors are removed; big hulls leave a wreck worth salvage, fighters don't
{
  const { w, tick, make, us, them } = await arena();
  const hb = make('halberd', them, C(96, 96)); hold(hb);
  const dt = make('dart', them, C(96, 100)); hold(dt);
  hb.health.damage(null, 1e9, us); dt.health.damage(null, 1e9, us);
  tick();
  const wrecks = w.actors.filter((a) => a.wreck);
  check(!w.actorById.get(hb.id) && !w.actorById.get(dt.id), 'destroyed ships are removed from space');
  check(wrecks.length === 1 && wrecks[0].wreck.of === 'halberd' && wrecks[0].wreck.salvage === 180, `a Halberd leaves one wreck worth 40% of its cost (${wrecks[0]?.wreck.salvage} salvage); a Dart leaves none`);
  // wrecks are solid: a ship sent through one goes round it
  const g = make('gleaner', us, C(90, 96));
  const wr = wrecks[0];
  w.resolveOrder(makeOrder('Move', [g], { x: wr.x + 6 * CELL, y: wr.y, z: wr.z }), us);
  let scraped = 0;
  for (let i = 0; i < 25 * 30 && g.activity; i++) { tick(); if (g.mobile.scraped === w.frame - 1) scraped++; }
  check(!g.activity && scraped === 0, 'wrecks are solid: ships steer round them');
}

// 7. Targeting: idle warships engage enemies in range, but not neutral rocks; the unarmed don't
{
  const { tick, make, us, them } = await arena();
  const h = make('halberd', us, C(90, 96));
  const g = make('gleaner', us, C(90, 100));
  const e = make('picket', them, C(95, 96), 512); hold(e); e.trait('Attacks').info = { ...e.trait('Attacks').info, HoldFire: true };
  tick(25);
  check(h.activity && h.activity.label === 'Attacking', 'an idle Halberd engages an enemy that comes within range');
  check(!g.activity || g.activity.label !== 'Attacking', 'an unarmed Gleaner does not');
}

// 8. Leash: a chase that drags a ship too far is given up, and it flies home
{
  const { w, tick, make, us, them } = await arena();
  const d = make('dart', us, C(60, 96));
  const bait = make('dart', them, C(64, 96), 0); bait.trait('Attacks').info = { ...bait.trait('Attacks').info, HoldFire: true };
  hold(bait);
  tick(16);
  w.resolveOrder(makeOrder('Move', [bait], C(180, 96)), them); // runs for the far side
  let gaveUp = false;
  for (let i = 0; i < 25 * 60 && !gaveUp; i++) { tick(); gaveUp = !!d.activity && d.activity.label === 'Moving'; }
  check(gaveUp && Math.abs(d.x - 60 * CELL) < 14 * CELL, 'a Dart chasing a runner gives up past its leash and heads home');
}

// 9. Orders: Attack a chosen target; Stop; AttackMove fights on the way
{
  const { w, tick, make, us, them, order } = await arena();
  const h = make('halberd', us, C(80, 96));
  const a1 = make('picket', them, C(84, 92), 512), a2 = make('halberd', them, C(84, 100), 512);
  hold(a1); hold(a2); a1.trait('Attacks').info = { ...a1.trait('Attacks').info, HoldFire: true }; a2.trait('Attacks').info = { ...a2.trait('Attacks').info, HoldFire: true };
  order('Attack', [h], { actor: a2 });
  tick(25 * 4);
  check(h.attack.focus === a2 && a2.health.hp < a2.health.maxHp, 'an Attack order focuses fire on the chosen target');
  order('Stop', [h]);
  tick();
  check(!h.activity, 'Stop ends the attack');
  const { tick: t2, make: m2, us: u2, them: th2, order: o2 } = await arena();
  const d = m2('dart', u2, C(70, 96));
  const lurker = m2('talon', th2, C(85, 97), 512); hold(lurker);
  o2('AttackMove', [d], C(110, 96));
  let fought = false;
  for (let i = 0; i < 25 * 90 && d.activity; i++) { t2(); if (d.activity && d.activity.label === 'Attacking') fought = true; }
  check(fought && lurker.dead, 'an advance (AttackMove) stops to destroy an enemy met on the way, then carries on');
  void w;
}

// 10. The Forge's point defence shoots fighters near it without the Forge moving
{
  const { tick, make, us, them } = await arena();
  const f = make('forge', us, C(96, 96));
  const fx = f.x, fy = f.y;
  const d = make('dart', them, C(102, 97), 512); hold(d); d.trait('Attacks').info = { ...d.trait('Attacks').info, HoldFire: true }; d.mobile.info = { ...d.mobile.info, MaxSpeed: 0 };
  tick(25 * 3);
  check(d.health.hp < d.health.maxHp && f.x === fx && f.y === fy, `point defence hits a fighter near the Forge (${d.health.maxHp - d.health.hp} damage) and the Forge stays put`);
}

// 11. A 40-a-side battle: speed and determinism
async function bigBattle() {
  const { w, tick } = await arena();
  const mix = (n) => Array.from({ length: n }, (_, i) => ['dart', 'dart', 'talon', 'picket', 'dart', 'halberd', 'talon', 'picket'][i % 8]);
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: mix(40), at: [70 * CELL, 96 * CELL, 0], attack: [122 * CELL, 96 * CELL, 0] }), null);
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: mix(40), at: [122 * CELL, 96 * CELL, 0], attack: [70 * CELL, 96 * CELL, 0] }), null);
  const t0 = process.hrtime.bigint();
  tick(25 * 40);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / (25 * 40);
  return { hash: w.syncHash(), ms, left: w.actors.filter((a) => a.health && !a.dead).length };
}
{
  const a = await bigBattle(), b = await bigBattle();
  check(a.hash === b.hash && a.left === b.left, `a 40-a-side battle is deterministic (hash ${a.hash.toString(16)}, ${a.left} ships left after 40 s)`);
  check(a.ms < 12, `and fast enough: ${a.ms.toFixed(2)} ms per tick (budget 12 ms; a tick is 40 ms)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll combat checks passed');
process.exitCode = failures ? 1 : 0;
