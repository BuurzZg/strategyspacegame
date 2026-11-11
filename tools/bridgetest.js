// The bridge: stations, levels and training, no browser needed:  npm test
// Nine stations, each run by an officer's post (the signals officer is new); every open
// station wakes at level 1 each life, and what Jacob remembers opens a station from day 1;
// training (cogmarks and days) takes it to 2 and 3 for this life, cheaper where Jacob
// remembers; an officer's work counts half at level 1; every trained skill does what it says;
// what is remembered lasts and what is trained is relearned; old saves.
import { rules as loadCore } from './headless.js';
import * as V from '../src/galaxy/voyage.js';
import * as B from '../src/galaxy/base.js';
import * as K from '../src/galaxy/crew.js';
import * as CM from '../src/galaxy/comms.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const C = rules.content, S = C.crew.stations, SK = C.crew.skills;
const clone = (x) => JSON.parse(JSON.stringify(x));
function fresh(seed = 4) {
  const s = V.newVoyage(rules, { seed });
  s.queue = [];
  Object.assign(s.stores, { ore: 1e5, salvage: 1e5, ice: 1e5, food: 1e5, glim: 1e5, spores: 1e4, cogmarks: 1000 });
  V.remember(rules, s, 'radar', { quiet: true });
  return s;
}
const lv = (s, id) => B.levelOf(rules, s, id);
const trainTo = (s, id, n) => { while (lv(s, id) < n && V.train(rules, s, id).ok); return lv(s, id); };
const next = (s) => V.newLife(rules, Object.assign(clone(s), { over: { reason: 'letgo', day: s.day, text: '' } }));

// 1. Nine stations, nine posts
{
  const s = V.newVoyage(rules, { seed: 2 });
  const posts = Object.keys(C.crew.posts);
  check(Object.keys(S).length === 9 && posts.length === 9 && Object.values(S).every((st) => !st.Post || posts.includes(st.Post)) && S.comms.Post === 'signals' && K.officerOf(s.crew, 'signals'), `nine stations, each with its officer; the new signals officer, ${K.officerOf(s.crew, 'signals').name}, runs comms`);
  check(Object.values(S).every((st) => String(st.Train).split(',').length === 2 && String(st.Train).split(',').every((k) => SK[k.trim()])), `every station has two trained skills (${Object.keys(SK).length} in all)`);
}

// 2. Levels: every open station wakes at 1; memories open stations from day 1
{
  const s = V.newVoyage(rules, { seed: 3 });
  const levels = Object.keys(S).map((id) => `${id} ${lv(s, id)}`);
  check(lv(s, 'sensors') === 0 && lv(s, 'infirmary') === 0 && Object.keys(S).filter((id) => id !== 'sensors' && id !== 'infirmary').every((id) => lv(s, id) === 1), `the first life wakes with sensors and the infirmary dark, the rest manned (${levels.join(', ')})`);
  V.remember(rules, s, 'radar', { quiet: true });
  const t = next(s);
  check(t.day === 1 && lv(t, 'sensors') === 1, 'once the radar is remembered, sensors are lit from day 1 of every life (muscle memory)');
  V.remember(rules, t, 'messhall', { quiet: true }); V.remember(rules, t, 'infirmary', { quiet: true });
  t.stores.ore = 9999; t.stores.salvage = 9999;
  V.install(rules, t, 'infirmary');
  check(lv(t, 'infirmary') === 1, 'the infirmary opens with its memory and its room');
  t.strain.hunger = 2;
  check(lv(t, 'hangar') === 0, 'a station that strain takes dark is at level 0');
}

