// The voyage simulator, no browser needed:  npm test
// The galaxy: deterministic, about 300 places in four regions, every place reachable, each
// region opened by its drive component and not before, each component where the drive that
// can fetch it reaches. The day clock: consumption maths exactly, the starvation ladder, game
// over. Travel: Glim and days, range, the Veil, drifting. Maps: crew, losses, days, system
// wear, relics, the Forge destroyed. Saving: save and load give the identical voyage. And an
// abstract captain who plays the galaxy layer to the end, to show it can be won.
import { rules as loadRules, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { generateGalaxy, tiers, reach, route, stitchGlim, stitchDays } from '../src/galaxy/galaxy.js';
import * as V from '../src/galaxy/voyage.js';
import { count, free } from '../src/galaxy/crew.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadRules();
const C = rules.content, VY = C.voyage;
const clone = (s) => JSON.parse(JSON.stringify(s));

// 1. The galaxy
{
  const a = generateGalaxy(rules, 11), b = generateGalaxy(rules, 11), c = generateGalaxy(rules, 12);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.points) !== JSON.stringify(c.points), 'the same seed gives the same galaxy, and another seed a different one');
  const T = tiers(rules);
  let sizes = [], allReach = true, gated = true, comps = true, edges = true, regions4 = true;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = generateGalaxy(rules, seed), n = g.points.length;
    sizes.push(n);
    if (new Set(g.points.map((p) => p.region)).size !== 4) regions4 = false;
    const R = T.map((d) => reach(n, g.lanes, g.start, d));
    if (!R[3].every(Boolean)) allReach = false;
    // tier t reaches every place of regions 0..t and none beyond
    for (let t = 0; t < 4; t++) for (const p of g.points) if (R[t][p.id] !== (p.ri <= t)) gated = false;
    // each component is reachable with the drive as it is before that component is fitted
    const order = ['coils', 'lens', 'spindle', 'heartstone'];
    order.forEach((id, t) => { const at = g.components[id]; if (at === undefined || !R[t][at] || g.points[at].region !== C.items[id].Region) comps = false; });
    if (!g.points.some((p) => p.edge && R[3][p.id])) edges = false;
  }
  check(sizes.every((n) => n >= 260 && n <= 340), `about 300 places in each galaxy (${sizes.join(', ')})`);
  check(regions4, 'four regions: the Drift, the Middens, the Hush and the Shore');
  check(allReach, 'every place can be reached with the drive fully mended');
  check(gated, 'each region opens at its own drive level, all of it, and not before (Coils, then the Lens through the Veil, then the Spindle)');
  check(comps, 'each drive component lies in its region, where the drive that can fetch it reaches');
  check(edges, 'the Shore\'s edge, where the final jump goes from, can be reached');
}

// 2. One day, exactly
{
  const s = V.newVoyage(rules, { seed: 3 });
  const st = { ...s.stores }, n = V.needs(rules, s);
  V.dayTick(rules, s);
  const airMade = Math.min(+VY.AirPerDay, +VY.AirTank - st.air + n.air), airWater = Math.ceil((airMade * +VY.WaterPerAir) / 100);
  const foodMade = +VY.FoodPerDay + +VY.SporeFood, foodWater = Math.ceil((+VY.FoodPerDay * +VY.WaterPerFood) / 100);
  const want = { ice: st.ice - n.water - airWater - foodWater, food: st.food + foodMade - n.food, air: st.air + airMade - n.air, glim: st.glim - +VY.ReactorGlim, spores: st.spores - +VY.SporesPerDay };
  const got = Object.fromEntries(Object.keys(want).map((k) => [k, s.stores[k]]));
  check(JSON.stringify(want) === JSON.stringify(got) && s.day === 2, `a day for 150 crew: water ${n.water}, food ${n.food}, air ${n.air}; life support makes ${airMade} air from ${airWater} water, hydroponics ${foodMade} food (${JSON.stringify(got)})`);
}

