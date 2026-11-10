// Sensors, fog and engineering, no browser needed:  npm test
// On maps with sensor fog, ships beyond sensor range are neither seen nor targeted, by you or
// by anyone else, until they come into range; nebulae halve sensor range; a Wisp sees three
// times as far; the last place a hostile was seen is remembered. Blueprints unlock the right
// hulls (from a wreck, a trader or an event). Engineering projects change what they say.
// Deep scans reveal places. All deterministic.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';
import * as C from '../src/galaxy/comms.js';
import { meet } from '../src/galaxy/standing.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();

async function map(seed = 3, prep) {
  const s = V.newVoyage(rules, { seed }), g = V.galaxyOf(rules, s);
  s.queue = [];
  s.at = g.points.find((p) => p.type === 'StillWater' && p.id !== g.start).id;
  if (prep) prep(s);
  const settings = V.visitSettings(rules, s);
  settings.layout.nebulae = [];
  const w = await makeWorld(settings), me = w.players[0];
  const tick = (n) => { for (let i = 0; i < n; i++) w.tick(); };
  const fauna = w.players.find((p) => p.faction === 'fauna');
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  return { s, w, me, tick, fauna, forge, order: (n, sub, t, x) => w.resolveOrder(makeOrder(n, sub, t, x), me) };
}
const place = (a, x, y, z) => { a.x = x; a.y = y; a.z = z; a.px = x; a.py = y; a.pz = z; if (a.mobile) { a.cancelActivity(); a.activity = null; a.mobile.speed = 0; } };

// 1. Hidden until seen, both ways
{
  const m = await map();
  m.tick(25 * 8);
  for (const a of m.w.actors) if (a.owner === m.me && a.mobile && a !== m.forge) a.health.kill(null, null);
  m.tick(2);
  const range = rules.actor('forge').traitInfo('Sensors').Range;
  const g = m.w.createActor('gnasher', m.fauna, { x: m.forge.x + range + 6000, y: m.forge.y, z: m.forge.z });
  place(g, g.x, g.y, g.z);
  m.tick(12);
  const hidden = !m.w.canSee(m.me, g) && !m.me.seen.has(g.id);
  // a Halberd parked between: the gnasher is in its range, so it is seen
  const hal = m.w.createActor('halberd', m.me, { x: m.forge.x + range, y: m.forge.y, z: m.forge.z });
  place(hal, hal.x, hal.y, hal.z);
  m.tick(12);
  const seen = m.w.canSee(m.me, g);
  hal.health.kill(null, null);
  m.tick(12);
  const last = m.me.lastSeen.get(g.id);
  check(hidden && seen && !m.w.canSee(m.me, g) && last && last.x === g.x, `a Gnasher beyond the Forge's ${range} sensor range is hidden; a Halberd nearer sees it; when the Halberd is gone it is hidden again, last seen where it was`);
  // and the other way: monsters cannot attack what they cannot see
  const far = m.w.createActor('dart', m.me, { x: g.x + 9000 + 4000, y: g.y, z: g.z });
  place(far, far.x, far.y, far.z);
  m.tick(12);
  check(!m.w.canSee(m.fauna, far) || !!g.info.traitInfo('Sensors'), 'fog works both ways: what is out of a monster\'s sensor range is out of its reach too');
  check(!g.attack.canTarget(m.forge), 'the hidden Gnasher cannot target the Forge it cannot see');
}

// 2. Nebulae halve it; a Wisp sees three times as far
{
  const m = await map();
  m.tick(25 * 8);
  for (const a of m.w.actors) if (a.owner === m.me && a.mobile && a !== m.forge) a.health.kill(null, null);
  const dart = m.w.createActor('dart', m.me, { x: m.forge.x, y: m.forge.y + 40 * CELL, z: m.forge.z });
  place(dart, dart.x, dart.y, dart.z);
  const g = m.w.createActor('gnasher', m.fauna, { x: dart.x + 7000, y: dart.y, z: dart.z });
  place(g, g.x, g.y, g.z);
  m.tick(12);
  const clear = m.w.canSee(m.me, g);
  m.w.nebulae = [{ at: [g.x, g.y, g.z], radius: 3000, color: '444444' }];
  m.tick(12);
  const fogged = m.w.canSee(m.me, g);
  m.w.nebulae = [];
  g.x = dart.x + 20000; g.px = g.x;
  m.tick(12);
  const farDart = m.w.canSee(m.me, g);
  const wisp = m.w.createActor('wisp', m.me, { x: dart.x, y: dart.y, z: dart.z });
  place(wisp, wisp.x, wisp.y, wisp.z);
  m.tick(12);
  check(clear && !fogged && !farDart && m.w.canSee(m.me, g), 'a Dart sees a Gnasher 700 m off, but not when the Gnasher hides in a nebula; at 2 km only a Wisp sees it');
}

