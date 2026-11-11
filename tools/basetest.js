// The Forge as a base, and survival that weakens, no browser needed:  npm test
// Rooms on the deck plan (slots, memories, stripping, a new life without them); strain instead
// of death for every shortage, rising and falling a level a day, capped, taking the right
// stations dark; the boilers burning Glim and going cold; the crew's mood and what it costs;
// strikes and parleys; All hands; cogmarks in trade; what a map is told; old saves.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import * as V from '../src/galaxy/voyage.js';
import * as B from '../src/galaxy/base.js';
import * as K from '../src/galaxy/crew.js';
import * as CM from '../src/galaxy/comms.js';
import { trigger } from '../src/galaxy/events.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const C = rules.content, VY = C.voyage;
const clone = (x) => JSON.parse(JSON.stringify(x));
const rich = (s) => Object.assign(s.stores, { ore: 1e5, salvage: 1e5, ice: 1e5, food: 1e5, glim: 1e5, spores: 1e4 });
// a voyage with plenty of everything and a happy crew, the chart lit
function fresh(seed = 4) {
  const s = V.newVoyage(rules, { seed });
  s.queue = [];
  rich(s);
  V.remember(rules, s, 'radar', { quiet: true });
  return s;
}
const state = (s, id) => B.stations(rules, s).find((x) => x.id === id).state;

// 1. Rooms and the deck plan
{
  const rooms = B.rooms(rules);
  check(rooms.length === 17 && B.deckSlots(rules) === 8, `17 rooms (today's eleven projects and six new ones) for a deck plan of ${B.deckSlots(rules)} slots`);
  const s = fresh();
  check(!V.installPlan(rules, s, 'messhall').ok && /Recall the mess hall/.test(V.installPlan(rules, s, 'messhall').why) && V.installPlan(rules, s, 'quarters').ok, 'the mess hall needs its memory; the crew quarters do not');
  s.items['plan-workshop'] = s.items['plan-stillroom'] = 'found'; // (their plans come from traders: tradertest)
  for (const id of ['quarters', 'workshop', 'stillroom', 'racks', 'array', 'recycler', 'hangar', 'repair-bays']) V.install(rules, s, id);
  const full = V.installPlan(rules, s, 'foundry-line');
  check(B.slotsUsed(rules, s) === 8 && !full.ok && /deck plan is full/.test(full.why) && V.installPlan(rules, s, 'plating').ok, `eight rooms fill the deck plan; a ninth won't fit ("${full.why}"), but plating on the hull takes no slot`);
  check(!V.stripPlan(rules, s, 'hangar').ok || !B.built(s, 'second-hangar'), 'a room something else is built on stays until that goes');
  const day = s.day;
  check(V.strip(rules, s, 'array').ok && !B.built(s, 'array') && s.day === day + 1 && V.installPlan(rules, s, 'foundry-line').ok, 'stripping a room takes a day and frees its slot');
  const water = V.needs(rules, s).water, t = fresh(); t.crew = clone(s.crew);
  check(water < V.needs(rules, t).water && B.berths(rules, s) === +VY.Berths + 40, `the still room saves water (${water} a day against ${V.needs(rules, t).water}); the quarters add 40 berths`);
  // rooms are physical: a new life starts without them; the memory of how stays
  V.remember(rules, s, 'messhall', { quiet: true });
  const next = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'letgo', day: s.day, text: '' } }));
  check(!B.rooms(rules).some((r) => B.built(next, r.id)) && B.slotsUsed(rules, next) === 0 && B.roomKnown(rules, next, 'messhall'), 'a new life wakes with an empty deck plan, but remembers how to build the mess hall');
}

