import { Random } from '../engine/random.js';
import { hashMix } from '../engine/math.js';
import { mapKinds } from '../engine/content.js';
import { generatePoi, poiSeed } from '../engine/poi.js';
import { generateGalaxy, driveOf, route, laneOpen, stitchGlim, stitchDays } from './galaxy.js';
import { ROLES, makeRoster, count, free, freeAll, loseAny, lose, assignFleet } from './crew.js';

// The voyage: the run on the galaxy map. Plain data (it saves as JSON) plus pure,
// deterministic functions that act on it. The galaxy itself is not saved: it is rebuilt from
// the seed. Every action that takes time runs the day clock, and each day the crew drink,
// eat and breathe, the Forge's systems make what they can, and morale drifts.
//
//   seed, day, ticks (map play not yet a whole day), at (place id), known (place ids seen),
//   visited { id: times }, stores { every resource }, crew (crew.js roster), morale,
//   systems { drive, reactor, life, hydro, foundry, sensors: 0-100 }, forge { hp },
//   fleet [ { type, hp } ], items { id: 'found' | 'installed' }, airless (days in a row),
//   over (null, or why it ended), log [ { day, text, kind } ]

export const START_FLEET = ['halberd', 'dart', 'dart', 'gleaner', 'gleaner', 'shearer', 'skimmer'];
export const SYSTEMS = ['drive', 'reactor', 'life', 'hydro', 'foundry', 'sensors'];
const pairs = (v) => Object.fromEntries(String(v || '').split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p[0]).map(([k, n]) => [k, +n | 0]));
const num = (V, k) => +V[k] | 0;

const galaxies = new Map();
export function galaxyOf(rules, s) {
  const key = s.seed | 0;
  if (!galaxies.has(key)) { galaxies.clear(); galaxies.set(key, generateGalaxy(rules, key)); }
  return galaxies.get(key);
}

export function newVoyage(rules, { seed = 1 } = {}) {
  const V = rules.content.voyage, g = galaxyOf(rules, { seed });
  const stores = Object.fromEntries(Object.keys(rules.content.resources).map((k) => [k, 0]));
  Object.assign(stores, pairs(V.Stores));
  const s = {
    version: 2, kind: 'voyage', seed: seed | 0,
    day: 1, ticks: 0, at: g.start, known: [], visited: {},
    stores,
    crew: makeRoster(pairs(V.Crew)),
    morale: num(V, 'Morale'),
    systems: Object.fromEntries(SYSTEMS.map((k) => [k, 100])),
    forge: { hp: rules.actor('forge').traitInfo('Health').HP },
    fleet: START_FLEET.map((type) => ({ type, hp: rules.actor(type).traitInfo('Health').HP })),
    items: {}, airless: 0, dry: false, over: null, visits: 0,
    log: [],
  };
  assignFleet(s.crew, rules, s.fleet);
  reveal(rules, s);
  note(s, `The Forge comes out of a broken stitch at ${g.points[g.start].name}, in the Drift. The Skein Drive still works, barely.`, 'story');
  signalNote(rules, s);
  return s;
}

// The drive component the engineers can get a fix on now: the first one not yet fitted.
// { id, at } (at: place id), or null when the drive is whole.
export function target(rules, s) {
  const g = galaxyOf(rules, s);
  for (const it of Object.values(rules.content.items)) {
    if (it.Kind !== 'drive' || s.items[it.id] === 'installed') continue;
    return { id: it.id, at: s.items[it.id] === 'found' ? -1 : g.components[it.id] ?? -1 };
  }
  return null;
}
function signalNote(rules, s) {
  const t = target(rules, s), g = galaxyOf(rules, s);
  if (!t || t.at < 0) return;
  const p = g.points[t.at];
  if (!s.known.includes(p.id)) { s.known.push(p.id); s.known.sort((a, b) => a - b); }
  note(s, `The engineers have a fix on the ${rules.content.items[t.id].Name}: it is aboard the ${p.name}, in ${rules.content.regions[p.region].Name}.`, 'story');
}

export function note(s, text, kind = 'info') { s.log.push({ day: s.day, text, kind }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); }

// ---------------------------------------------------------------- the Forge
// A system's working output in percent: its condition, slowed by a damaged reactor.
export function output(s, sys) {
  const c = s.systems[sys] | 0;
  return sys === 'reactor' ? c : Math.trunc((c * (50 + (s.systems.reactor >> 1))) / 100);
}
// Work speed in percent (low morale slows it).
export function workPct(rules, s) { const V = rules.content.voyage; return s.morale < num(V, 'MoraleSlow') ? num(V, 'SlowPct') : 100; }