// 3. The starvation ladder
{
  // no food and no way to grow it: people die slowly, but the voyage goes on
  const s = V.newVoyage(rules, { seed: 3 });
  s.stores.food = 0; s.stores.spores = 0; s.systems.hydro = 0;
  const crew0 = count(s.crew), m0 = s.morale;
  V.passDays(rules, s, 5);
  const lost = crew0 - count(s.crew);
  let want = 0;
  for (let d = 0, n = crew0; d < 5; d++) { const k = Math.max(1, Math.trunc((n * +VY.StarvePct) / 100)); want += k; n -= k; }
  check(!s.over && lost === want && s.morale < m0, `no food: ${lost} of ${crew0} die over five days (2% a day), morale ${m0} → ${s.morale}, the voyage goes on`);
  // no water: no air is made; the tank empties, then people suffocate, and three airless days end it
  const t = V.newVoyage(rules, { seed: 3 });
  t.stores.ice = 0;
  let firstAirless = 0;
  for (let d = 0; d < 40 && !t.over; d++) { V.dayTick(rules, t); if (!firstAirless && t.airless) firstAirless = t.day - 1; }
  check(t.over && t.over.reason === 'air' && t.over.day === firstAirless + 2 && t.log.some((l) => /suffocated/.test(l.text)), `no water: the air lasts until day ${firstAirless}, people suffocate, and the run ends on day ${t.over && t.over.day} (three days without air)`);
  // low stores pull morale down before anything runs out
  const u = V.newVoyage(rules, { seed: 3 });
  u.stores.ice = 400; // under three days
  const m1 = u.morale;
  V.dayTick(rules, u);
  check(u.morale < m1 && !u.over, `a store running low pulls morale down (${m1} → ${u.morale}) before it runs out`);
  // nobody left
  const w = V.newVoyage(rules, { seed: 3 });
  w.crew.roles = { engineers: 0, pilots: 0, miners: 0, hands: 1 }; w.crew.assigned = { engineers: 0, pilots: 0, miners: 0, hands: 0 };
  w.stores.food = 0; w.stores.spores = 0; w.systems.hydro = 0;
  V.dayTick(rules, w);
  check(w.over && w.over.reason === 'crew', 'when the last of the crew is gone, the run ends');
}

// 4. Travel
{
  const s = V.newVoyage(rules, { seed: 5 });
  const g = V.galaxyOf(rules, s), d = V.drive(rules, s);
  const li = g.adj[s.at].find((i) => g.lanes[i].len <= d.range && !g.lanes[i].veil);
  const l = g.lanes[li], to = l.a === s.at ? l.b : l.a;
  const glim0 = s.stores.glim, day0 = s.day;
  const r = V.stitch(rules, s, to);
  const days = stitchDays(VY, l.len);
  check(r.ok && s.at === to && s.day === day0 + days && s.stores.glim === glim0 - stitchGlim(VY, l.len) - days * +VY.ReactorGlim, `one stitch of ${l.len} spans: ${stitchGlim(VY, l.len)} Glim and ${days} day${days > 1 ? 's' : ''}`);
  const mid = g.points.find((p) => p.region === 'Middens');
  const p1 = V.plan(rules, s, mid.id);
  check(!p1.ok && /reach/.test(p1.why), `the Middens are out of reach without the Coils ("${p1.why}")`);
  s.items.coils = 'installed';
  const p2 = V.plan(rules, s, mid.id);
  check(p2.ok || /Glim/.test(p2.why), `with the Coils fitted, there is a route (${p2.route ? `${p2.route.hops.length} stitches, ${p2.route.glim} Glim, ${p2.route.days} days` : p2.why})`);
  const hush = g.points.find((p) => p.region === 'Hush');
  const p3 = V.plan(rules, s, hush.id);
  check(!p3.ok && /Veil/.test(p3.why), `the Hush stays shut behind the Veil without the Lens ("${p3.why}")`);
  // a damaged drive reaches less far; a wrecked one cannot stitch
  s.systems.drive = 40;
  check(V.drive(rules, s).range === Math.trunc((150 * 70) / 100), `a drive at 40% stitches ${V.drive(rules, s).range} spans instead of 150`);
  s.systems.drive = 0;
  check(!V.plan(rules, s, g.start).ok, 'a wrecked drive cannot stitch');
  // no Glim: drift to a neighbour at sub-light, slowly
  const t = V.newVoyage(rules, { seed: 5 });
  t.stores.glim = 0;
  const nb = g.lanes[g.adj[t.at].find((i) => g.lanes[i].len <= 100)];
  const nbTo = nb.a === t.at ? nb.b : nb.a;
  const dp = V.driftPlan(rules, t, nbTo), dd = t.day;
  check(!V.plan(rules, t, nbTo).ok && dp.ok && V.drift(rules, t, nbTo).ok && t.at === nbTo && t.day === dd + dp.days && dp.days >= 2, `with no Glim the Forge can still drift one lane at sub-light (${dp.days} days for ${nb.len} spans)`);
}

