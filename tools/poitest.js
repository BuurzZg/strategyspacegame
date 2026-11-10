// Point-of-interest checks, no browser needed:  npm test
// Templates generate the same map every time and validate; maps build; every resource kind
// can be gathered; the visit report accounts for every unit of every store; recall, the
// hangar, spooling the Skein and ships left behind all work; the run carries on to the next place.
import { rules as loadRules, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, isqrt, distSq3 } from '../src/engine/math.js';
import { generatePoi, poiSeed } from '../src/engine/poi.js';
import { newRun, visitSettings, applyReport } from '../src/galaxy/run.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadRules();
const TYPES = Object.keys(rules.content.poiTypes);

async function visit(type, { fleet, seed = 5, place = 1, stores } = {}) {
  const run = newRun(rules, { seed });
  if (fleet) run.fleet = fleet.map((t) => ({ type: t, hp: rules.actor(t).traitInfo('Health').HP }));
  if (stores) Object.assign(run.stores, stores);
  const w = await makeWorld(visitSettings(rules, run, { type, place }));
  const me = w.players[0];
  const events = [];
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { w.tick(); events.push(...w.fxEvents); w.fxEvents.length = 0; } };
  const order = (name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), me);
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  const mine = () => w.actors.filter((a) => a.owner === me && !a.dead && a !== forge && a.mobile);
  return { w, me, run, tick, order, forge, mine, events };
}

// 1. Templates
{
  let same = true, differ = 0, clearEntry = true;
  for (const type of TYPES) {
    const a = generatePoi(rules, { seed: poiSeed(3, 9), type }), b = generatePoi(rules, { seed: poiSeed(3, 9), type });
    const c = generatePoi(rules, { seed: poiSeed(4, 9), type });
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    if (JSON.stringify(a.layout) !== JSON.stringify(c.layout) || JSON.stringify(a.fields) !== JSON.stringify(c.fields)) differ++;
    const [ex, ey] = a.spawns[0];
    for (const f of a.fields) if (isqrt((f.at[0] - ex) ** 2 + (f.at[1] - ey) ** 2) < 18 + f.spread) clearEntry = false;
  }
  check(TYPES.length === 12, `the core pack has twelve place types (${TYPES.join(', ')})`);
  check(same, 'every template gives exactly the same map for the same seed');
  check(differ === TYPES.length, 'and a different map for a different seed');
  check(clearEntry, 'no asteroid field is generated on top of the Forge\'s arrival point');
}

// 2. Every type builds, with what its layout promised, and the fleet launches from the hangar
for (const type of TYPES) {
  const { w, tick, mine, forge } = await visit(type);
  const s = w.settings, L = s.layout;
  const count = (t) => w.actors.filter((a) => a.type === t && !a.dead).length;
  tick(25 * 8);
  const stations = w.actors.filter((a) => a.station && !a.dead).length;
  const ok = count('wreck') === L.wrecks.length + (L.hulk ? 1 : 0) && count('cloud') === L.clouds.length && count('spire') === L.rocks.length
    && (count('asteroid') > 0 || !s.fields.length) && stations === (L.station ? 1 : 0) && mine().length === 7 && forge && !forge.trait('Hangar').queue.length;
  check(ok, `${type.padEnd(12)} "${s.poi.name}": ${count('asteroid')} rocks, ${count('wreck')} wrecks, ${count('cloud')} clouds, ${count('spire')} crystal pieces, ${L.encounters.length} encounters${L.station ? `, a ${L.station.of}` : ''}; the fleet of 7 launched from the hangar`);
}

// 3. Every resource kind can be gathered (a collector that can take two kinds picks the best
// deposit itself, so here one of them is sent to each kind)
{
  const tries = [['IceTail', ['gleaner', 'gleaner'], ['ice', 'ore']], ['ScrapShoal', ['shearer', 'shearer'], ['salvage']], ['LanternMist', ['skimmer', 'skimmer'], ['glim', 'spores']]];
  for (const [type, fleet, kinds] of tries) {
    const { w, tick, me, order, mine } = await visit(type, { fleet, place: 2 });
    tick(25 * 10);
    if (kinds.length > 1) mine().forEach((c, i) => {
      const k = kinds[i % kinds.length];
      const dep = w.actors.filter((a) => a.deposit && !a.dead && a.deposit.kind === k).sort((a, b) => distSq3(a.x, a.y, a.z, c.x, c.y, c.z) - distSq3(b.x, b.y, b.z, c.x, c.y, c.z))[0];
      if (dep) order('Harvest', [c], { actor: dep });
    });
    tick(25 * 240);
    const got = kinds.map((k) => `${k} +${me.resources.amount(k) - me.resources.start[k]}`);
    check(kinds.every((k) => me.resources.amount(k) > me.resources.start[k]), `${fleet[0]}s at the ${w.settings.poi.name} bring in ${got.join(', ')} in 4 minutes`);
  }
}

// 4. Recall: everyone comes home and goes aboard, hull and cargo kept
{
  const { w, me, tick, order, forge, mine } = await visit('OreReef');
  tick(25 * 40);
  const out = mine();
  const held = out.reduce((s, a) => s + (a.collector && a.collector.kind === 'ore' ? a.collector.cargo : 0), 0), ore0 = me.resources.amount('ore');
  const hp = out.find((a) => a.type === 'halberd').health;
  hp.damage(null, 20000, null);
  order('Recall', out);
  let f = 0;
  for (; f < 25 * 120 && mine().length; f++) tick();
  const aboard = forge.trait('Hangar').aboard;
  const hal = aboard.find((e) => e.type === 'halberd');
  check(!mine().length && aboard.length === out.length && hal && hal.hp === hp.maxHp - 20000, `Recall brings all ${out.length} ships home and aboard in ${(f / 25).toFixed(0)} s, keeping their hull damage`);
  check(held > 0 && me.resources.amount('ore') >= ore0 + held && aboard.every((e) => !e.cargo), `collectors unload their holds into the stores as they come aboard (${held} ore was in the holds)`);
  void w;
}