// The drive as it is now: components fitted, and its condition (half range at worst; none at 0).
export function drive(rules, s) {
  const installed = Object.keys(s.items).filter((k) => s.items[k] === 'installed');
  const d = driveOf(rules, installed);
  const c = s.systems.drive | 0;
  return { ...d, range: c <= 0 ? 0 : Math.trunc((d.range * (50 + (c >> 1))) / 100) };
}
export const sensorRange = (rules, s) => Math.trunc((num(rules.content.voyage, 'SensorRange') * (40 + Math.trunc((output(s, 'sensors') * 60) / 100))) / 100);

// Places within sensor range of the Forge become known (their type shows on the chart).
export function reveal(rules, s) {
  const g = galaxyOf(rules, s), here = g.points[s.at], r = sensorRange(rules, s), known = new Set(s.known);
  for (const p of g.points) if ((p.x - here.x) * (p.x - here.x) + (p.y - here.y) * (p.y - here.y) <= r * r) known.add(p.id);
  known.add(s.at);
  s.known = [...known].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- the day clock
// What the crew need each day, and how many days each store lasts at that rate.
export function needs(rules, s) {
  const V = rules.content.voyage, N = V.Need, n = count(s.crew);
  const per = (k) => Math.trunc((n * (+N[k] | 0) + 9) / 10);
  return { water: per('Water'), food: per('Food'), air: per('Air'), crew: n };
}
export function daysLeft(rules, s) {
  const n = needs(rules, s), f = forecast(rules, s);
  // water goes at the rate the crew and the systems use it when there is plenty
  const wet = JSON.parse(JSON.stringify(s));
  wet.stores.ice = 1e9;
  dayTick(rules, wet, { dry: true });
  const iceRate = wet.stores.ice - 1e9;
  const days = (have, net) => (net >= 0 ? Infinity : Math.trunc(have / -net));
  return { ice: days(s.stores.ice, iceRate), food: days(s.stores.food, f.food), air: days(s.stores.air, f.air), glim: days(s.stores.glim, -num(rules.content.voyage, 'ReactorGlim')), need: n, rate: { ice: iceRate, food: f.food, air: f.air } };
}

// The change in each store over one ordinary day (no work, no travel), without changing s.
export function forecast(rules, s) {
  const t = JSON.parse(JSON.stringify(s));
  dayTick(rules, t, { dry: true });
  const d = {};
  for (const k of Object.keys(s.stores)) d[k] = t.stores[k] - s.stores[k];
  return d;
}

// One day passes.
export function dayTick(rules, s, { rest = 0, dry = false } = {}) {
  if (s.over) return;
  const V = rules.content.voyage, st = s.stores, need = needs(rules, s);
  const out = {};
  // drink
  const drink = Math.min(st.ice, need.water);
  st.ice -= drink;
  const thirsty = drink < need.water;
  // life support: air from water, up to its output, to top the tank up after today's breathing
  const lifeMax = Math.trunc((num(V, 'AirPerDay') * output(s, 'life')) / 100);
  let air = Math.max(0, Math.min(lifeMax, num(V, 'AirTank') - st.air + need.air));
  const airWater = (a) => Math.trunc((a * num(V, 'WaterPerAir') + 99) / 100);
  if (airWater(air) > st.ice) air = Math.trunc((st.ice * 100) / Math.max(1, num(V, 'WaterPerAir')));
  st.ice -= airWater(air);
  // hydroponics: food from water, more with spores
  let food = Math.trunc((num(V, 'FoodPerDay') * output(s, 'hydro')) / 100);
  const foodWater = (f) => Math.trunc((f * num(V, 'WaterPerFood') + 99) / 100);
  if (foodWater(food) > st.ice) food = Math.trunc((st.ice * 100) / Math.max(1, num(V, 'WaterPerFood')));
  st.ice -= foodWater(food);
  if (food > 0 && st.spores >= num(V, 'SporesPerDay')) { st.spores -= num(V, 'SporesPerDay'); food += Math.trunc((num(V, 'SporeFood') * output(s, 'hydro')) / 100); }
  // eat and breathe
  st.food += food;
  const hungry = st.food < need.food;
  st.food = Math.max(0, st.food - need.food);
  const breathless = st.air + air < need.air;
  st.air = Math.max(0, Math.min(num(V, 'AirTank'), st.air + air - need.air));
  st.glim = Math.max(0, st.glim - num(V, 'ReactorGlim'));
  if (dry) return;

  // the consequences, rung by rung
  s.airless = breathless ? s.airless + 1 : 0;
  const crew = count(s.crew);
  if (hungry) { const k = Math.max(1, Math.trunc((crew * num(V, 'StarvePct')) / 100)); out.starved = sum(loseAny(s.crew, k)); note(s, `No food. ${out.starved} of the crew died.`, 'bad'); }
  if (breathless) { const k = Math.max(1, Math.trunc((count(s.crew) * num(V, 'SuffocatePct')) / 100)); out.suffocated = sum(loseAny(s.crew, k)); note(s, `The air ran out. ${out.suffocated} of the crew suffocated.`, 'bad'); }
  if (thirsty && !s.dry) note(s, 'The water is gone. Life support and the hydroponics have nothing to work with.', 'bad');
  s.dry = thirsty;

  // morale drifts toward how things are
  const low = (have, per) => have < per * num(V, 'LowDays');
  let target = num(V, 'MoraleTarget');
  for (const [have, per, outNow] of [[st.ice, need.water, thirsty], [st.food, need.food, hungry], [st.air, need.air, breathless]]) {
    if (outNow) target -= num(V, 'MoraleOut'); else if (low(have, per)) target -= num(V, 'MoraleLow');
  }
  target += rest * num(V, 'MoraleRest');
  if (out.starved || out.suffocated) target -= num(V, 'MoraleLow');
  target = Math.max(0, Math.min(100, target));
  s.morale = s.morale < target ? Math.min(target, s.morale + num(V, 'MoraleRise') * (1 + rest)) : Math.max(target, s.morale - num(V, 'MoraleFall'));
  if (s.morale < num(V, 'MoraleDesert') && count(s.crew) > 0) {
    const k = Math.max(1, Math.trunc((count(s.crew) * num(V, 'DesertPct')) / 100));
    const n = lose(s.crew, 'hands', k) || sum(loseAny(s.crew, k));
    note(s, `${n} of the crew took a pod and left in the night.`, 'bad');
  }

  if (count(s.crew) <= 0) end(s, 'crew', 'There is nobody left aboard the Forge.');
  else if (s.airless >= num(V, 'AirlessDays')) end(s, 'air', `${s.airless} days without air. The Forge goes quiet.`);
  else s.day++;
  return out;
}
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);