// 2. Strain: shortages weaken, they never kill
{
  const s = fresh();
  s.stores.ice = 0;
  const seen = [];
  for (let d = 0; d < 4; d++) { V.dayTick(rules, s); seen.push(s.strain.thirst); s.stores.ice = 0; }
  check(seen.join() === '1,2,3,3', `no water: thirst strain rises a level a day, to 3 (${seen.join(', ')})`);
  s.stores.ice = 1e5;
  const back = [];
  for (let d = 0; d < 4; d++) { V.dayTick(rules, s); back.push(s.strain.thirst); }
  check(back.join() === '2,1,0,0', `water again: it eases off a level a day (${back.join(', ')})`);
  const m = fresh();
  V.remember(rules, m, 'messhall', { quiet: true }); V.install(rules, m, 'messhall');
  m.strain.hunger = 3; m.strain.cold = 3;
  V.dayTick(rules, m);
  check(m.strain.hunger === 1 && m.strain.cold === 2, 'the mess hall eases hunger and thirst off twice as fast (and nothing else)');
  // the penalties add up, but are capped
  const w = fresh(), base = { work: B.workPctOf(rules, w), cost: B.costPctOf(rules, w), ships: B.shipPctOf(rules, w) };
  w.strain = { thirst: 3, hunger: 3, air: 3, cold: 3 };
  const worst = { work: B.workPctOf(rules, w), ships: B.shipPctOf(rules, w) };
  w.strain = { thirst: 2, hunger: 2, air: 0, cold: 0 };
  const four = { work: B.workPctOf(rules, w), ships: B.shipPctOf(rules, w) };
  check(worst.work === four.work && worst.ships === four.ships && worst.work >= 40 && worst.ships === 80, `every level of strain costs, capped at four: work ${base.work}% → ${worst.work}%, ships ${base.ships}% → ${worst.ships}%`);
  // the right stations go dark, at 2 and at 3
  const want = { thirst: ['lifesupport', 'infirmary'], hunger: ['hangar', 'stores'], air: ['infirmary', 'comms'], cold: ['engineering', 'foundry'] };
  let right = true;
  const rows = [];
  for (const [k, ids] of Object.entries(want)) {
    const x = fresh();
    V.remember(rules, x, 'messhall', { quiet: true }); V.remember(rules, x, 'infirmary', { quiet: true }); V.install(rules, x, 'infirmary');
    x.strain[k] = 2;
    if (state(x, ids[0]) !== 'dark' || state(x, ids[1]) === 'dark') right = false;
    x.strain[k] = 3;
    if (state(x, ids[1]) !== 'dark') right = false;
    rows.push(`${k}: ${ids.join(', then ')}`);
  }
  check(right, `the right stations go dark for each shortage (${rows.join('; ')})`);
  // a dark station loses what it does
  const d = fresh();
  d.strain.cold = 3; d.systems.drive = 90;
  const lifeAir = fresh(); lifeAir.strain.thirst = 2; lifeAir.stores.air = 500;
  V.dayTick(rules, lifeAir);
  check(!V.repairPlan(rules, d, 'drive').ok && !V.installPlan(rules, d, 'quarters').ok && V.visitSettings(rules, d).players[0].buildSpeed === 0 && lifeAir.stores.air < 500 - V.needs(rules, lifeAir).air + 1, 'dark engineering: no repairs, no building; dark foundry: no ships on maps; dark life support: no air is made');
  // nobody dies of it, ever
  const z = V.newVoyage(rules, { seed: 6 });
  z.queue = [];
  let ok = true;
  for (let day = 0; day < 200; day++) { Object.assign(z.stores, { ice: 0, food: 0, air: 0, glim: 0, spores: 0 }); V.dayTick(rules, z); if (z.over || K.count(z.crew) !== 150 || z.crew.fallen.length) ok = false; }
  check(ok && B.strainTotal(z) === 12, `two hundred days with nothing: every strain at 3, nobody lost, the life goes on (day ${z.day})`);
}