// 5. A full visit: gathering, building, a refund, losses; then spool, leave, and account for it all
{
  const { w, me, tick, order, forge, mine, events } = await visit('Wreck', { seed: 8 });
  const q = forge.trait('ProductionQueue');
  tick(25 * 30);
  order('StartProduction', [forge], null, 'dart');
  order('StartProduction', [forge], null, 'picket');
  order('CancelProduction', [forge], null, 1);
  tick(25 * 150);
  // send a Dart far away so it is outside when the drive fires; bring the rest home
  const straggler = mine().find((a) => a.type === 'dart');
  if (straggler) order('Move', [straggler], { x: w.bounds.x1 - 10 * CELL, y: w.bounds.y1 - 10 * CELL, z: 0 });
  order('Recall', mine().filter((a) => a !== straggler));
  tick(25 * 60);
  order('SpoolSkein', [forge]);
  tick(1499);
  check(!w.departed && forge.skein.spooling, 'the Skein spools for a full minute before the Forge can leave');
  tick(2);
  const r = w.report;
  check(!!w.departed && !!r && events.some((e) => e.t === 'departed'), `then the Forge stitches away and the visit ends (after ${r ? r.seconds : '?'} s)`);
  let balanced = true, lines = [];
  for (const [k, s] of Object.entries(r.stores)) {
    const sum = Object.values(s.changes).reduce((a, b) => a + b, 0);
    if (s.end !== s.start + sum) balanced = false;
    if (Object.keys(s.changes).length) lines.push(`${k} ${s.start}→${s.end} (${Object.entries(s.changes).map(([why, n]) => `${why} ${n > 0 ? '+' : ''}${n}`).join(', ')})`);
  }
  check(balanced, `the report accounts for every unit of every store: ${lines.join('; ')}`);
  const behind = Object.values(r.ships.leftBehind).reduce((a, b) => a + b, 0);
  check(straggler && r.ships.leftBehind.dart >= 1 && !r.ships.aboard.some((e) => e === straggler), `ships still outside are left behind and lost (${behind} left behind, ${r.ships.aboard.length} aboard)`);
  check((r.ships.built.dart || 0) === 1 && !r.ships.built.picket, 'the report lists what was built (and not what was cancelled)');
  // the run carries on: next place, same fleet (only what was aboard), same stores
  const run2 = applyReport(newRun(rules, { seed: 8 }), r);
  const v2 = await makeWorld(visitSettings(rules, run2, { type: 'OreReef' }));
  for (let i = 0; i < 25 * 10; i++) v2.tick();
  const me2 = v2.players[0];
  const fleet2 = v2.actors.filter((a) => a.owner === me2 && a.mobile && !a.has('Hangar')).length;
  check(fleet2 === r.ships.aboard.length && me2.resources.start.ore === r.stores.ore.end && me2.resources.start.salvage === r.stores.salvage.end, `the next place starts with exactly the fleet that was aboard (${fleet2} of ${r.ships.aboard.length}) and the stores that were left (ore ${me2.resources.start.ore}, salvage ${me2.resources.start.salvage}; cargo still in a hold comes along too)`);
  void q; void me;
}

// 6. Hunters come for the Forge after their delay
{
  const run = newRun(rules, { seed: 2 });
  const s = visitSettings(rules, run, { type: 'LanternMist' });
  s.layout.encounters = [{ side: 'fauna', ships: ['gnasher', 'gnasher', 'gnasher'], at: [150 * CELL, 150 * CELL, 0], behaviour: 'hunt', delay: 250 }];
  const w = await makeWorld(s);
  const pack = () => w.actors.filter((a) => a.type === 'gnasher');
  for (let i = 0; i < 240; i++) w.tick();
  const before = pack().every((a) => !a.activity);
  for (let i = 0; i < 30; i++) w.tick();
  check(before && pack().every((a) => a.activity), 'a hunting pack waits out its delay, then comes for the Forge');
}

// 7. The giant hulk is a solid capsule: ships fly round it
{
  const { w, tick, order, mine } = await visit('Wreck', { fleet: ['dart'] });
  tick(25 * 6);
  const hulk = w.actors.find((a) => a.wreck && a.wreck.of === 'forge');
  const d = mine()[0];
  d.x = hulk.x - 12 * CELL; d.y = hulk.y; d.z = hulk.z;
  order('Move', [d], { x: hulk.x + 12 * CELL, y: hulk.y + CELL, z: hulk.z });
  let scraped = 0;
  for (let i = 0; i < 25 * 60 && d.activity; i++) { tick(); if (d.mobile.scraped === w.frame - 1) scraped++; }
  check(hulk && !d.activity && scraped === 0 && isqrt(distSq3(d.x, d.y, d.z, hulk.x + 12 * CELL, hulk.y + CELL, hulk.z)) < 200, `a Dart crosses the hulk of a dead Forge without touching it (${hulk ? hulk.wreck.salvage : 0} salvage aboard the hulk)`);
}

// 8. Determinism: the same visit, twice
async function sameVisit() {
  const { w, tick, order, forge, mine } = await visit('Wreck', { seed: 13 });
  tick(25 * 60);
  order('StartProduction', [forge], null, 'talon');
  order('Recall', mine().slice(0, 3));
  tick(25 * 60);
  return w.syncHash();
}
{
  const a = await sameVisit(), b = await sameVisit();
  check(a === b, `deterministic (hash ${a.toString(16)} both runs)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll point-of-interest checks passed');
process.exitCode = failures ? 1 : 0;