export function passDays(rules, s, n, opts) { for (let i = 0; i < n && !s.over; i++) dayTick(rules, s, opts); }

function end(s, reason, text) {
  if (s.over) return;
  s.over = { reason, day: s.day, text };
  note(s, text, 'end');
}

// ---------------------------------------------------------------- actions on the chart
// Each returns { ok, why } and changes s only when ok.
const no = (why) => ({ ok: false, why });

// A route from here to `to`, with what it costs, or why there is none.
export function plan(rules, s, to) {
  const g = galaxyOf(rules, s);
  if (to === s.at) return { ok: false, why: 'The Forge is here.' };
  const d = drive(rules, s);
  if (d.range <= 0) return no('The Skein Drive is wrecked. Repair it to stitch.');
  const r = route(g, rules, s.at, to, d);
  if (!r) {
    if (!d.veil && route(g, rules, s.at, to, { range: d.range, veil: true })) return no('The Veil is in the way: the drive cannot stitch through it yet.');
    const full = route(g, rules, s.at, to, { range: 1000, veil: true });
    if (!full) return no('No lane reaches it.');
    const need = full.lanes.map((li) => g.lanes[li]).filter((l) => !laneOpen(l, d)).reduce((m, l) => Math.min(m, l.len), Infinity);
    return no(!d.veil && full.lanes.some((li) => g.lanes[li].veil) && need > d.range ? `Out of the drive's reach, and behind the Veil: it needs a stitch of ${need} spans, and the drive can do ${d.range}.` : `Out of the drive's reach: it needs a stitch of ${need} spans, and the drive can do ${d.range}.`);
  }
  const f = forecast(rules, s);
  const arrive = { ...s.stores, glim: s.stores.glim - r.glim - r.days * num(rules.content.voyage, 'ReactorGlim'), ice: s.stores.ice + f.ice * r.days, food: Math.max(0, s.stores.food + f.food * r.days), air: Math.max(0, Math.min(num(rules.content.voyage, 'AirTank'), s.stores.air + f.air * r.days)) };
  return { ok: s.stores.glim >= r.glim, why: s.stores.glim >= r.glim ? '' : `Not enough Glim: the route needs ${r.glim} and the Forge has ${s.stores.glim}.`, route: r, arrive };
}