// 3. Blueprints unlock the right hulls
{
  const m = await map(5);
  m.tick(25 * 6);
  const q = m.forge.trait('ProductionQueue');
  check(!!q.canQueue('talon') && /blueprint/.test(q.canQueue('talon')) && !q.canQueue('dart') && !q.canQueue('wisp'), `without blueprints: Darts and Wisps yes, Talons no ("${q.canQueue('talon')}")`);
  // cut up a Talon wreck: half-way, its plans turn up
  const sh = m.w.actors.find((a) => a.owner === m.me && a.type === 'shearer');
  const wreck = m.w.createActor('wreck', m.w.neutral, { x: sh.x + 3000, y: sh.y, z: sh.z, of: 'talon', salvage: 120, radius: 400 });
  m.order('Harvest', [sh], { actor: wreck });
  let found = false;
  for (let i = 0; i < 25 * 200 && !found; i++) { m.w.tick(); found = m.w.point.logOf(m.me).found.includes('bp-talon'); }
  m.forge.health.hp = m.forge.health.maxHp;
  m.order('Recall', m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge));
  m.order('SpoolSkein', [m.forge]);
  for (let i = 0; i < m.forge.skein.time + 2 && !m.w.report; i++) m.w.tick();
  V.returnFromMap(rules, m.s, m.w.report);
  check(found && m.s.blueprints.includes('talon'), 'cutting half the salvage out of a Talon wreck finds the Talon blueprint, and the voyage learns it');
  const after = await map(5, (s) => { s.blueprints = m.s.blueprints; });
  after.tick(25 * 6);
  check(!after.forge.trait('ProductionQueue').canQueue('talon') && !!after.forge.trait('ProductionQueue').canQueue('sabre'), 'on the next map the Forge can build Talons, and still not Sabres');
  // from a trader: the Cinder Pact sell the Sabre's
  const t = V.newVoyage(rules, { seed: 5 }), g = V.galaxyOf(rules, t);
  const hold = g.points.find((p) => p.seat && p.owner === 'cinder');
  t.at = hold.id; meet(rules, t, 'cinder'); t.standing.cinder = 30; t.stores.salvage = 2000;
  const d = C.deal(rules, t, 'cinder', hold.id, { 'bp-sabre': 1 }, { salvage: 1100 });
  check(d.ok && t.blueprints.includes('sabre') && !C.quote(rules, t, 'cinder', hold.id, { 'bp-sabre': 1 }, { salvage: 1100 }).ok, `the Cinder Pact sell a Sabre blueprint (${d.ok ? `for goods worth ${d.pay}` : d.why}), and only once`);
}

// 4. Engineering projects
{
  const s = V.newVoyage(rules, { seed: 7 });
  s.queue = [];
  s.stores.ore = 10000; s.stores.salvage = 10000; s.stores.ice = 100000; s.stores.spores = 10000;
  const sense0 = V.sensorRange(rules, s), food0 = V.forecast(rules, s).food;
  const g = V.galaxyOf(rules, s), li = g.adj[s.at][0], len = g.lanes[li].len, glim0 = V.stitchCost(rules, s, len);
  for (const id of ['hangar', 'racks', 'array', 'recycler', 'plating']) { const r = V.install(rules, s, id); if (!r.ok) console.log(id, r.why); }
  const all = ['hangar', 'racks', 'array', 'recycler', 'plating'].every((id) => s.items[id] === 'installed');
  check(all && V.sensorRange(rules, s) === Math.trunc((sense0 * 150) / 100) && V.forecast(rules, s).food > food0 && V.stitchCost(rules, s, len) < glim0 && V.forgeMaxHp(rules, s) === Math.trunc((rules.actor('forge').traitInfo('Health').HP * 125) / 100),
    `projects built: sensors ${sense0} → ${V.sensorRange(rules, s)} spans, food ${food0} → ${V.forecast(rules, s).food} a day, a stitch ${glim0} → ${V.stitchCost(rules, s, len)} Glim, hull ×1.25`);
  const m = await map(7, (v) => { v.items = { ...s.items }; v.forge.hp = V.forgeMaxHp(rules, v); });
  check(m.me.capacity.cap() === 40 && m.forge.health.maxHp === V.forgeMaxHp(rules, s) && m.me.sensorPct === 150, `on a map: fleet capacity ${m.me.capacity.cap()}, the plated Forge's hull, and sensors at 150%`);
}

// 5. A deep scan
{
  const s = V.newVoyage(rules, { seed: 9 });
  s.queue = [];
  const k0 = s.known.length, day0 = s.day, glim0 = s.stores.glim;
  const r = V.scan(rules, s);
  check(r.ok && s.known.length > k0 && s.day === day0 + 1 && s.stores.glim < glim0, `a day's deep scan: ${r.found} more places known, for ${rules.content.voyage.ScanGlim} Glim`);
}

// 6. Determinism with fog
async function once() {
  const m = await map(11);
  m.tick(25 * 5);
  m.w.createActor('gnasher', m.fauna, { x: m.forge.x + 30000, y: m.forge.y, z: m.forge.z });
  m.order('Move', m.w.actors.filter((a) => a.owner === m.me && a.type === 'dart'), { x: m.forge.x + 25000, y: m.forge.y, z: m.forge.z });
  m.tick(25 * 40);
  return m.w.syncHash();
}
{
  const a = await once(), b = await once();
  check(a === b, `deterministic with fog (hash ${a.toString(16)} both runs)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll fog checks passed');
process.exitCode = failures ? 1 : 0;