// 3. The boilers burn Glim
{
  const s = fresh();
  s.stores.glim = 25;
  V.dayTick(rules, s); V.dayTick(rules, s);
  const warm = !s.cold && s.stores.glim === 5;
  const out0 = V.output(s, 'life');
  V.dayTick(rules, s);
  check(warm && +VY.ReactorGlim === 10 && s.cold === 50 && V.output(s, 'life') === out0 >> 1 && s.strain.cold === 1 && state(s, 'navigation') === 'cold', `the boilers burn ${VY.ReactorGlim} Glim a day; with none, they go cold: systems at half, cold strain, stations cold`);
  s.stores.glim = 500;
  V.dayTick(rules, s);
  check(!s.cold && s.log.some((l) => /boilers are lit again/.test(l.text)), 'with Glim aboard again, the boilers are lit');
}

// 4. The crew's mood, and what it costs
{
  const s = fresh();
  const content = { mood: B.moodOf(rules, s).mark, ore: V.installPlan(rules, s, 'quarters').ore, days: V.installPlan(rules, s, 'plating').days, glim: B.glimPctOf(rules, s) };
  s.morale = 45;
  const uneasy = { mood: B.moodOf(rules, s).mark, ore: V.installPlan(rules, s, 'quarters').ore, glim: B.glimPctOf(rules, s) };
  s.morale = 20;
  const angry = { mood: B.moodOf(rules, s).mark, ore: V.installPlan(rules, s, 'quarters').ore, glim: B.glimPctOf(rules, s) };
  const ore = +C.items.quarters.Install.Ore;
  check(content.mood === 'content' && uneasy.mood === 'uneasy' && angry.mood === 'angry' && content.ore === ore && uneasy.ore === Math.trunc(ore * 1.1) && angry.ore === Math.trunc(ore * 1.3) && uneasy.glim === 110 && angry.glim === 130, `costs follow the mood: the quarters take ${content.ore}, ${uneasy.ore}, ${angry.ore} ore and a stitch 100%, ${uneasy.glim}%, ${angry.glim}% Glim, content, uneasy, angry`);
  const g = fresh(); g.stores.food = 0;
  const why = B.moodOf(rules, g);
  check(why.mark === 'angry' && why.causes.some((c) => c.id === 'hunger' && c.bad), `a store gone makes them angry, and says why ("${why.causes.map((c) => c.text).join(' ')}")`);
  const crowd = fresh(); crowd.crew.roles.hands += 40;
  check(B.moodOf(rules, crowd).causes.some((c) => c.id === 'crowded'), 'more crew than berths: crowded');
  // the spiral can be climbed out of: an angry, strained ship, stores back, rests its way to content
  const a = fresh(); a.morale = 10; a.strain = { thirst: 3, hunger: 3, air: 0, cold: 0 }; a.strikes = ['hangar'];
  let days = 0;
  for (; days < 30 && B.moodOf(rules, a).mark !== 'content'; days++) V.rest(rules, a);
  check(B.moodOf(rules, a).mark === 'content' && !a.strikes.length && B.strainTotal(a) === 0, `an angry, strained ship with its stores back is content again after ${days} days of rest`);
  check(content.days < Math.trunc((+C.items.plating.Install.Days * 100) / 100) + 1, `content crews work faster (plating: ${content.days} days for ${C.items.plating.Install.Days})`);
}

// 5. Strikes and parleys
{
  const s = fresh();
  s.morale = 5;
  V.dayTick(rules, s);
  const one = [...s.strikes];
  V.dayTick(rules, s);
  check(one.length === 1 && s.strikes.length === 2 && s.strikes.every((id) => state(s, id) === 'striking') && !s.over, `under 15, a station's crew walk off each day (${s.strikes.join(', ')}); nobody leaves for good`);
  const p = clone(s);
  check(V.parley(rules, p, 'day').ok && !p.strikes.length && p.day === s.day + 1, 'a parley: a day of talking, and they go back');
  const q = clone(s); q.stores.cogmarks = 10;
  check(!V.parley(rules, q, 'pay').ok && (q.stores.cogmarks = 200) && V.parley(rules, q, 'pay').ok && q.stores.cogmarks === 200 - 2 * +C.mood.Pay && q.day === s.day, `or pay them: ${2 * +C.mood.Pay} cogmarks for two stations, and no day lost`);
  const r = clone(s); r.morale = 40;
  V.dayTick(rules, r);
  check(!r.strikes.length && r.log.some((l) => /strike is over/.test(l.text)), 'with morale back over 30, the strikers return on their own');
}