export function stitch(rules, s, to) {
  if (s.over) return no('The voyage is over.');
  const p = plan(rules, s, to);
  if (!p.ok) return p;
  const g = galaxyOf(rules, s), V = rules.content.voyage;
  for (let i = 0; i < p.route.hops.length; i++) {
    const l = g.lanes[p.route.lanes[i]];
    s.stores.glim -= stitchGlim(V, l.len);
    passDays(rules, s, stitchDays(V, l.len));
    if (s.over) return { ok: true };
    s.at = p.route.hops[i];
    reveal(rules, s);
  }
  note(s, `Stitched to ${g.points[s.at].name}: ${p.route.hops.length} stitch${p.route.hops.length > 1 ? 'es' : ''}, ${p.route.days} days, ${p.route.glim} Glim.`, 'travel');
  return { ok: true };
}

// Without Glim: drift to a neighbouring place at sub-light, along a lane the drive could use.
export function driftPlan(rules, s, to) {
  const g = galaxyOf(rules, s), d = drive(rules, s);
  const li = g.adj[s.at].find((i) => { const l = g.lanes[i]; return (l.a === to || l.b === to); });
  if (li === undefined) return no('Drifting only reaches places one lane away.');
  const l = g.lanes[li];
  if (!laneOpen(l, { range: Math.max(d.range, num(rules.content.voyage, 'BaseRange')), veil: d.veil })) return no('Too far to drift, or through the Veil.');
  return { ok: true, days: Math.max(2, Math.trunc((l.len * num(rules.content.voyage, 'DriftDaysPer10')) / 10)), lane: li };
}
export function drift(rules, s, to) {
  if (s.over) return no('The voyage is over.');
  const p = driftPlan(rules, s, to);
  if (!p.ok) return p;
  passDays(rules, s, p.days);
  if (s.over) return { ok: true };
  s.at = to;
  reveal(rules, s);
  note(s, `Drifted to ${galaxyOf(rules, s).points[to].name} at sub-light: ${p.days} days.`, 'travel');
  return { ok: true };
}

export function rest(rules, s) {
  if (s.over) return no('The voyage is over.');
  const still = galaxyOf(rules, s).points[s.at].type === 'StillWater';
  dayTick(rules, s, { rest: still ? 2 : 1 }); // a quiet place: twice the rest
  note(s, still ? 'A day of rest in still water.' : 'A day of rest.', 'info');
  return { ok: true };
}

// One day of repairs on a system (or 'hull'), as far as engineers and stores allow.
export function repairPlan(rules, s, sys) {
  const V = rules.content.voyage, eng = free(s.crew, 'engineers'), pct = workPct(rules, s);
  if (eng <= 0) return no('No engineers are free.');
  if (sys === 'hull') {
    const max = rules.actor('forge').traitInfo('Health').HP, missing = Math.trunc(((max - s.forge.hp) * 100) / max);
    if (missing <= 0) return no('The hull is sound.');
    let p = Math.max(1, Math.trunc((eng * num(V, 'HullPer10Engineers') * pct) / 1000));
    p = Math.min(p, missing, Math.trunc(s.stores.ore / Math.max(1, num(V, 'HullOre'))), Math.trunc(s.stores.salvage / Math.max(1, num(V, 'HullSalvage'))));
    if (p <= 0) return no('Not enough ore and salvage.');
    return { ok: true, points: p, ore: p * num(V, 'HullOre'), salvage: p * num(V, 'HullSalvage') };
  }
  const c = s.systems[sys];
  if (c === undefined) return no('No such system.');
  if (c >= 100) return no('It needs no repair.');
  let p = Math.max(1, Math.trunc((eng * num(V, 'RepairPer10Engineers') * pct) / 1000));
  p = Math.min(p, 100 - c, Math.trunc(s.stores.ore / Math.max(1, num(V, 'RepairOre'))), Math.trunc(s.stores.salvage / Math.max(1, num(V, 'RepairSalvage'))));
  if (p <= 0) return no('Not enough ore and salvage.');
  return { ok: true, points: p, ore: p * num(V, 'RepairOre'), salvage: p * num(V, 'RepairSalvage') };
}
export function repair(rules, s, sys) {
  if (s.over) return no('The voyage is over.');
  const p = repairPlan(rules, s, sys);
  if (!p.ok) return p;
  s.stores.ore -= p.ore; s.stores.salvage -= p.salvage;
  if (sys === 'hull') { const max = rules.actor('forge').traitInfo('Health').HP; s.forge.hp = Math.min(max, s.forge.hp + Math.trunc((max * p.points) / 100)); }
  else s.systems[sys] += p.points;
  dayTick(rules, s);
  const name = sys === 'hull' ? 'the hull' : rules.content.systems[sys].Name;
  note(s, `A day's repairs on ${name}: +${p.points}%.`, 'info');
  return { ok: true, points: p.points };
}