// 5. Repairs, fitting a component, and the final jump
{
  const s = V.newVoyage(rules, { seed: 5 });
  s.systems.life = 60;
  const ore0 = s.stores.ore, r = V.repair(rules, s, 'life');
  check(r.ok && s.systems.life === 60 + r.points && s.stores.ore === ore0 - r.points * +VY.RepairOre && s.day === 2, `a day's repairs: life support 60% → ${s.systems.life}% for ${r.points * +VY.RepairOre} ore and ${r.points * +VY.RepairSalvage} salvage`);
  s.items.coils = 'found'; s.stores.salvage = 1000;
  const d0 = V.drive(rules, s).range, day0 = s.day;
  const ok = V.install(rules, s, 'coils').ok;
  check(ok && s.items.coils === 'installed' && V.drive(rules, s).range === 150 && d0 === 100 && s.day === day0 + +C.items.coils.Install.Days, `fitting the Threadwound Coils takes ${C.items.coils.Install.Days} days and stretches a stitch from ${d0} to 150 spans`);
  const g = V.galaxyOf(rules, s);
  check(!V.canJumpHome(rules, s).ok, 'no final jump without the Heartstone');
  for (const id of ['lens', 'spindle', 'heartstone']) s.items[id] = 'installed';
  s.at = g.points.find((p) => p.edge).id;
  check(V.jumpHome(rules, s).ok && s.won && s.over.reason === 'home', 'with the Heartstone, from the Shore\'s edge, the Forge makes the final jump home');
}

// 6. A map visit on the voyage: crew, losses, days, wear, relics
{
  const s = V.newVoyage(rules, { seed: 7 });
  const g = V.galaxyOf(rules, s);
  s.at = g.components.coils; // the derelict with the Coils in it
  s.crew.roles.pilots = s.crew.assigned.pilots + 2; // room for exactly one more Dart
  const settings = V.visitSettings(rules, s);
  const w = await makeWorld(settings), me = w.players[0];
  const order = (name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), me);
  const tick = (n) => { for (let i = 0; i < n; i++) w.tick(); };
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  tick(25 * 10);
  order('StartProduction', [forge], null, 'dart');
  order('StartProduction', [forge], null, 'dart');
  const q = forge.trait('ProductionQueue');
  check(q.queue.length === 1 && me.crew.free.pilots === 0, 'building a Dart takes two pilots from the free crew; with none left, the next one is refused');
  // cut the hulk until the relic turns up
  const hulk = w.actors.find((a) => a.wreck && a.wreck.of === 'forge');
  const shearer = w.actors.find((a) => a.owner === me && a.type === 'shearer');
  tick(25 * 2);
  order('Harvest', [shearer], { actor: hulk });
  let found = false;
  for (let i = 0; i < 25 * 600 && !found; i++) { w.tick(); found = w.point.logOf(me).found.includes('coils'); }
  check(found, `a Shearer cutting into the ${settings.poi.name} finds the Threadwound Coils`);
  // lose a Halberd (7 of its 14 crew get away in pods) and leave a Dart outside
  const hal = w.actors.find((a) => a.owner === me && a.type === 'halberd');
  hal.health.damage(null, hal.health.hp + 1, null);
  tick(5);
  forge.health.damage(null, Math.trunc(forge.health.maxHp / 5), null); // a fifth of the hull
  const stay = w.actors.find((a) => a.owner === me && a.type === 'dart' && !a.dead);
  order('Recall', w.actors.filter((a) => a.owner === me && a.mobile && !a.dead && a !== forge && a !== stay));
  tick(25 * 90);
  order('SpoolSkein', [forge]);
  tick(forge.skein.time + 2);
  const report = w.report;
  const crew0 = count(s.crew), hands0 = s.crew.roles.hands, pilots0 = s.crew.roles.pilots, day0 = s.day, sys0 = Object.values(s.systems).reduce((a, b) => a + b, 0);
  V.returnFromMap(rules, s, report);
  const daysThere = Math.trunc(report.ticks / +VY.DayTicks);
  check(report.crew.lost.hands === 7 && report.crew.saved.hands === 7 && s.crew.roles.hands === hands0 - 7 - (report.crew.lost.hands - 7), `a Halberd destroyed: 7 of its 14 hands get away in pods, 7 are lost`);
  check(report.crew.lost.pilots >= 2 && s.crew.roles.pilots === pilots0 - report.crew.lost.pilots, `a Dart left behind takes its ${report.crew.lost.pilots} pilots with it`);
  check(s.items.coils === 'found' && s.day === day0 + daysThere, `the voyage gets the Coils, and the ${daysThere} days spent there pass (${report.ticks} ticks)`);
  const sys1 = Object.values(s.systems).reduce((a, b) => a + b, 0);
  check(sys1 === sys0 - 20 * +VY.SystemWear, `a fifth of the hull lost wears ${20 * +VY.SystemWear} points off the Forge's systems`);
  check(count(s.crew) === crew0 - report.crew.lost.hands - report.crew.lost.pilots - (s.log.some((l) => /died|suffocated|left/.test(l.text) && l.day > day0) ? count(s.crew) : 0) || count(s.crew) === crew0 - Object.values(report.crew.lost).reduce((a, b) => a + b, 0), 'the crew count adds up');
  // revisiting: the place yields less
  const s2 = clone(s);
  const again = V.visitSettings(rules, s2);
  const ore = (st) => st.fields.reduce((m, f) => m + f.ore[1], 0);
  check(ore(again) < ore(settings) && !again.layout.hulk.relic, `a place visited again yields less (${ore(settings)} → ${ore(again)} top ore per rock across fields), and the relic is gone`);
}