// 3. Training: cogmarks and days, to 2 and 3; cheaper where Jacob remembers
{
  const s = fresh();
  const p2 = V.trainPlan(rules, s, 'lifesupport'), c0 = s.stores.cogmarks, d0 = s.day;
  V.train(rules, s, 'lifesupport');
  const p3 = V.trainPlan(rules, s, 'lifesupport');
  V.train(rules, s, 'lifesupport');
  check(p2.cogmarks === 30 && p2.days === 1 && p3.cogmarks === 60 && p3.days === 2 && s.stores.cogmarks === c0 - 90 && s.day === d0 + 3 && lv(s, 'lifesupport') === 3 && !V.trainPlan(rules, s, 'lifesupport').ok, 'life support: 30 cogmarks and a day to level 2, 60 and two days to 3, and no further');
  const e = fresh();
  const plain = V.trainPlan(rules, e, 'engineering').cogmarks;
  V.remember(rules, e, 'shields', { quiet: true });
  const known = V.trainPlan(rules, e, 'engineering');
  check(plain === 30 && known.cogmarks === 15 && known.cheaper, `training costs half where Jacob remembers: engineering ${plain} cogmarks, ${known.cogmarks} once Shields are remembered`);
  const poor = fresh(); poor.stores.cogmarks = 10;
  const dark = fresh(); dark.strikes = ['foundry'];
  check(!V.trainPlan(rules, poor, 'navigation').ok && !V.trainPlan(rules, dark, 'foundry').ok && !V.trainPlan(rules, fresh(3 + 0), 'infirmary').ok, 'no training without the cogmarks, on strike, or before a station opens');
  // an officer's work: half at level 1, in full from level 2
  const o = fresh();
  K.officerOf(o.crew, 'engineer').trait = 'gifted';
  const half = V.projectBonus(rules, o, 'RepairPct');
  V.train(rules, o, 'engineering');
  const full = V.projectBonus(rules, o, 'RepairPct');
  check(half === 112 && full === 125, `a gifted chief engineer: repairs ${half}% at level 1, ${full}% once engineering is trained`);
}

// 4. Every trained skill does what it says
{
  const rows = [];
  const pairs = [];
  const at = (id, n, fn) => { const a = fresh(), b = fresh(); trainTo(b, id, n); return fn(a, b); };
  pairs.push(['field repairs', at('engineering', 2, (a, b) => { a.systems.life = b.systems.life = 50; return V.repairPlan(rules, b, 'life').ore / V.repairPlan(rules, b, 'life').points < V.repairPlan(rules, a, 'life').ore / V.repairPlan(rules, a, 'life').points; })]);
  pairs.push(['damage control', at('engineering', 3, (a, b) => B.skillPct(rules, b, 'SystemWearPct') === 50 && B.skillPct(rules, a, 'SystemWearPct') === 100)]);
  pairs.push(['plotted courses', at('navigation', 2, (a, b) => V.stitchCost(rules, b, 150) < V.stitchCost(rules, a, 150))]);
  pairs.push(['quick stitch', at('navigation', 3, (a, b) => V.stitchTime(rules, b, 200) === V.stitchTime(rules, a, 200) - 1 && V.stitchTime(rules, b, 60) === V.stitchTime(rules, a, 60))]);
  pairs.push(['long watch', at('sensors', 2, (a, b) => V.sensorRange(rules, b) > V.sensorRange(rules, a))]);
  pairs.push(['cheap scans', at('sensors', 3, (a, b) => V.scanPlan(rules, b).glim * 2 === V.scanPlan(rules, a).glim)]);
  pairs.push(['shift work', at('foundry', 2, (a, b) => V.visitSettings(rules, b).players[0].buildSpeed > V.visitSettings(rules, a).players[0].buildSpeed)]);
  pairs.push(['salvage line', at('foundry', 3, (a, b) => B.skillPct(rules, b, 'SalvageCogPct') === 200)]);
  pairs.push(['ration plan', at('lifesupport', 2, (a, b) => V.needs(rules, b).food < V.needs(rules, a).food && V.needs(rules, b).air < V.needs(rules, a).air)]);
  pairs.push(['recyclers', at('lifesupport', 3, (a, b) => V.needs(rules, b).water < V.needs(rules, a).water)]);
  pairs.push(['drills', at('hangar', 2, (a, b) => V.visitSettings(rules, b).players[0].xpPct > V.visitSettings(rules, a).players[0].xpPct)]);
  pairs.push(['fast launch', at('hangar', 3, (a, b) => V.visitSettings(rules, b).players[0].launchPct < V.visitSettings(rules, a).players[0].launchPct)]);
  pairs.push(['long-range hails', at('comms', 2, (a, b) => { const g = V.galaxyOf(rules, a), li = g.adj[a.at][0], l = g.lanes[li], n = l.a === a.at ? l.b : l.a; return !V.canHail(rules, a, n).ok && V.canHail(rules, b, n).ok; })]);
  pairs.push(['signal decoding', at('comms', 3, (a, b) => B.skillSum(rules, b, 'Decode') === 25)]);
  pairs.push(['triage', at('infirmary', 2, () => true)]);
  pairs.push(['field hospital', at('stores', 1, () => true)]);
  pairs.push(['ledgers', at('stores', 2, (a, b) => { const g = V.galaxyOf(rules, a), seat = g.points.find((p) => p.seat); for (const x of [a, b]) { x.standing[seat.owner] = 30; x.met[seat.owner] = true; } return CM.quote(rules, b, seat.owner, seat.id, { food: 100 }, {}).cost < CM.quote(rules, a, seat.owner, seat.id, { food: 100 }, {}).cost; })]);
  pairs.push(['tight holds', at('stores', 3, (a, b) => B.skillPct(rules, b, 'CargoPct') === 110)]);
  // the infirmary's two: it has to be open first
  const inf = fresh(); V.remember(rules, inf, 'messhall', { quiet: true }); V.remember(rules, inf, 'infirmary', { quiet: true }); V.install(rules, inf, 'infirmary');
  const care0 = B.carePct(rules, inf);
  trainTo(inf, 'infirmary', 3);
  pairs[pairs.findIndex((p) => p[0] === 'triage')][1] = B.skillSum(rules, inf, 'Triage') === 33;
  pairs[pairs.findIndex((p) => p[0] === 'field hospital')][1] = B.carePct(rules, inf) < care0;
  for (const [n, ok] of pairs) rows.push(`${n}${ok ? '' : ' (NO)'}`);
  check(pairs.every((p) => p[1]), `every trained skill does what it says: ${rows.join(', ')}`);
  // decoding and triage in play
  const d = fresh(); trainTo(d, 'comms', 3);
  const g = V.galaxyOf(rules, d);
  V.addClue(rules, d, 'coils');
  const r0 = d.campaign.chart.clues.find((c) => c.id === 'coils').r;
  let tightened = false;
  for (let k = 0; k < 40 && !tightened; k++) { const li = g.adj[d.at].find((i) => { const l = g.lanes[i]; return !l.hazard && l.len <= V.drive(rules, d).range; }); const l = g.lanes[li]; V.stitch(rules, d, l.a === d.at ? l.b : l.a); tightened = d.campaign.chart.clues.find((c) => c.id === 'coils').r < r0; }
  check(tightened, 'signal decoding: within a few arrivals, a scrap of signal tightens a clue circle');
  const tr = fresh(); V.remember(rules, tr, 'messhall', { quiet: true }); V.remember(rules, tr, 'infirmary', { quiet: true }); V.install(rules, tr, 'infirmary'); trainTo(tr, 'infirmary', 2);
  let saved = 0, lost = 0;
  for (let v = 0; v < 30; v++) {
    const e = tr.fleet.find((x) => x.lead);
    if (!e) break;
    const p = K.personById(tr.crew, e.lead);
    V.returnFromMap(rules, tr, { stores: {}, forge: { hp: tr.forge.hp }, ships: { aboard: tr.fleet.filter((x) => x !== e), destroyed: { [e.type]: 1 }, leftBehind: {}, built: {} }, ticks: 100, found: [], crew: { lost: {}, leadsLost: [{ id: p.id, type: e.type, kills: 0, how: 'killed' }] } });
    if (K.personById(tr.crew, p.id)) saved++; else lost++;
    K.assignFleet(tr.crew, rules, tr.fleet, { day: tr.day });
    tr.fleet.push({ type: 'dart', hp: 200 }); K.assignFleet(tr.crew, rules, tr.fleet, { day: tr.day });
  }
  check(saved > 0 && lost > saved, `triage: of the leads lost with their ships, some are pulled out alive (${saved} of ${saved + lost})`);
}