export function installPlan(rules, s, id) {
  const it = rules.content.items[id], I = it && it.Install;
  if (!it || s.items[id] !== 'found') return no(s.items[id] === 'installed' ? 'Already fitted.' : 'Not found yet.');
  if (s.stores.ore < +I.Ore || s.stores.salvage < +I.Salvage) return no(`Fitting it takes ${I.Ore} ore and ${I.Salvage} salvage.`);
  if (free(s.crew, 'engineers') < +I.Engineers) return no(`Fitting it takes ${I.Engineers} free engineers.`);
  return { ok: true, days: Math.max(1, Math.trunc((+I.Days * 100) / workPct(rules, s))), ore: +I.Ore, salvage: +I.Salvage };
}
export function install(rules, s, id) {
  if (s.over) return no('The voyage is over.');
  const p = installPlan(rules, s, id);
  if (!p.ok) return p;
  s.stores.ore -= p.ore; s.stores.salvage -= p.salvage;
  passDays(rules, s, p.days);
  if (s.over) return { ok: true };
  s.items[id] = 'installed';
  reveal(rules, s);
  note(s, `${rules.content.items[id].Name} fitted to the Skein Drive after ${p.days} days' work.`, 'story');
  signalNote(rules, s);
  if (!target(rules, s)) note(s, 'The drive is whole. From the Shore\'s edge, the Forge can make the long jump home.', 'story');
  return { ok: true };
}

export function canJumpHome(rules, s) {
  const g = galaxyOf(rules, s);
  if (!drive(rules, s).finalJump) return no('The drive has no Heartstone.');
  if (!g.points[s.at].edge) return no('The final jump goes from the Shore\'s edge.');
  if (s.systems.drive < 50) return no('The drive needs to be at least half mended for the final jump.');
  return { ok: true };
}
export function jumpHome(rules, s) {
  const c = canJumpHome(rules, s);
  if (!c.ok || s.over) return c.ok ? no('The voyage is over.') : c;
  s.over = { reason: 'home', day: s.day, text: 'The Skein pulls tight, and the Wrack falls away behind the Forge.' };
  s.won = true;
  note(s, s.over.text, 'end');
  return { ok: true };
}

// ---------------------------------------------------------------- the maps
// World settings for going in to the place the Forge is at.
export function visitSettings(rules, s) {
  const V = rules.content.voyage, g = galaxyOf(rules, s), p = g.points[s.at], R = rules.content.regions[p.region];
  const times = s.visited[p.id] | 0;
  const settings = generatePoi(rules, {
    seed: poiSeed(s.seed, p.id, times), type: p.type, visit: times,
    danger: +R.Danger || 1, name: p.name, ship: p.ship,
    richness: Math.max(num(V, 'RevisitFloor'), 100 - times * num(V, 'RevisitPct')),
    relic: p.relic && !s.items[p.relic] ? p.relic : '',
  });
  const stores = {};
  for (const k of mapKinds(rules)) stores[k] = s.stores[k] | 0;
  settings.voyage = { day: s.day, ticks: s.ticks, dayTicks: num(V, 'DayTicks'), place: p.id, region: R.Name, needs: needs(rules, s), stores: { ...s.stores }, forecast: { ...forecast(rules, s), ice: daysLeft(rules, s).rate.ice } };
  return {
    ...settings,
    latency: 1,
    players: [
      {
        name: 'You', faction: 'meridian', client: 0, ships: ['forge'], stores, hangar: s.fleet.map((e) => ({ ...e })), forgeHp: s.forge.hp,
        crew: freeAll(s.crew), buildSpeed: Math.trunc((output(s, 'foundry') * workPct(rules, s)) / 100),
        spoolPct: Math.max(100, Math.trunc(10000 / Math.max(1, 50 + (s.systems.drive >> 1)))),
      },
      { name: 'Ashen Gaunt', faction: 'gaunt', team: 1, ships: [] },
      { name: 'Drift fauna', faction: 'fauna', team: 2, ships: [] },
    ],
  };
}