// 7. The Forge destroyed ends the run
{
  const s = V.newVoyage(rules, { seed: 9 });
  const w = await makeWorld(V.visitSettings(rules, s));
  const forge = w.actors.find((a) => a.owner === w.players[0] && a.has('Hangar'));
  for (let i = 0; i < 50; i++) w.tick();
  forge.health.damage(null, forge.health.hp + 10, null);
  for (let i = 0; i < 3; i++) w.tick();
  check(w.report && w.report.forgeLost && w.gameOver, 'the Forge destroyed on a map ends the visit with a report');
  V.returnFromMap(rules, s, w.report);
  check(s.over && s.over.reason === 'forge', `and the voyage: "${s.over && s.over.text}"`);
}

// 8. Save and load: the identical voyage
{
  const play = (s) => {
    const g = V.galaxyOf(rules, s);
    for (let k = 0; k < 6; k++) {
      const li = g.adj[s.at].find((i) => g.lanes[i].len <= V.drive(rules, s).range && !g.lanes[i].veil);
      const l = g.lanes[li];
      V.stitch(rules, s, l.a === s.at ? l.b : l.a);
      V.rest(rules, s);
    }
    V.repair(rules, s, 'hull');
    return V.voyageHash(s);
  };
  const s = V.newVoyage(rules, { seed: 21 });
  play(s);
  const saved = V.saveVoyage(s);
  const a = play(V.loadVoyage(rules, saved)), b = play(V.loadVoyage(rules, saved)), c = play(s);
  check(a === b && b === c, `saving and loading gives the identical voyage (hash ${a.toString(16)} three ways)`);
}