// 6. All hands
{
  const s = fresh();
  s.morale = 70;
  V.dayTick(rules, s);
  const on = s.allHands.days === 1 && s.log.some((l) => /^All hands!/.test(l.text));
  const work = B.workPctOf(rules, s), glim = B.glimPctOf(rules, s), ships = B.shipPctOf(rules, s);
  s.morale = 75; const m0 = s.morale;
  for (let d = 0; d < 4; d++) V.dayTick(rules, s);
  check(on && work === 121 && glim === 90 && ships === 105 && s.morale >= m0, `every station green: All hands, the bell; work ${work}%, Glim a stitch ${glim}%, ships ${ships}%, and morale doesn't fall`);
  V.dayTick(rules, s);
  check(s.allHands.days === 6 && s.queue.includes('AllHandsSong'), 'six days of it: somebody writes a song about the Forge');
  // it stops exactly when one thing goes wrong
  const x = clone(s);
  K.kill(x.crew, K.officerOf(x.crew, 'navigator').id, { day: x.day, how: 'a test' });
  x.crew.roles.pilots = 0; // nobody left to step up
  V.dayTick(rules, x);
  const y = clone(s); y.stores.food = 0; y.stores.spores = 0; y.systems.hydro = 0;
  V.dayTick(rules, y);
  check(!B.allHandsNow(rules, x) && x.allHands.days === 0 && y.allHands.days === 0 && y.log.some((l) => /All hands ends after/.test(l.text)), 'and stops the day a station dims or a store runs out');
  const z = fresh(); z.morale = 70; z.systems.sensors = 40;
  V.dayTick(rules, z);
  check(z.allHands.days === 0 && state(z, 'sensors') === 'dim', 'a station working through a half-wrecked system is dim, and there is no All hands');
}

// 7. Cogmarks
{
  const s = fresh(5), g = V.galaxyOf(rules, s);
  const seat = g.points.find((p) => p.seat && p.owner === 'rivet') || g.points.find((p) => p.seat);
  const fid = seat.owner;
  s.standing[fid] = 30; s.met[fid] = true;
  const purse = CM.stockOf(rules, s, fid, seat.id).goods.cogmarks;
  // sell ore for cogmarks, worth exactly what the ore fetches
  const each = CM.sellPrice(rules, 2, fid, 'ore');
  const qs = CM.quote(rules, s, fid, seat.id, { cogmarks: 50 }, { ore: 500 });
  check(purse === +C.trade.Purse && qs.cost === 50 && CM.buyPrice(rules, 0, 'cogmarks', 0, 0) === 100 && CM.sellPrice(rules, 0, fid, 'cogmarks') === 100, `cogmarks are worth 1 to both sides, at any standing; a trader's purse holds ${purse}`);
  const big = CM.quote(rules, s, fid, seat.id, { cogmarks: purse + 1 }, { ore: 50000 });
  check(!big.ok && /purse/.test(big.why), `they pay out no more than their purse ("${big.why}")`);
  // settle: cogmarks make up the difference, either way, and the deal is fair
  const worth = CM.quote(rules, s, fid, seat.id, {}, { ore: 300 }).pay;
  const st = CM.settle(rules, s, fid, seat.id, {}, { ore: 300 });
  const sq = CM.quote(rules, s, fid, seat.id, st.buy, st.sell);
  const c0 = s.stores.cogmarks;
  CM.deal(rules, s, fid, seat.id, st.buy, st.sell);
  check(sq.ok && st.buy.cogmarks > 0 && s.stores.cogmarks === c0 + st.buy.cogmarks && st.buy.cogmarks === worth && each > 0, `selling 300 ore: ${st.buy.cogmarks} cogmarks, what the ore is worth to them`);
  const good = Object.keys(CM.stockOf(rules, s, fid, seat.id).goods).find((k) => k !== 'cogmarks' && !k.startsWith('ship:') && !K.ROLES.includes(k));
  const b2 = { [good]: 10 }, st2 = CM.settle(rules, s, fid, seat.id, b2, {});
  const q2 = CM.quote(rules, s, fid, seat.id, st2.buy, st2.sell);
  check(q2.ok && st2.sell.cogmarks === q2.cost && q2.pay === q2.cost, `buying 10 ${good}: ${st2.sell.cogmarks} cogmarks, exactly the price (currency and barter agree)`);
  // a dark stores station makes deals dearer; cogmarks reset each life; Shearers find them
  const d = clone(s); d.strain.hunger = 3;
  check(CM.quote(rules, d, fid, seat.id, b2, {}).cost > q2.cost, 'with the stores station dark, traders charge more');
  const n = V.newLife(rules, Object.assign(clone(s), { over: { reason: 'letgo', day: s.day, text: '' } }));
  check(n.stores.cogmarks === 60, 'cogmarks are physical: a new life wakes with 60');
  s.at = g.points.find((p) => p.type === 'Wreck').id;
  const c1 = s.stores.cogmarks;
  V.returnFromMap(rules, s, { stores: { salvage: { start: s.stores.salvage, end: s.stores.salvage + 600, changes: { gathered: 600 } } }, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found: [], crew: { lost: {} } });
  check(s.stores.cogmarks === c1 + 600 / +VY.SalvagePerCogmark, `the Shearers find a cogmark for every ${VY.SalvagePerCogmark} salvage they cut`);
}