// Back from a map: what the visit gained and cost becomes the voyage's, and the days spent
// there pass.
export function returnFromMap(rules, s, report) {
  const V = rules.content.voyage, g = galaxyOf(rules, s), p = g.points[s.at];
  for (const [k, st] of Object.entries(report.stores)) s.stores[k] = st.end;
  const maxHp = rules.actor('forge').traitInfo('Health').HP, hpBefore = s.forge.hp;
  s.forge.hp = report.forge ? report.forge.hp : 0;
  s.fleet = report.ships.aboard.map((e) => ({ type: e.type, hp: e.hp }));
  // crew lost with ships destroyed or left behind
  const lost = report.crew ? report.crew.lost : {};
  for (const r of ROLES) if (lost[r]) lose(s.crew, r, lost[r]);
  assignFleet(s.crew, rules, s.fleet);
  // hull damage wears the Forge's systems down
  const hullLost = Math.trunc(((hpBefore - s.forge.hp) * 100) / maxHp);
  if (hullLost > 0 && report.forge) {
    const rng = new Random(hashMix(hashMix(s.seed, s.visits), 77) || 1);
    let wear = hullLost * num(V, 'SystemWear');
    const hit = {};
    while (wear > 0) { const k = SYSTEMS[rng.int(SYSTEMS.length)], n = Math.min(wear, 3 + rng.int(6)); s.systems[k] = Math.max(0, s.systems[k] - n); hit[k] = (hit[k] || 0) + n; wear -= n; }
    note(s, `The hull took ${hullLost}% damage. Systems hit: ${Object.entries(hit).map(([k, n]) => `${rules.content.systems[k].Name} −${n}`).join(', ')}.`, 'bad');
  }
  // what was found
  for (const id of report.found || []) if (!s.items[id]) { s.items[id] = 'found'; note(s, `Found: the ${rules.content.items[id].Name}. It can be fitted to the drive from the Forge screen.`, 'story'); }
  // morale: losses hurt, a win helps
  const shipsLost = sum(report.ships.destroyed) + sum(report.ships.leftBehind);
  if (shipsLost) s.morale = Math.max(0, s.morale - Math.min(15, shipsLost * num(V, 'MoraleLoss')));
  if ((report.kills || 0) >= 3) s.morale = Math.min(100, s.morale + num(V, 'MoraleWin'));
  s.visited[p.id] = (s.visited[p.id] | 0) + 1;
  s.visits++;
  const lostCrew = sum(lost);
  note(s, `Left ${p.name} after ${(report.ticks / num(V, 'DayTicks')).toFixed(1)} days.${shipsLost ? ` ${shipsLost} ship${shipsLost > 1 ? 's' : ''} lost${lostCrew ? `, and ${lostCrew} crew` : ''}.` : ''}`, shipsLost ? 'bad' : 'info');
  if (!report.forge) { end(s, 'forge', `The Forge was destroyed at ${p.name}.`); return s; }
  // the days spent there
  s.ticks += report.ticks | 0;
  const days = Math.trunc(s.ticks / num(V, 'DayTicks'));
  s.ticks -= days * num(V, 'DayTicks');
  passDays(rules, s, days);
  reveal(rules, s);
  return s;
}

// ---------------------------------------------------------------- saving
export const SAVE_VERSION = 2;
export function saveVoyage(s) { return JSON.stringify(s); }
export function loadVoyage(rules, text) {
  const s = JSON.parse(text);
  if (!s || s.kind !== 'voyage' || s.version !== SAVE_VERSION) throw new Error('That save is from another version of Driftforge.');
  galaxyOf(rules, s);
  return s;
}
// A hash of the whole voyage state, for tests.
export function voyageHash(s) {
  const t = saveVoyage(s);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = hashMix(h, t.charCodeAt(i));
  return h >>> 0;
}