// 5. What is remembered lasts; what is trained is relearned
{
  const s = fresh();
  V.remember(rules, s, 'shields', { quiet: true });
  trainTo(s, 'engineering', 3); trainTo(s, 'navigation', 2);
  const t = next(s);
  check(V.remembers(t, 'shields') && Object.keys(t.training || {}).length === 0 && lv(t, 'engineering') === 1 && lv(t, 'navigation') === 1 && V.trainPlan(rules, t, 'engineering').cheaper, 'in the next life, Shields are still remembered but every station is back at level 1 (and engineering still trains at half price)');
}

// 6. Saves
{
  const s = fresh(); trainTo(s, 'stores', 2);
  const t = V.loadVoyage(rules, V.saveVoyage(s));
  check(V.voyageHash(t) === V.voyageHash(s), 'training saves and loads exactly');
  const old = clone(V.newVoyage(rules, { seed: 2 }));
  delete old.training; old.version = 7;
  old.crew.people = old.crew.people.filter((p) => p.post !== 'signals');
  const m = V.loadVoyage(rules, JSON.stringify(old));
  V.dayTick(rules, m);
  check(m.version === V.SAVE_VERSION && m.training && !Object.keys(m.training).length && K.officerOf(m.crew, 'signals'), 'a save from before the bridge loads untrained, and someone steps up as signals officer the next day');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll bridge checks passed');
process.exitCode = failures ? 1 : 0;