// 8. What a map is told, and what it does with it
{
  const s = fresh(); s.morale = 20; s.strain.hunger = 2;
  const st = V.visitSettings(rules, s), p0 = st.players[0];
  check(p0.costPct === B.costPctOf(rules, s) && p0.costPct > 130 && p0.shipPct === B.shipPctOf(rules, s) && p0.shipPct < 100 && st.voyage.mood === 'angry' && st.voyage.causes.length > 0 && p0.launchPct === 2 * V.projectBonus(rules, s, 'LaunchPct'), `an angry, hungry crew: ships cost ${p0.costPct}% and fight at ${p0.shipPct}%; the dark hangar launches at half speed`);
  const w = await makeWorld({ players: [{ name: 'You', faction: 'meridian', ships: ['forge'], stores: { ore: 5000 }, costPct: 150 }] });
  const forge = w.actors.find((a) => a.has('Hangar'));
  const ore0 = w.players[0].resources.cash;
  w.resolveOrder(makeOrder('StartProduction', [forge], null, 'dart'), w.players[0]);
  const cost = ore0 - w.players[0].resources.cash, dart = rules.actor('dart').traitInfo('Valued').Cost;
  check(cost === Math.trunc((dart * 150) / 100), `on the map, a Dart costs ${cost} ore at 150% (${dart} as normal)`);
}

// 9. Saves
{
  const s = fresh(); s.morale = 5; V.dayTick(rules, s); s.strain.cold = 2;
  const t = V.loadVoyage(rules, V.saveVoyage(s));
  check(V.voyageHash(t) === V.voyageHash(s), 'strain, strikes and All hands save and load exactly');
  const old = clone(V.newVoyage(rules, { seed: 2 }));
  delete old.strain; delete old.strikes; delete old.allHands; delete old.cold; delete old.stores.cogmarks; old.version = 6;
  const m = V.loadVoyage(rules, JSON.stringify(old));
  check(m.version === V.SAVE_VERSION && m.strain.thirst === 0 && Array.isArray(m.strikes) && m.stores.cogmarks === 0, 'a save from before the base loads with no strain, no strikes and no cogmarks');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll base checks passed');
process.exitCode = failures ? 1 : 0;