// 9. The abstract captain: plays the galaxy layer to the end with simple rules, and visits that
// yield what a short stay at that kind of place would (no maps are played). It shows the voyage
// can be won, and roughly how long it takes.
function captain(seed) {
  const s = V.newVoyage(rules, { seed });
  const g = V.galaxyOf(rules, s);
  const order = ['coils', 'lens', 'spindle', 'heartstone'];
  const YIELD = { IceTail: { ice: 3200, ore: 400 }, LanternMist: { glim: 2400, spores: 700, ore: 200 }, OreReef: { ore: 2000 }, ScrapShoal: { ore: 900, salvage: 700, ice: 300 }, Wreck: { salvage: 1600, ore: 300 }, StillWater: { ore: 300, ice: 200 } };
  let visits = 0, stitches = 0, goal = null;
  const visit = () => {
    const p = g.points[s.at], times = s.visited[p.id] | 0, rich = Math.max(+VY.RevisitFloor, 100 - times * +VY.RevisitPct);
    const stores = {};
    for (const [k, n] of Object.entries(s.stores)) stores[k] = { start: n, end: n + Math.trunc(((YIELD[p.type][k] || 0) * rich) / 100), changes: {} };
    const found = p.relic && !s.items[p.relic] ? [p.relic] : [];
    V.returnFromMap(rules, s, { stores, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: (+VY.DayTicks * 5) / 2, found, crew: { lost: {} }, kills: 0 });
    visits++;
  };
  // the nearest place (fewest days) that fits, which the Glim aboard can reach
  const nearest = (pred) => {
    let best = null;
    for (const p of g.points) {
      if (!pred(p)) continue;
      if (p.id === s.at) return { id: p.id, days: 0 };
      const pl = V.plan(rules, s, p.id);
      if (pl.ok && (!best || pl.route.days < best.days || (pl.route.days === best.days && pl.route.glim < best.glim))) best = { id: p.id, days: pl.route.days, glim: pl.route.glim };
    }
    return best;
  };
  const type = (t) => (p) => p.type === t && (s.visited[p.id] | 0) < 3;
  for (let guard = 0; !s.over && guard < 600; guard++) {
    const next = order.find((id) => s.items[id] !== 'installed');
    const left = V.daysLeft(rules, s), here = g.points[s.at];
    // supplies first, checked at every stop
    const lowGlim = s.stores.glim < 600 || (s.stores.food < 900 && s.stores.spores < 100);
    // keep a supply run going once started, unless water gets desperate
    // enough water for the trip to the goal and a margin, or at least twelve days
    const trip = goal && goal.days ? goal.days + 6 : 12;
    const urgent = left.ice < 5 ? 'IceTail' : goal && (goal.kind === 'IceTail' || goal.kind === 'LanternMist') ? goal.kind : left.ice < Math.max(12, trip) ? 'IceTail' : lowGlim ? 'LanternMist' : null;
    if (urgent) {
      // at a supply place: stay (visit again) until the stores are well up
      if (type(urgent)(here)) { visit(); if (urgent !== 'IceTail' || V.daysLeft(rules, s).ice >= Math.max(20, trip) || !type(urgent)(here)) goal = null; continue; }
      if (!goal || goal.kind !== urgent) { const n = nearest(type(urgent)); if (n) goal = { ...n, kind: urgent }; }
    }
    if (!urgent && next && s.items[next] === 'found') {
      if (V.install(rules, s, next).ok) { goal = null; continue; }
      if (here.type === 'Wreck' || here.type === 'ScrapShoal') { visit(); continue; }
      if (!goal) { const n = nearest((p) => p.type === 'Wreck' || p.type === 'ScrapShoal'); if (n) goal = { ...n, kind: 'salvage' }; }
    }
    if (!goal) {
      const n = next ? nearest((p) => p.id === g.components[next]) : nearest((p) => p.edge);
      if (n) goal = { ...n, kind: next || 'home' };
      else { const m = nearest(type('LanternMist')) || nearest(type('IceTail')); if (!m) break; goal = { ...m, kind: 'any' }; }
    }
    if (s.at === goal.id) {
      if (!next && here.edge) { V.jumpHome(rules, s); break; }
      visit(); goal = null; continue;
    }
    const pl = V.plan(rules, s, goal.id);
    if (!pl.ok) { goal = null; continue; }
    // one stitch at a time
    V.stitch(rules, s, pl.route.hops[0]);
    stitches++;
  }
  return { s, visits, stitches };
}
{
  const rows = [];
  let allWon = true;
  for (const seed of [1, 2, 3]) {
    const { s, visits, stitches } = captain(seed);
    if (!s.won) allWon = false;
    // a rough play time: ten minutes a map, half a minute per stitch on the chart
    rows.push(`seed ${seed}: ${s.won ? 'home' : `lost (${s.over ? s.over.reason : 'stuck'})`} on day ${s.day}, ${visits} visits, ${stitches} stitches, ~${Math.round((visits * 10 + stitches * 0.5) / 6) / 10} h, crew ${count(s.crew)}`);
  }
  check(allWon, `an abstract captain gets home on every seed tried: ${rows.join('; ')}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll voyage checks passed');
process.exitCode = failures ? 1 : 0;
void free;
