import { Random } from '../engine/random.js';
import { hashMix, sin as SIN, cos as COS } from '../engine/math.js';
import { mapKinds, weights } from '../engine/content.js';
import { CELL } from '../engine/math.js';
import { standingOf, tierIndex, tierName, meet, change, hasLeave, factionsAtWar } from './standing.js';
import { activeTreaties, addTreaty, breakTreaties, reveal as revealPlaces, applyOnChart, crewHolds, deal as dealWith } from './comms.js';
import { trigger, eventContext } from './events.js';
import { generatePoi, poiSeed } from '../engine/poi.js';
import { generateGalaxy, driveOf, anyDrive, route, laneOpen, stitchGlim, stitchDays } from './galaxy.js';
import { lifeOf, lifeMix, remembers, markMemory, memoryOfBlueprint, givesOf, buildable } from './life.js';
import * as B from './base.js';
import * as Wd from './wound.js';
import { ROLES, makeRoster, count, free, loseAny, lose, loseFlying, kill, assignFleet, personById, officerOf, officerPct, officersIn, moraleMod, grow, mods, fullName, titleOf, traitOf, idle, newPerson, namesInUse } from './crew.js';

// The voyage: one life of a campaign on the galaxy map. Plain data (it saves as JSON) plus pure,
// deterministic functions that act on it. The campaign (what outlasts a death) rides along in
// s.campaign; newLife() starts the next life from it. The galaxy itself is not saved: it is rebuilt from
// the seed. Every action that takes time runs the day clock, and each day the crew drink,
// eat and breathe, the Forge's systems make what they can, and morale drifts.
//
//   seed, day, ticks (map play not yet a whole day), at (place id), known (place ids seen),
//   visited { id: times }, stores { every resource }, crew (crew.js roster), morale,
//   systems { drive, reactor, life, hydro, foundry, sensors: 0-100 }, forge { hp },
//   fleet [ { type, hp, xp, lead (a person's id: crew.js) } ], items { id: 'found' | 'installed' }, airless (days in a row),
//   over (null, or why it ended), log [ { day, text, kind } ],
//   campaign { life, chart { known, visited }, lives [ ... ], memorial [ ... ], standing, met, hints }

export const START_FLEET = ['halberd', 'dart', 'dart', 'gleaner', 'gleaner', 'shearer', 'skimmer'];
export const SYSTEMS = ['drive', 'reactor', 'life', 'hydro', 'foundry', 'sensors'];
const pairs = (v) => Object.fromEntries(String(v || '').split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p[0]).map(([k, n]) => [k, +n | 0]));
const num = (V, k) => +V[k] | 0;

const galaxies = new Map();
export function galaxyOf(rules, s) {
  const key = `${s.seed | 0}:${s.length === 'short' ? 's' : 'f'}`;
  if (!galaxies.has(key)) { galaxies.clear(); galaxies.set(key, generateGalaxy(rules, s.seed | 0, { short: s.length === 'short' })); }
  return galaxies.get(key);
}

// A campaign's record of what outlasts a death (PLAN.md §2): the life number, what the chart
// knows, how each life ended, everyone named who was lost, and standing with factions that
// remember Jacob across lives (Remembers: true in factions.yaml).
// Memories and echoes (PLAN.md §4) last for the whole campaign too, and so do clue circles and
// the echoes waiting where earlier lives ended.
export function newCampaign() {
  return { life: 1, chart: { known: [], visited: [], clues: [] }, lives: [], memorial: [], standing: {}, met: {}, hints: [], memories: {}, echoes: 0, echoAt: [] };
}

// A new campaign's first life, or (with `campaign`) a later life in the same galaxy.
// length: 'full' or 'short' (a smaller galaxy); guided: hint cards for a first campaign
export function newVoyage(rules, { seed = 1, length = 'full', guided = false, campaign = null } = {}) {
  const V = rules.content.voyage, g = galaxyOf(rules, { seed, length });
  const stores = Object.fromEntries(Object.keys(rules.content.resources).map((k) => [k, 0]));
  Object.assign(stores, pairs(V.Stores));
  if (length === 'short' && V.ShortStores) Object.assign(stores, pairs(V.ShortStores));
  const s = {
    version: SAVE_VERSION, kind: 'voyage', seed: seed | 0, length, saves: 'campaign', guided, hints: [...((campaign && campaign.hints) || [])],
    campaign: campaign || newCampaign(),
    day: 1, ticks: 0, at: g.start, known: [], visited: {},
    stores,
    crew: makeRoster(pairs(V.Crew), seed),
    morale: num(V, 'Morale'),
    systems: Object.fromEntries(SYSTEMS.map((k) => [k, 100])),
    forge: { hp: rules.actor('forge').traitInfo('Health').HP },
    fleet: START_FLEET.map((type) => ({ type, hp: rules.actor(type).traitInfo('Health').HP })),
    items: {}, airless: 0, dry: false, over: null, visits: 0,
    strain: { thirst: 0, hunger: 0, air: 0, cold: 0 }, cold: 0, strikes: [], allHands: { days: 0, best: 0 }, training: {},
    standing: {}, met: {}, treaties: [], flags: [], stock: {},
    queue: [], seen: [], ahead: [], rolls: 0,
    blueprints: [],
    log: [],
  };
  s.blueprints = buildable(rules, s); // the start list, and every hull remembered
  s.wound = Wd.newWound(rules, s); // the Mainspring's attention: near what the memories have earned
  s.crew.life = s.campaign.life; // the same people wake each life; the dice fall differently
  assignFleet(s.crew, rules, s.fleet, { day: 1, fresh: true });
  for (const e of s.fleet) e.hp = shipMaxHp(rules, e, s); // a lead's touch on the hull
  // what the chart remembers from earlier lives, and who remembers Jacob
  s.known = [...new Set([...s.campaign.chart.known, ...s.known])].sort((a, b) => a - b);
  for (const [fid, n] of Object.entries(s.campaign.standing)) if (rules.content.factions[fid]) { s.standing[fid] = n; if (s.campaign.met[fid]) s.met[fid] = true; }
  reveal(rules, s);
  if (s.campaign.life > 1) note(s, `Life ${s.campaign.life}. You wake on the bridge of the Forge at ${g.points[g.start].name}, in the Drift, and you know this moment. The chart still holds what you found before.`, 'story');
  else note(s, `You wake on the bridge of a ship, at a place the chart calls ${g.points[g.start].name}. Nobody aboard knows where that is, or how they got here.`, 'story');
  trigger(rules, s, g, 'start');
  clues(rules, s);
  return s;
}

// The drive part the engineers can get a fix on now: the first one not yet remembered.
// { id, at } (at: place id), or null when the drive is whole.
export function target(rules, s) {
  const g = galaxyOf(rules, s);
  for (const it of Object.values(rules.content.items)) {
    if (it.Kind !== 'drive' || remembers(s, it.id)) continue;
    return { id: it.id, at: g.components[it.id] ?? -1 };
  }
  return null;
}

// ---------------------------------------------------------------- clues (PLAN.md §2)
// A clue draws a circle on the chart round where an anchor (a story place, or a drive part's
// derelict) is: never centred on it, but always containing it. Another clue to the same place
// shrinks the circle. Close enough, the sensors pinpoint it, and from then on it is exact.
const clueList = (s) => (s.campaign.chart.clues ||= []);
export function addClue(rules, s, anchor) {
  const g = galaxyOf(rules, s), at = g.components[anchor];
  if (at === undefined) return null;
  const list = clueList(s), old = list.find((c) => c.id === anchor);
  if (old && old.exact) return old;
  const p = g.points[at], A = (rules.content.anchors || {})[anchor];
  // (the chart room and the signals officer draw new circles smaller)
  const r0 = old ? Math.max(20, Math.trunc((old.r * 55) / 100)) : Math.max(20, Math.trunc((+((A && A.Clue) || rules.content.voyage.ClueSpan || 90) * projectBonus(rules, s, 'CluePct')) / 100));
  const rng = new Random(hashMix(hashMix(s.seed | 0, at + 101), (old ? old.n : 0) + 7) || 1);
  const d = Math.trunc((r0 * (20 + rng.int(41))) / 100), ang = rng.int(1024);
  const c = { id: anchor, at, x: p.x + Math.trunc((COS(ang) * d) / 1024), y: p.y + Math.trunc((SIN(ang) * d) / 1024), r: r0, n: old ? old.n + 1 : 1, exact: false };
  if (old) Object.assign(old, c); else list.push(c);
  return c;
}
// Is a place inside a clue's circle?
export const inClue = (g, c, id) => { const p = g.points[id], dx = p.x - c.x, dy = p.y - c.y; return dx * dx + dy * dy <= c.r * c.r; };
// After moving or remembering: a new clue for the drive part the engineers can fix on (once
// the radar works), and clues pinpointed when the Forge comes close.
function clues(rules, s) {
  const g = galaxyOf(rules, s), t = target(rules, s);
  if (t && t.at >= 0 && remembers(s, 'radar') && !clueList(s).some((c) => c.id === t.id)) {
    addClue(rules, s, t.id);
    note(s, `The engineers have a fix on the ${rules.content.items[t.id].Name}: somewhere in ${rules.content.regions[g.points[t.at].region].Name}, inside the circle on the chart.`, 'story');
  }
  const here = g.points[s.at], near = Math.max(30, sensorRange(rules, s) >> 1), decode = B.skillSum(rules, s, 'Decode');
  for (const c of clueList(s)) {
    if (c.exact) continue;
    // signal decoding: a scrap of an old signal tightens the circle
    if (decode && (hashMix(hashMix(lifeMix(s, s.seed | 0), s.day | 0), c.at + 0xdec0) >>> 0) % 100 < decode && !c.decoded) { c.decoded = s.day; addClue(rules, s, c.id); note(s, 'The signals officer pieces together a scrap of an old signal. A circle on the chart tightens.', 'story'); }
    const p = g.points[c.at], dx = p.x - here.x, dy = p.y - here.y;
    if (s.at === c.at || (remembers(s, 'radar') && dx * dx + dy * dy <= near * near)) {
      c.exact = true;
      if (!s.known.includes(c.at)) { s.known.push(c.at); s.known.sort((a, b) => a - b); }
      note(s, `The watch officer pinpoints it: the ${p.name}.`, 'story');
    }
  }
}

// ---------------------------------------------------------------- memories (PLAN.md §4)
// Remember something: it stays for the whole campaign. What it gives takes effect at once.
export function remember(rules, s, id, { quiet = false } = {}) {
  const M = rules.content.memories[id];
  if (!M || !markMemory(s, id)) return false;
  for (const [op, arg] of givesOf(M)) {
    if (op === 'radar') reveal(rules, s);
    else if (op === 'hull' && !s.blueprints.includes(arg)) s.blueprints.push(arg);
    else if (op === 'echoes') s.campaign.echoes = (s.campaign.echoes | 0) + (+arg | 0);
  }
  if (M.Echoes) s.campaign.echoes = (s.campaign.echoes | 0) + (+M.Echoes | 0);
  if (!quiet) note(s, `Remembered: ${M.Name}.${M.Echoes ? ` (+${M.Echoes} echo${+M.Echoes > 1 ? 'es' : ''})` : ''}`, 'memory');
  // the more Jacob remembers, the louder the Twain sings
  if (s.wound) Wd.raise(rules, s, +(rules.content.wound || {}).Memory | 0, note);
  return true;
}
// Everything waiting at an anchor comes back (cutting into its hulk).
export function recover(rules, s, anchor) {
  if (isCache(anchor)) { openCache(rules, s, anchor); return []; }
  const got = [];
  for (const m of Object.values(rules.content.memories)) if (m.Found === anchor && m.Ready !== 'false' && remember(rules, s, m.id)) got.push(m.id);
  if (got.length) { trigger(rules, s, galaxyOf(rules, s), 'found', { item: got.find((x) => rules.content.memories[x].Kind === 'knowledge') || got[0] }); clues(rules, s); }
  return got;
}
// A pocket's cache (galaxy.js): opened once in the whole campaign, for echoes.
const isCache = (id) => /^cache-/.test(String(id || ''));
function openCache(rules, s, id) {
  const caches = (s.campaign.caches ||= {});
  if (caches[id]) return 0;
  const n = num(rules.content.voyage, 'CacheEchoes') || 2;
  caches[id] = { life: lifeOf(s), day: s.day | 0 };
  s.campaign.echoes = (s.campaign.echoes | 0) + n;
  note(s, `Inside the strongbox: letters in your own hand, that you don't remember writing. +${n} echoes.`, 'memory');
  return n;
}
// Recalling a memory on the Loom with echoes: { ok, why, cost }.
export function recallPlan(rules, s, id) {
  const M = rules.content.memories[id];
  if (!M) return no('No such memory.');
  if (remembers(s, id)) return no('Already remembered.');
  if (M.Ready === 'false') return no('Not yet.');
  if (M.Seen && !(s.campaign.hazards || []).includes(M.Seen)) return no(`Not yet: it comes back once the ${rules.content.hazards[M.Seen].Name} turn the Forge away.`);
  if (M.Cost === undefined) return no(M.Found ? 'It waits somewhere out there.' : M.Blueprint ? 'Cut up a wreck of one, or buy its plans.' : 'It cannot be recalled.');
  const need = String(M.Needs || '').split(',').map((x) => x.trim()).filter(Boolean).filter((n) => !remembers(s, n));
  if (need.length) return no(`First remember: ${need.map((n) => rules.content.memories[n].Name).join(', ')}.`);
  if ((s.campaign.echoes | 0) < +M.Cost) return no(`It takes ${M.Cost} echo${+M.Cost > 1 ? 'es' : ''}; you have ${s.campaign.echoes | 0}.`);
  return { ok: true, cost: +M.Cost };
}
export function recall(rules, s, id) {
  const p = recallPlan(rules, s, id);
  if (!p.ok) return p;
  s.campaign.echoes -= p.cost;
  remember(rules, s, id);
  return { ok: true };
}

export function note(s, text, kind = 'info') { s.log.push({ day: s.day, text, kind }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); }

// ---------------------------------------------------------------- the Forge
// Rooms built on the deck plan and the officers' work: percent bonuses multiply (FoodPct,
// SensorPct, GlimPct, HullPct, BuildPct, RepairPct, TradePct, CarePct, XpPct, ...); Capacity
// and Heal add (rooms only).
const ADDITIVE = ['Capacity', 'Heal'];
export function projectBonus(rules, s, key) {
  let v = ADDITIVE.includes(key) ? 0 : 100;
  for (const [id, st] of Object.entries(s.items)) {
    const it = rules.content.items[id];
    if (st !== 'installed' || !it || it.Kind !== 'room' || it[key] === undefined) continue;
    v = ADDITIVE.includes(key) ? v + (+it[key] | 0) : Math.trunc((v * +it[key]) / 100);
  }
  // the officers, at their stations' levels, and the stations' trained skills (base.js)
  if (!ADDITIVE.includes(key) && s.crew.people) v = Math.trunc((Math.trunc((v * B.officerPctAt(rules, s, key)) / 100) * B.skillPct(rules, s, key)) / 100);
  return v;
}
// A ship's lead and what they bring to it now (null if it has none)
export function leadOf(rules, s, e) {
  const p = e.lead && personById(s.crew, e.lead);
  if (!p) return null;
  const m = mods(rules, p, crewHolds(rules, s)), t = traitOf(rules, p);
  return { id: p.id, name: p.name, role: p.role, title: titleOf(rules, p), trait: p.trait, traitName: t.Name, text: t.Text || '', damage: m.damage, hull: m.hull, learn: m.learn, escape: t.Escape ? 1 : 0, kills: p.kills | 0 };
}
// A ship's level (1 to Levels) from its level points (Milestone 19: one for each map it
// launched on, survived and came home from)
export function levelOf(rules, e) { const V = rules.content.voyage; return 1 + Math.max(0, Math.min((+V.Levels || 5) - 1, Math.trunc((e.xp | 0) / (+V.LevelPoints || 100)))); }
// A ship's full hull at its level, and with its lead's touch when `s` is given
export function shipMaxHp(rules, e, s = null) {
  const V = rules.content.voyage, r = levelOf(rules, e) - 1;
  const lead = s ? leadOf(rules, s, e) : null;
  return Math.trunc((rules.actor(e.type).traitInfo('Health').HP * Math.max(10, 100 + (V.RankBonus === undefined ? 5 : +V.RankBonus) * r + (lead ? lead.hull : 0))) / 100);
}
export function rankName(rules, xp) { return `Level ${levelOf(rules, { xp })}`; }
export const forgeMaxHp = (rules, s) => Math.trunc((rules.actor('forge').traitInfo('Health').HP * projectBonus(rules, s, 'HullPct')) / 100);
// The Glim a stitch of `len` spans burns: the recycler and the navigator, then the crew's mood,
// strain, All hands and a dark navigation station (base.js). `pct`: that last part, if known.
export const stitchCost = (rules, s, len, pct = B.glimPctOf(rules, s), pb = projectBonus(rules, s, 'GlimPct')) => Math.trunc((Math.trunc((stitchGlim(rules.content.voyage, len) * pb + 99) / 100) * pct + 99) / 100);
// Days a stitch takes: a navigator trained in quick stitching takes a day off the long ones (3+)
export const stitchTime = (rules, s, len, quick = B.skillSum(rules, s, 'QuickStitch')) => { const d = stitchDays(rules.content.voyage, len, s.length === 'short'); return d >= 3 ? Math.max(1, d - quick) : d; };

// A system's working output in percent: its condition, slowed by a damaged reactor.
export function output(s, sys) {
  let c = s.systems[sys] | 0;
  if (s.cold && sys !== 'reactor') c = Math.trunc((c * s.cold) / 100); // the boilers are out
  return sys === 'reactor' ? c : Math.trunc((c * (50 + (s.systems.reactor >> 1))) / 100);
}
// Work speed in percent (low morale slows it).
// (the crew's mood, strain and All hands: base.js)
export function workPct(rules, s) { return B.workPctOf(rules, s); }

// The drive as it is now: components fitted, and its condition (half range at worst; none at 0).
export function drive(rules, s) {
  const installed = Object.values(rules.content.items).filter((it) => it.Kind === 'drive' && remembers(s, it.id)).map((it) => it.id);
  const d = driveOf(rules, installed);
  const c = s.systems.drive | 0, hazards = hazardsOpen(rules, s), here = galaxyOf(rules, s).points[s.at];
  // already inside a pocket (a save from before pockets): she got in, so she can get out
  if (here && here.pocket && !hazards.includes(here.pocket)) hazards.push(here.pocket);
  return { ...d, hazards, range: c <= 0 ? 0 : Math.trunc((d.range * (50 + (c >> 1))) / 100) };
}
// The hazards the Forge can go through: those a remembered memory opens (Gives: open <hazard>)
export const hazardsOpen = (rules, s) => Object.values(rules.content.memories).filter((m) => remembers(s, m.id)).flatMap((m) => givesOf(m).filter(([op]) => op === 'open').map(([, h]) => h));
export const sensorRange = (rules, s) => Math.trunc((Math.trunc((num(rules.content.voyage, 'SensorRange') * projectBonus(rules, s, 'SensorPct')) / 100) * (40 + Math.trunc((output(s, 'sensors') * 60) / 100))) / 100);

// Places within sensor range of the Forge become known (their type shows on the chart).
// Until the radar is remembered the chart is dark: only the places one lane away are known.
export function reveal(rules, s) {
  const g = galaxyOf(rules, s), here = g.points[s.at], known = new Set(s.known);
  if ((remembers(s, 'radar') || !rules.content.memories.radar) && !B.stationDown(rules, s, 'sensors')) {
    const r = sensorRange(rules, s);
    for (const p of g.points) if ((p.x - here.x) * (p.x - here.x) + (p.y - here.y) * (p.y - here.y) <= r * r) known.add(p.id);
  } else for (const li of g.adj[s.at]) { const l = g.lanes[li]; known.add(l.a === s.at ? l.b : l.a); }
  known.add(s.at);
  s.known = [...known].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- the day clock
// What the crew need each day, and how many days each store lasts at that rate.
export function needs(rules, s) {
  const V = rules.content.voyage, N = V.Need, n = count(s.crew);
  const per = (k) => Math.trunc((n * (+N[k] | 0) + 9) / 10);
  // the still room and recyclers win water back; a ration plan saves food and air
  const ration = (x) => Math.trunc((x * B.skillPct(rules, s, 'NeedPct') + 99) / 100);
  return { water: Math.trunc((per('Water') * B.roomPct(rules, s, 'WaterPct') + 99) / 100), food: ration(per('Food')), air: ration(per('Air')), crew: n };
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
export function dayTick(rules, s, { rest = 0, dry = false, transit = false } = {}) {
  if (s.over) return;
  const V = rules.content.voyage, st = s.stores, need = needs(rules, s);
  const out = {};
  // drink
  const drink = Math.min(st.ice, need.water);
  st.ice -= drink;
  const thirsty = drink < need.water;
  // life support: air from water, up to its output, to top the tank up after today's breathing
  // (none while its station is dark)
  const lifeMax = B.stationDown(rules, s, 'lifesupport') ? 0 : Math.trunc((num(V, 'AirPerDay') * output(s, 'life')) / 100);
  let air = Math.max(0, Math.min(lifeMax, num(V, 'AirTank') - st.air + need.air));
  const airWater = (a) => Math.trunc((a * num(V, 'WaterPerAir') + 99) / 100);
  if (airWater(air) > st.ice) air = Math.trunc((st.ice * 100) / Math.max(1, num(V, 'WaterPerAir')));
  st.ice -= airWater(air);
  // hydroponics: food from water, more with spores
  let food = Math.trunc((Math.trunc((num(V, 'FoodPerDay') * projectBonus(rules, s, 'FoodPct')) / 100) * output(s, 'hydro')) / 100);
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
  // the boilers burn Glim; with none to burn they go cold, and every system works at ColdPct
  const draw = num(V, 'ReactorGlim'), cold = st.glim < draw, wasCold = !!s.cold;
  st.glim = Math.max(0, st.glim - draw);
  s.cold = cold ? num(V, 'ColdPct') || 50 : 0;
  if (dry) return;
  // ships aboard mend (more with repair bays)
  const heal = num(V, 'FleetHeal') + projectBonus(rules, s, 'Heal');
  for (const e of s.fleet) { const max = shipMaxHp(rules, e, s); e.hp = Math.min(max, (e.hp | 0) + Math.trunc((max * heal) / 100)); }

  // shortages strain the crew; they never kill (PLAN.md §6, base.js)
  s.airless = breathless ? s.airless + 1 : 0;
  B.dayStrain(rules, s, { thirst: thirsty, hunger: hungry, air: breathless, cold });
  if (thirsty && !s.dry) note(s, 'The water is gone. Life support and the hydroponics have nothing to work with.', 'bad');
  s.dry = thirsty;
  if (cold && !wasCold) note(s, 'The boilers are out of Glim and going cold. Every system works at half, and the crew start to shiver.', 'bad');
  if (!cold && wasCold) note(s, 'The boilers are lit again.', 'good');

  // morale drifts toward how things are
  const Mo = rules.content.mood || {}, low = (have, per) => have < per * num(V, 'LowDays');
  let target = num(V, 'MoraleTarget');
  for (const [have, per, outNow] of [[st.ice, need.water, thirsty], [st.food, need.food, hungry], [st.air, need.air, breathless]]) {
    if (outNow) target -= num(V, 'MoraleOut'); else if (low(have, per)) target -= num(V, 'MoraleLow');
  }
  if (cold) target -= num(V, 'MoraleLow');
  target += rest * num(V, 'MoraleRest');
  target += moraleMod(rules, s.crew, crewHolds(rules, s)); // who is aboard
  target += B.roomSum(rules, s, 'MoraleUp'); // the mess hall
  if (count(s.crew) > B.berths(rules, s)) target -= num(Mo, 'Crowded'); // sleeping in the corridors
  target = Math.max(0, Math.min(100, target));
  // (All hands: morale doesn't fall overnight)
  s.morale = s.morale < target ? Math.min(target, s.morale + num(V, 'MoraleRise') * (1 + rest)) : B.allHandsOn(rules, s) ? s.morale : Math.max(target, s.morale - num(V, 'MoraleFall'));
  // under Strike, a station's crew walk off; back over Back
  B.dayStrikes(rules, s);
  // people grow into their traits, and whoever is gone is replaced
  for (const t of grow(rules, s.crew, s.day + 1)) note(s, t, 'info'); // as the next day begins
  for (const t of assignFleet(s.crew, rules, s.fleet, { day: s.day })) note(s, t, 'info');
  // every station green: All hands (a long streak earns a crew moment)
  if (B.dayAllHands(rules, s)) trigger(rules, s, galaxyOf(rules, s), 'allhands');
  // the Wound: attention, and the Hands moving (wound.js)
  Wd.woundDay(rules, s, galaxyOf(rules, s), { transit, note });

  if (count(s.crew) <= 0) end(s, 'crew', 'There is nobody left aboard the Forge.');
  else s.day++;
  return out;
}
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
// " Among them: Chief engineer Ada Voss and Pilot Kit Rask." for the named lost since `from`
function among(rules, s, from) {
  const f = s.crew.fallen.slice(from).map((p) => fullName(rules, p));
  return f.length ? ` Among them: ${f.length > 1 ? `${f.slice(0, -1).join(', ')} and ${f[f.length - 1]}` : f[0]}.` : '';
}
export { among };

export function passDays(rules, s, n, opts) { for (let i = 0; i < n && !s.over; i++) dayTick(rules, s, opts); }

function end(s, reason, text) {
  if (s.over) return;
  s.over = { reason, day: s.day, text };
  note(s, text, 'end');
}

// ---------------------------------------------------------------- lives
// Giving up a life on purpose: it counts as a death.
export function letGo(rules, s) {
  if (s.over) return no('This life is already over.');
  end(s, 'letgo', 'You let go. The bridge goes quiet, and then it goes dark.');
  return { ok: true };
}
export const lifeOver = (s) => !!s.over && !s.won;

// The next life, after a death: the same galaxy and the same crew, from the moment of waking.
// The chart keeps what it knew and where you went; the memorial keeps everyone named who was
// lost; factions that remember Jacob (the Choir) keep their standing. Everything else resets.
export function newLife(rules, prev) {
  const c = JSON.parse(JSON.stringify(prev.campaign || newCampaign()));
  const union = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y);
  c.lives.push({ life: c.life, days: prev.day, reason: prev.over ? prev.over.reason : 'letgo', text: prev.over ? prev.over.text : '', visits: prev.visits | 0, lost: (prev.crew.fallen || []).length });
  // where this life ended, an echo waits for a later one (the three most recent)
  c.echoAt = [...(c.echoAt || []), { place: prev.at, life: c.life, n: 1 + Math.min(2, Math.trunc(prev.day / 40)) }].slice(-3);
  c.chart.known = union(c.chart.known, prev.known);
  c.chart.visited = union(c.chart.visited, Object.keys(prev.visited).map(Number));
  for (const f of prev.crew.fallen || []) c.memorial.push({ ...f, life: c.life });
  for (const f of Object.values(rules.content.factions)) {
    if (f.Remembers !== 'true' || !prev.met[f.id]) continue;
    c.standing[f.id] = standingOf(rules, prev, f.id); c.met[f.id] = true;
  }
  c.hints = [...(prev.hints || [])];
  c.life++;
  return newVoyage(rules, { seed: prev.seed, length: prev.length, guided: prev.guided, campaign: c });
}
// Visited in an earlier life (the chart marks these)
export { remembers };
export const visitedBefore = (s, id) => !!s.campaign && s.campaign.chart.visited.includes(id);

// ---------------------------------------------------------------- actions on the chart
// Each returns { ok, why } and changes s only when ok.
const no = (why) => ({ ok: false, why });

// A route from here to `to`, with what it costs, or why there is none.
export function plan(rules, s, to) {
  const g = galaxyOf(rules, s);
  if (to === s.at) return { ok: false, why: 'The Forge is here.' };
  if (s.muster) return no('Settle the muster first: more ships than the hangar berths.');
  const d = drive(rules, s);
  if (d.range <= 0) return no('The Skein Drive is wrecked. Repair it to stitch.');
  const r = route(g, rules, s.at, to, d), gp = B.glimPctOf(rules, s), pb = projectBonus(rules, s, 'GlimPct'), quick = B.skillSum(rules, s, 'QuickStitch');
  if (r) { r.glim = r.lanes.reduce((t, li) => t + stitchCost(rules, s, g.lanes[li].len, gp, pb), 0); if (quick) r.days = r.lanes.reduce((t, li) => t + stitchTime(rules, s, g.lanes[li].len, quick), 0); }
  if (!r) {
    // in the way, in this order: a hazard (the officer at its post says why), the Veil, the
    // drive's reach (the navigator says those)
    const all = anyDrive(rules), past = route(g, rules, s.at, to, { ...d, hazards: all.hazards });
    if (past) {
      const H = rules.content.hazards[past.lanes.map((li) => g.lanes[li].hazard).find((h) => h && !d.hazards.includes(h))];
      return { ok: false, hazard: H.id, why: `${reporter(rules, s, H.Report)}: "${H.Say}" Closed until you remember ${rules.content.memories[H.Opens].Name}.` };
    }
    const nav = (text) => no(`${reporter(rules, s, 'navigator')}: "${text}"`);
    if (!d.veil && route(g, rules, s.at, to, { ...d, veil: true, hazards: all.hazards })) return nav('The Veil is in the way. The drive can\'t stitch through it yet.');
    const full = route(g, rules, s.at, to, all);
    if (!full) return no('No lane reaches it.');
    const need = full.lanes.map((li) => g.lanes[li]).filter((l) => l.len > d.range).reduce((m, l) => Math.min(m, l.len), Infinity);
    return nav(!d.veil && full.lanes.some((li) => g.lanes[li].veil) ? `Out of reach, and behind the Veil. It needs a stitch of ${need} spans, and the drive can do ${d.range}.` : `Out of reach. It needs a stitch of ${need} spans, and the drive can do ${d.range}.`);
  }
  const f = forecast(rules, s);
  const arrive = { ...s.stores, glim: s.stores.glim - r.glim - r.days * num(rules.content.voyage, 'ReactorGlim'), ice: s.stores.ice + f.ice * r.days, food: Math.max(0, s.stores.food + f.food * r.days), air: Math.max(0, Math.min(num(rules.content.voyage, 'AirTank'), s.stores.air + f.air * r.days)) };
  return { ok: s.stores.glim >= r.glim, why: s.stores.glim >= r.glim ? '' : `Not enough Glim: the route needs ${r.glim} and the Forge has ${s.stores.glim}.`, route: r, arrive };
}

export function stitch(rules, s, to) {
  if (s.over) return no('The voyage is over.');
  const p = plan(rules, s, to);
  if (!p.ok) { if (p.hazard) turnedAway(rules, s, to); return p; }
  const g = galaxyOf(rules, s), V = rules.content.voyage;
  // a Hand has the Forge here: tearing free costs
  if (Wd.caughtBy(rules, s)) Wd.escape(rules, s, SYSTEMS, note);
  for (let i = 0; i < p.route.hops.length; i++) {
    const l = g.lanes[p.route.lanes[i]];
    s.stores.glim = Math.max(0, s.stores.glim - stitchCost(rules, s, l.len));
    passDays(rules, s, stitchTime(rules, s, l.len), { transit: true });
    if (s.over) return { ok: true };
    s.at = p.route.hops[i];
    reveal(rules, s);
  }
  note(s, `Stitched to ${g.points[s.at].name}: ${p.route.hops.length} stitch${p.route.hops.length > 1 ? 'es' : ''}, ${p.route.days} days, ${p.route.glim} Glim.`, 'travel');
  arrived(rules, s, true, p.route.lanes);
  return { ok: true };
}

// Who speaks for a post: its officer; if it is vacant, whoever is acting in it (a named member
// of its crew not leading a ship); failing that, its crew. 'Chief engineer Ada Vos'
export function reporter(rules, s, post) {
  const P = rules.content.crew.posts[post];
  if (!P) return 'The crew';
  const o = officerOf(s.crew, post);
  if (o) return `${P.Name} ${o.name}`;
  const a = idle(s.crew, s.fleet, P.Role)[0];
  return a ? `Acting ${P.Name.toLowerCase()} ${a.name}` : `The ${P.Role}`;
}
// Trying for a place a hazard keeps closed: the Forge is turned away, and from then on (in every
// life) the memory that opens it can be recalled on the Loom. Returns the hazard, or ''.
export function turnedAway(rules, s, to) {
  const p = plan(rules, s, to);
  if (!p.hazard) return '';
  const seen = (s.campaign.hazards ||= []), H = rules.content.hazards[p.hazard];
  if (!seen.includes(H.id)) {
    seen.push(H.id);
    note(s, `Turned away by the ${H.Name}. ${p.why.replace(/ Closed until.*$/, '')} Something about ${rules.content.memories[H.Opens].Name.toLowerCase()} is coming back: it can be recalled on the Loom.`, 'memory');
    trigger(rules, s, galaxyOf(rules, s), 'hazard', { item: H.id });
  }
  return H.id;
}

// Without Glim: drift to a neighbouring place at sub-light, along a lane the drive could use.
export function driftPlan(rules, s, to) {
  const g = galaxyOf(rules, s), d = drive(rules, s);
  if (s.muster) return no('Settle the muster first: more ships than the hangar berths.');
  const li = g.adj[s.at].find((i) => { const l = g.lanes[i]; return (l.a === to || l.b === to); });
  if (li === undefined) return no('Drifting only reaches places one lane away.');
  const l = g.lanes[li];
  if (l.hazard && !d.hazards.includes(l.hazard)) { const H = rules.content.hazards[l.hazard]; return no(`${reporter(rules, s, H.Report)}: "${H.Say}" Closed until you remember ${rules.content.memories[H.Opens].Name}.`); }
  if (!laneOpen(l, { ...d, range: Math.max(d.range, num(rules.content.voyage, 'BaseRange')) })) return no('Too far to drift, or through the Veil.');
  return { ok: true, days: Math.max(2, Math.trunc((l.len * num(rules.content.voyage, 'DriftDaysPer10')) / 10)), lane: li };
}
export function drift(rules, s, to) {
  if (s.over) return no('The voyage is over.');
  const p = driftPlan(rules, s, to);
  if (!p.ok) return p;
  if (Wd.caughtBy(rules, s)) Wd.escape(rules, s, SYSTEMS, note);
  passDays(rules, s, p.days, { transit: true });
  if (s.over) return { ok: true };
  s.at = to;
  reveal(rules, s);
  note(s, `Drifted to ${galaxyOf(rules, s).points[to].name} at sub-light: ${p.days} days.`, 'travel');
  arrived(rules, s, false, [p.lane]);
  return { ok: true };
}

// Arriving somewhere: whatever was waiting at the last place is gone, and events may happen.
function arrived(rules, s, stitched, lanes = []) {
  const g = galaxyOf(rules, s);
  s.ahead = (s.ahead || []).filter((a) => a.at === s.at);
  // heard here (unless running silent); a Hand already here has caught the Forge
  Wd.woundArrive(rules, s, g, { lanes, note });
  // where an earlier life ended, its echo waits
  const c = s.campaign, waiting = (c.echoAt || []).filter((e) => e.place === s.at);
  if (waiting.length) {
    const n = waiting.reduce((t, e) => t + (e.n | 0), 0);
    c.echoes = (c.echoes | 0) + n;
    c.echoAt = c.echoAt.filter((e) => e.place !== s.at);
    note(s, `Something here feels like a memory of a memory. You died here, in life ${waiting.map((e) => e.life).join(' and ')}. +${n} echo${n > 1 ? 'es' : ''}.`, 'memory');
  }
  if (stitched) trigger(rules, s, g, 'travel');
  trigger(rules, s, g, 'arrive');
  clues(rules, s);
}

// An event's choice, on the star chart: its effects on the voyage (time passing, drive parts
// found). Returns what the panel needs: { close, goto, notes }.
export function eventChoice(rules, s, effects) {
  const g = galaxyOf(rules, s), ev = rules.content.events[(s.queue || [])[0]];
  const r = applyOnChart(rules, s, g, null, effects, { how: ev ? `lost: ${ev.Title}` : 'lost' });
  if (r.days) passDays(rules, s, r.days);
  if (r.clue) addClue(rules, s, r.clue);
  if (r.found) { s.blueprints = buildable(rules, s); if (remembers(s, 'radar')) reveal(rules, s); trigger(rules, s, g, 'found', { item: r.found }); }
  clues(rules, s);
  return r;
}
export { eventContext };

// A blueprint: a hull you can now build.
// A blueprint found or bought: the hull's memory comes back, for good.
export function learn(rules, s, id) {
  const it = rules.content.items[id];
  if (!it || it.Kind !== 'blueprint') return false;
  const m = memoryOfBlueprint(rules, id);
  if (m) { if (!remember(rules, s, m.id, { quiet: true })) return false; }
  else { s.blueprints ||= []; if (s.blueprints.includes(it.Unlocks)) return false; s.blueprints.push(it.Unlocks); }
  note(s, `Remembered: the ${rules.actor(it.Unlocks).traitInfo('Tooltip').Name}. The foundry can build them now, in every life.`, 'memory');
  return true;
}

// A day spent with every sensor turned outward: places within twice the sensor range become known.
export function scanPlan(rules, s) {
  const glim = Math.trunc((num(rules.content.voyage, 'ScanGlim') * B.skillPct(rules, s, 'ScanPct')) / 100);
  if (s.stores.glim < glim) return no(`Scanning takes ${glim} Glim.`);
  if (s.systems.sensors <= 0) return no('The sensors are wrecked.');
  if (!remembers(s, 'radar')) return no('The sensors are dark. Nobody remembers how to work the long watch.');
  if (B.stationDown(rules, s, 'sensors')) return no('The sensors station is dark: nobody at the long watch.');
  return { ok: true, glim, range: sensorRange(rules, s) * 2 };
}
export function scan(rules, s) {
  if (s.over) return no('The voyage is over.');
  const p = scanPlan(rules, s);
  if (!p.ok) return p;
  s.stores.glim -= p.glim;
  const g = galaxyOf(rules, s), here = g.points[s.at], known = new Set(s.known);
  let n = 0;
  for (const q of g.points) if (!known.has(q.id) && (q.x - here.x) * (q.x - here.x) + (q.y - here.y) * (q.y - here.y) <= p.range * p.range) { known.add(q.id); n++; }
  s.known = [...known].sort((a, b) => a - b);
  dayTick(rules, s);
  note(s, `A day's deep scan: ${n} places newly known.`, 'info');
  return { ok: true, found: n };
}

export function rest(rules, s) {
  if (s.over) return no('The voyage is over.');
  const still = galaxyOf(rules, s).points[s.at].type === 'StillWater';
  dayTick(rules, s, { rest: still ? 2 : 1 }); // a quiet place: twice the rest
  trigger(rules, s, galaxyOf(rules, s), 'day');
  note(s, still ? 'A day of rest in still water.' : 'A day of rest.', 'info');
  return { ok: true };
}

// One day of repairs on a system (or 'hull'), as far as engineers and stores allow.
export function repairPlan(rules, s, sys) {
  const V = rules.content.voyage, eng = free(s.crew, 'engineers'), pct = workPct(rules, s);
  if (eng <= 0) return no('No engineers are free.');
  if (B.stationDown(rules, s, 'engineering')) return no('Engineering is dark: nobody to run the repair crews.');
  // the workshop saves ore and salvage
  const cost = (n) => Math.max(1, Math.trunc((n * B.roomPct(rules, s, 'RepairCostPct')) / 100));
  const crewPct = projectBonus(rules, s, 'RepairPct'); // the chief engineer
  if (sys === 'hull') {
    const max = forgeMaxHp(rules, s), missing = Math.trunc(((max - s.forge.hp) * 100) / max);
    if (missing <= 0) return no('The hull is sound.');
    let p = Math.max(1, Math.trunc((Math.trunc((eng * num(V, 'HullPer10Engineers') * pct) / 1000) * crewPct) / 100));
    p = Math.min(p, missing, Math.trunc(s.stores.ore / cost(num(V, 'HullOre'))), Math.trunc(s.stores.salvage / cost(num(V, 'HullSalvage'))));
    if (p <= 0) return no('Not enough ore and salvage.');
    return { ok: true, points: p, ore: p * cost(num(V, 'HullOre')), salvage: p * cost(num(V, 'HullSalvage')) };
  }
  const c = s.systems[sys];
  if (c === undefined) return no('No such system.');
  if (c >= 100) return no('It needs no repair.');
  let p = Math.max(1, Math.trunc((Math.trunc((eng * num(V, 'RepairPer10Engineers') * pct) / 1000) * crewPct) / 100));
  p = Math.min(p, 100 - c, Math.trunc(s.stores.ore / cost(num(V, 'RepairOre'))), Math.trunc(s.stores.salvage / cost(num(V, 'RepairSalvage'))));
  if (p <= 0) return no('Not enough ore and salvage.');
  return { ok: true, points: p, ore: p * cost(num(V, 'RepairOre')), salvage: p * cost(num(V, 'RepairSalvage')) };
}
export function repair(rules, s, sys) {
  if (s.over) return no('The voyage is over.');
  const p = repairPlan(rules, s, sys);
  if (!p.ok) return p;
  s.stores.ore -= p.ore; s.stores.salvage -= p.salvage;
  if (sys === 'hull') { const max = forgeMaxHp(rules, s); s.forge.hp = Math.min(max, s.forge.hp + Math.trunc((max * p.points) / 100)); }
  else s.systems[sys] += p.points;
  dayTick(rules, s);
  const name = sys === 'hull' ? 'the hull' : rules.content.systems[sys].Name;
  note(s, `A day's repairs on ${name}: +${p.points}%.`, 'info');
  return { ok: true, points: p.points };
}

// ---------------------------------------------------------------- the deck plan
// Building a room (items.yaml, Kind room): a free slot, its memory if it needs one, ore and
// salvage (dearer when the crew are unhappy or strained), free engineers, and days of work.
export function installPlan(rules, s, id) {
  const it = rules.content.items[id], I = it && it.Install;
  if (!it || !I) return no('That cannot be built.');
  if (it.Kind === 'drive') return no('Drive parts are remembered, not fitted.');
  if (it.Kind !== 'room') return no('That cannot be built.');
  if (B.built(s, id)) return no('Already built.');
  if (!B.roomKnown(rules, s, id)) return no(`Nobody remembers how. Recall the ${B.roomMemory(rules, id).Name.toLowerCase()} on the Loom.`);
  if (it.Plan && !s.items[it.Plan]) { const T = Object.values(rules.content.traders || {}).find((x) => String(x.Unique || '').includes(it.Plan)); return no(`It needs the ${rules.content.items[it.Plan].Name.toLowerCase()}${T ? `, from ${T.Name}` : ''}.`); }
  if (it.Requires && !B.built(s, it.Requires)) return no(`Build the ${rules.content.items[it.Requires]?.Name || it.Requires} first.`);
  const slots = B.slotsOf(rules, it), left = B.deckSlots(rules) - B.slotsUsed(rules, s);
  if (slots > left) return no(left ? `It needs ${slots} slots on the deck plan, and ${left} are free.` : 'The deck plan is full. Strip a room to make space.');
  if (B.stationDown(rules, s, 'engineering')) return no('Engineering is dark: nobody to build it.');
  const pct = B.costPctOf(rules, s);
  const ore = Math.trunc((+I.Ore * pct) / 100), salvage = Math.trunc((+I.Salvage * pct) / 100);
  if (s.stores.ore < ore || s.stores.salvage < salvage) return no(`Building it takes ${ore} ore and ${salvage} salvage.`);
  if (free(s.crew, 'engineers') < +I.Engineers) return no(`Building it takes ${I.Engineers} free engineers.`);
  return { ok: true, days: Math.max(1, Math.trunc((+I.Days * 100) / workPct(rules, s))), ore, salvage, slots };
}
// Stripping a room out frees its slots: a day's work, and nothing comes back.
export function stripPlan(rules, s, id) {
  const it = rules.content.items[id];
  if (!it || it.Kind !== 'room' || !B.built(s, id)) return no('There is no such room aboard.');
  const on = B.rooms(rules).find((r) => r.Requires === id && B.built(s, r.id));
  if (on) return no(`Strip the ${on.Name.toLowerCase()} first: it is built on this.`);
  return { ok: true, days: 1 };
}
export function strip(rules, s, id) {
  if (s.over) return no('The voyage is over.');
  const p = stripPlan(rules, s, id);
  if (!p.ok) return p;
  const it = rules.content.items[id];
  delete s.items[id];
  if (it.HullPct) s.forge.hp = Math.max(1, Math.trunc((s.forge.hp * 100) / +it.HullPct));
  passDays(rules, s, p.days);
  note(s, `${it.Name} stripped out to make space on the deck plan.`, 'info');
  return { ok: true };
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
  if (rules.content.items[id].Kind === 'room') {
    if (rules.content.items[id].HullPct) s.forge.hp = Math.trunc((s.forge.hp * +rules.content.items[id].HullPct) / 100);
    note(s, `${rules.content.items[id].Name} built after ${p.days} days' work.`, 'good');
    return { ok: true };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- the muster (PLAN.md §7)
// The hangar berths HangarBerths ships between maps (hangar rooms add Bays). When more come
// aboard, you choose who continues: each one left over is scrapped (ScrapPct of its ore back,
// its crew move into the Forge, its lead stands by) or left adrift (the ship and everyone
// aboard are lost). Nothing stitches until the muster is settled.
export const berthsOf = (rules, s) => num(rules.content.voyage, 'HangarBerths') + B.roomSum(rules, s, 'Bays');
export function musterPlan(rules, s, fate) {
  if (!s.muster) return no('There is no muster.');
  const keep = s.fleet.filter((_, i) => !fate[i] || fate[i] === 'keep').length, berths = berthsOf(rules, s);
  if (keep > berths) return no(`${keep} ships to keep, and berths for ${berths}: scrap or leave ${keep - berths} more.`);
  let ore = 0;
  s.fleet.forEach((e, i) => { if (fate[i] === 'scrap') ore += Math.trunc((num(rules.actor(e.type).traitInfo('Valued'), 'Cost') * num(rules.content.voyage, 'ScrapPct')) / 100); });
  return { ok: true, keep, ore };
}
export function muster(rules, s, fate) {
  const p = musterPlan(rules, s, fate);
  if (!p.ok) return p;
  const c = s.crew, kept = [], notes = [];
  s.fleet.forEach((e, i) => {
    const f = fate[i] || 'keep', name = shipName(rules, e.type), lead = e.lead && personById(c, e.lead);
    if (f === 'keep') { kept.push(e); return; }
    const k = rules.actor(e.type).traitInfo('Crew');
    if (f === 'scrap') notes.push(`The ${name} is scrapped${lead ? `; ${fullName(rules, lead)} stands by` : ''}.`);
    else {
      // left adrift: its crew are lost with it, its lead among them
      if (lead) kill(c, lead.id, { day: s.day, how: `left adrift with the ${name}` });
      if (k && k.Count) { const n = Math.max(0, k.Count - (lead ? 1 : 0)); c.roles[k.Role] = Math.max(0, (c.roles[k.Role] | 0) - n); }
      notes.push(`The ${name} is left adrift${k && k.Count ? `, with ${k.Count} aboard${lead ? `, ${fullName(rules, lead)} among them` : ''}` : ''}.`);
    }
  });
  s.fleet = kept;
  s.stores.ore += p.ore;
  delete s.muster;
  for (const t of assignFleet(c, rules, s.fleet, { day: s.day })) notes.push(t);
  note(s, `The muster: ${kept.length} ships continue. ${notes.join(' ')}${p.ore ? ` Scrap: +${p.ore} ore.` : ''}`, 'info');
  return { ok: true };
}
// Perks: a ship's pilot picks one at each perk level reached (PerkLevels), from three on offer.
const perkLevels = (rules) => String(rules.content.voyage.PerkLevels || '3, 5').split(',').map((x) => +x.trim()).filter(Boolean);
export function perksDue(rules, e) { const lv = levelOf(rules, e); return perkLevels(rules).filter((n) => lv >= n).length; }
function offerPerks(rules, s) {
  const P = Object.keys(rules.content.crew.perks || {});
  s.fleet.forEach((e, i) => {
    e.perks ||= [];
    if (e.offer || !e.lead || e.perks.length >= perksDue(rules, e)) return;
    const pool = P.filter((id) => !e.perks.includes(id));
    const start = (hashMix(hashMix(s.seed | 0, e.lead | 0), e.perks.length + 1) >>> 0) % Math.max(1, pool.length);
    e.offer = [0, 1, 2].map((k) => pool[(start + k) % pool.length]).filter((x, k, a) => x && a.indexOf(x) === k);
    note(s, `The ${shipName(rules, e.type)} is ${rankName(rules, e.xp)} now: ${fullName(rules, personById(s.crew, e.lead))} picks a perk.`, 'good');
  });
}
export function choosePerk(rules, s, i, perk) {
  const e = s.fleet[i];
  if (!e || !e.offer || !e.offer.includes(perk)) return no('That perk is not on offer.');
  e.perks = [...(e.perks || []), perk];
  delete e.offer;
  note(s, `${fullName(rules, personById(s.crew, e.lead))} of the ${shipName(rules, e.type)}: ${rules.content.crew.perks[perk].Name.toLowerCase()}.`, 'good');
  return { ok: true };
}

// ---------------------------------------------------------------- traders and wayhouses (PLAN.md §8)
// The trader at the Forge's place (its id), or ''.
export const traderAt = (rules, s) => galaxyOf(rules, s).points[s.at].trader || '';
// Trading with a regional trader: their faction's standing, their own stock; a clue draws a circle
// round the next drive part, a chart shows the whole region.
export function traderDeal(rules, s, buy, sell) {
  const id = traderAt(rules, s), T = rules.content.traders[id];
  if (!T) return no('There is no trader here.');
  const r = dealWith(rules, s, T.Faction, s.at, buy, sell, id);
  if (!r.ok) return r;
  const g = galaxyOf(rules, s);
  for (let k = 0; k < ((r.specials && r.specials.clue) | 0); k++) { const t = target(rules, s); if (t && t.at >= 0) { addClue(rules, s, t.id); note(s, `${T.Name}: a clue to the ${rules.content.items[t.id].Name}. A circle on the chart.`, 'story'); } }
  if (r.specials && r.specials.chart) note(s, revealPlaces(rules, s, g, 'chart'), 'info');
  note(s, `Traded at ${T.Name}.`, 'info');
  return r;
}
// Places with nothing to go in for: traders and wayhouses are dealt with from the chart.
export function canGoIn(rules, s) { const p = galaxyOf(rules, s).points[s.at]; return p.trader || p.wayhouse ? no(p.trader ? 'There is nothing to go in for: trade from here.' : 'There is nothing to go in for: the drifters come to you.') : s.muster ? no('Settle the muster first.') : { ok: true }; }
// Drifters at a wayhouse ask to come aboard: once a life at each. Some have names: someone for
// an empty post, or a pilot looking for a ship. They need berths.
export function driftersPlan(rules, s) {
  const p = galaxyOf(rules, s).points[s.at], V = rules.content.voyage;
  if (!p.wayhouse) return no('There is no wayhouse here.');
  if ((s.wayhouses || []).includes(p.id)) return no('The drifters here have already come aboard, or gone their own way.');
  const [lo, hi] = String(V.Drifters || '4-10').split('-').map(Number);
  const h = hashMix(hashMix(lifeMix(s, s.seed | 0), p.id + 0x3a9), 7) >>> 0;
  const want = lo + (h % Math.max(1, (hi || lo) - lo + 1)), room = B.berths(rules, s) - count(s.crew);
  if (room <= 0) return no(`${want} drifters ask to come aboard, and there are no berths for them. Build crew quarters.`);
  return { ok: true, n: Math.min(want, room), want, named: (h >>> 8) % 100 < num(V, 'NamedPct') };
}
export function takeDrifters(rules, s) {
  if (s.over) return no('The voyage is over.');
  const p = driftersPlan(rules, s);
  if (!p.ok) return p;
  const g = galaxyOf(rules, s), c = s.crew, pl = g.points[s.at];
  (s.wayhouses ||= []).push(s.at);
  const roles = ['hands', 'miners', 'hands', 'engineers', 'hands', 'pilots'], got = {};
  for (let k = 0; k < p.n; k++) { const r = roles[(hashMix(s.seed | 0, s.at * 31 + k) >>> 0) % roles.length]; c.roles[r] = (c.roles[r] | 0) + 1; got[r] = (got[r] | 0) + 1; }
  let named = '';
  if (p.named) {
    // someone for an empty post, or else a pilot looking for a ship
    const post = Object.values(rules.content.crew.posts).find((x) => !officerOf(c, x.id));
    const role = post ? post.Role : 'pilots', q = newPerson(rules, c, c.next++, role, { day: s.day, taken: namesInUse(c), lead: !post });
    if (post) q.post = post.id;
    c.people.push(q); c.roles[role] = (c.roles[role] | 0) + 1;
    named = ` Among them, ${q.name} (${traitOf(rules, q).Name.toLowerCase()}), ${post ? `who takes the empty post of ${post.Name.toLowerCase()}` : 'a pilot looking for a ship'}.`;
  }
  for (const t of assignFleet(c, rules, s.fleet, { day: s.day })) note(s, t, 'info');
  passDays(rules, s, 1);
  note(s, `${Object.values(got).reduce((a, b) => a + b, 0) + (p.named ? 1 : 0)} drifters at ${pl.name} come aboard: ${Object.entries(got).map(([r, n]) => `${n} ${r}`).join(', ')}.${named}${p.n < p.want ? ` (${p.want - p.n} more had to stay: no berths.)` : ''}`, 'good');
  return { ok: true };
}

// A parley with the strikers (base.js): a day's talking, or paying them in cogmarks.
export function parleyPlan(rules, s, how = 'day') { return B.parleyPlan(rules, s, how); }
export function parley(rules, s, how = 'day') {
  if (s.over) return no('The voyage is over.');
  const p = B.parleyPlan(rules, s, how);
  if (!p.ok) return p;
  const names = s.strikes.map((id) => rules.content.crew.stations[id].Name).join(', ');
  s.stores.cogmarks -= p.cogmarks;
  s.strikes = [];
  s.morale = Math.min(100, s.morale + num(rules.content.mood, 'ParleyMorale'));
  if (p.days) passDays(rules, s, p.days);
  note(s, how === 'pay' ? `You pay the strikers ${p.cogmarks} cogmarks, and ${names} go back to work.` : `A day of talking on the bridge. ${names} go back to work, for now.`, 'info');
  return { ok: true };
}
// Can anyone be hailed? (Comms is dark under bad air and on strike.) `at`: a place other than the
// Forge's, which long-range hails reach when it is that many lanes away (HailReach).
export function canHail(rules, s, at = s.at) {
  if (B.stationDown(rules, s, 'comms')) return no('Comms is dark: nobody at the set to hail them.');
  if (at === s.at) return { ok: true };
  const g = galaxyOf(rules, s), reach = B.skillSum(rules, s, 'HailReach');
  if (!reach) return no('Only the place the Forge is at can be hailed. Long-range hails need a trained comms station.');
  const near = g.adj[s.at].some((li) => { const l = g.lanes[li]; return (l.a === s.at ? l.b : l.a) === at; });
  return near ? { ok: true, far: true } : no('Long-range hails reach one lane away.');
}

// Training a station (the bridge): to its next level for this life, with cogmarks and days.
export function trainPlan(rules, s, id) { return B.trainPlan(rules, s, id); }
export function train(rules, s, id) {
  if (s.over) return no('The voyage is over.');
  const p = B.trainPlan(rules, s, id);
  if (!p.ok) return p;
  s.stores.cogmarks -= p.cogmarks;
  s.training ||= {};
  s.training[id] = (s.training[id] | 0) + 1;
  passDays(rules, s, p.days);
  const st = rules.content.crew.stations[id], sk = rules.content.crew.skills[String(st.Train || '').split(',').map((x) => x.trim())[p.level - 2]];
  note(s, `${st.Name} trained to level ${p.level}${sk ? `: ${sk.Name.toLowerCase()}` : ''}. ${p.cheaper ? 'Jacob remembers how to teach it.' : ''}`.trim(), 'good');
  return { ok: true, level: p.level };
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
  trigger(rules, s, galaxyOf(rules, s), 'home');
  return { ok: true };
}

// ---------------------------------------------------------------- the named crew, for the screens
const LABEL = { RepairPct: 'repairs', BuildPct: 'build speed', FoodPct: 'food grown', GlimPct: 'Glim a stitch', SensorPct: 'sensor range', TradePct: 'prices you pay', CarePct: 'what strain costs', XpPct: 'experience earned' };
const pc = (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
// What a trait does for this person, in words: ['repairs +10%', 'morale +3'], and whether it
// holds now (When). `post`: their post, or null for a ship's lead.
function effects(rules, p, post, holds) {
  const t = traitOf(rules, p), m = mods(rules, p, () => true), out = [];
  if (post && m.work) out.push(`${LABEL[post.Bonus] || post.Bonus} ${pc(post.Less === 'true' ? -m.work : m.work)}`);
  if (!post) { if (m.damage) out.push(`damage ${pc(m.damage)}`); if (m.hull) out.push(`hull ${pc(m.hull)}`); if (m.learn) out.push(`experience ${pc(m.learn)}`); if (t.Escape) out.push('gets out once'); }
  if (m.morale) out.push(`morale ${m.morale > 0 ? '+' : '−'}${Math.abs(m.morale)}`);
  return { list: out, active: !t.When || holds(t.When), when: t.When || '' };
}
export function crewView(rules, s) {
  const c = s.crew, C = rules.content.crew, holds = crewHolds(rules, s);
  const person = (p, post) => { const t = traitOf(rules, p), e = effects(rules, p, post, holds); return { id: p.id, name: p.name, title: titleOf(rules, p), trait: t.Name, text: t.Text || '', effects: e.list, active: e.active, when: e.when, since: p.joined | 0, kills: p.kills | 0 }; };
  const officers = Object.values(C.posts).map((post) => { const o = c.people.find((p) => p.post === post.id); return o ? { post: post.Name, duty: post.Text || '', ...person(o, post) } : { post: post.Name, duty: post.Text || '', vacant: true, role: post.Role }; });
  const ships = s.fleet.map((e) => { const p = e.lead && personById(c, e.lead); return { type: e.type, ship: rules.actor(e.type).traitInfo('Tooltip').Name, xp: e.xp | 0, level: levelOf(rules, e), rank: rankName(rules, e.xp), perks: (e.perks || []).map((k) => rules.content.crew.perks[k]?.Name || k), offer: !!e.offer, hp: Math.trunc(((e.hp | 0) * 100) / shipMaxHp(rules, e, s)), lead: p ? person(p, null) : null }; });
  const standing = c.people.filter((p) => !p.post && !s.fleet.some((e) => e.lead === p.id)).map((p) => person(p, null));
  const fallen = [...c.fallen].reverse().map((f) => ({ name: f.name, title: titleOf(rules, f), trait: traitOf(rules, f).Name, day: f.day, how: f.how, kills: f.kills | 0 }));
  return { officers, ships, standing, fallen };
}

// ---------------------------------------------------------------- the maps
// An anchor (a story place, or a drive part's derelict) is done when every memory waiting
// there is remembered; until then its hulk still holds something.
const waitingAt = (rules, anchor) => Object.values(rules.content.memories).filter((m) => m.Found === anchor && m.Ready !== 'false');
export const anchorDone = (rules, s, anchor) => { if (isCache(anchor)) return !!(s.campaign && s.campaign.caches && s.campaign.caches[anchor]); const w = waitingAt(rules, anchor); return w.length ? w.every((m) => remembers(s, m.id)) : !!(s.items && s.items[anchor]); };
const relicName = (rules, anchor) => { if (isCache(anchor)) return 'a strongbox with your own mark on it'; const A = (rules.content.anchors || {})[anchor]; return A ? A.Relic || A.Name : anchor && rules.content.items[anchor] ? `the ${rules.content.items[anchor].Name}` : ''; };

// World settings for going in to the place the Forge is at.
export function visitSettings(rules, s) {
  const V = rules.content.voyage, g = galaxyOf(rules, s), p = g.points[s.at], R = rules.content.regions[p.region];
  const times = s.visited[p.id] | 0;
  const settings = generatePoi(rules, {
    seed: lifeMix(s, poiSeed(s.seed, p.id, times)), type: p.type, visit: times,
    danger: +R.Danger || 1, name: p.name, ship: p.ship,
    // places in a hazard pocket are richer (PocketRichness)
    richness: Math.trunc((Math.max(num(V, 'RevisitFloor'), 100 - times * num(V, 'RevisitPct')) * (p.pocket ? num(V, 'PocketRichness') || 150 : 100)) / 100),
    relic: p.relic && !anchorDone(rules, s, p.relic) ? p.relic : '', relicName: relicName(rules, p.relic),
  });
  const stores = {};
  for (const k of mapKinds(rules)) stores[k] = s.stores[k] | 0;
  // who is here: the place's owner (its patrol, and its station), the template's encounters,
  // and now and then a faction's fleet passing through a place nobody claims
  const F = rules.content.factions, L = settings.layout, present = new Set();
  const prng = new Random(hashMix(lifeMix(s, poiSeed(s.seed, p.id, times)), 991) || 1);
  const W = settings.space.w * CELL, D = settings.space.d * CELL;
  const patrol = (fid, at, behaviour, delay) => {
    const base = String(F[fid].Patrol || '').split(',').map((x) => x.trim()).filter(Boolean), ships = [];
    for (let k = 0; k < Math.trunc((base.length * (2 + (+R.Danger || 1))) / 3); k++) ships.push(base[k % base.length]);
    if (ships.length) L.encounters.push({ side: fid, ships, at, behaviour, delay });
  };
  // a ceasefire, peace or tribute treaty keeps a hostile faction's guns cold
  const truce = (fid) => activeTreaties(s, fid).some((k) => k !== 'Leave');
  const tierOf = (fid) => tierIndex(rules, standingOf(rules, s, fid));
  const mood = (fid) => (tierOf(fid) === 0 && !truce(fid) ? 'hunt' : tierOf(fid) === 4 ? 'escort' : 'lurk');
  if (p.owner && F[p.owner]) {
    present.add(p.owner);
    if (L.station) L.station.owner = p.owner;
    const c = L.station ? L.station.at : [W >> 1, D >> 1, 0];
    // the home patrol holds near the station, and hunts only if they are at war with you
    patrol(p.owner, [c[0] + 6 * CELL, c[1] - 6 * CELL, c[2]], tierOf(p.owner) === 0 ? 'lurk' : mood(p.owner), 250);
  } else {
    for (const f of Object.values(F)) {
      const wgt = weights(f.Regions).find(([r]) => r === p.region);
      if (!wgt || prng.int(100) >= wgt[1] * 5) continue;
      present.add(f.id);
      patrol(f.id, [Math.trunc((W * (55 + prng.int(30))) / 100), Math.trunc((D * (15 + prng.int(70))) / 100), 0], mood(f.id), (60 + prng.int(60)) * 25);
      break;
    }
  }
  for (const a of s.ahead || []) {
    if (a.at !== p.id) continue;
    const c = [Math.trunc((W * (60 + prng.int(25))) / 100), Math.trunc((D * (20 + prng.int(60))) / 100), 0];
    const at = a.behaviour === 'burrow' && settings.fields.length ? settings.fields[prng.int(settings.fields.length)].at.map((v) => v * CELL) : c;
    L.encounters.push({ side: a.side, ships: [...a.ships], at, behaviour: a.behaviour || 'hunt', delay: (a.delay | 0) * 25 });
  }
  // the Wound: a Hand that has caught the Forge, an infested place, a roaming pack (wound.js)
  const wound = Wd.mapWound(rules, s, g, p.id);
  if (wound) for (const e of wound.encounters) {
    const at = e.behaviour === 'hand' ? [Math.trunc((W * 88) / 100), Math.trunc((D * (30 + prng.int(40))) / 100), 0] : [Math.trunc((W * (60 + prng.int(25))) / 100), Math.trunc((D * (20 + prng.int(60))) / 100), 0];
    L.encounters.push({ side: 'wound', ships: [...e.ships], at, behaviour: e.behaviour, delay: (e.delay | 0) * 25 });
  }
  for (const e of L.encounters) if (F[e.side]) present.add(e.side);
  const factions = [...present].sort();
  settings.poi.owner = p.owner || '';
  settings.poi.ownerName = p.owner && F[p.owner] ? F[p.owner].Name : '';
  settings.poi.leave = p.owner ? hasLeave(rules, s, p.owner) || activeTreaties(s, p.owner).includes('Leave') : true;
  settings.poi.treaties = Object.fromEntries(factions.map((fid) => [fid, activeTreaties(s, fid)]));
  settings.poi.danger = +R.Danger || 1;
  settings.poi.wound = wound ? { hand: wound.hand, infested: wound.infested, roam: wound.roam } : null;
  const { leads, recruits } = mapCrew(rules, s);
  const crewMood = B.moodOf(rules, s);
  settings.voyage = { mood: crewMood.mark, causes: crewMood.causes.map((c) => c.text), allHands: B.allHandsOn(rules, s), strain: { ...B.strainOf(s) }, commsDark: B.stationDown(rules, s, 'comms'), life: lifeOf(s), flags: [...(s.flags || [])], day: s.day, ticks: s.ticks, dayTicks: num(V, 'DayTicks'), place: p.id, region: R.Name, needs: needs(rules, s), stores: { ...s.stores }, forecast: { ...forecast(rules, s), ice: daysLeft(rules, s).rate.ice } };
  return {
    ...settings,
    latency: 1,
    fog: true,
    players: [
      {
        name: 'You', faction: 'meridian', client: 0, ships: ['forge'], stores, hangar: s.fleet.map((e) => ({ ...e })), forgeHp: s.forge.hp,
        crew: Object.fromEntries(ROLES.map((r) => [r, free(s.crew, r) - officersIn(s.crew, r).length])), leads, recruits,
        // a dark foundry builds nothing, a dark hangar launches at half speed; the crew's mood
        // and strain change what ships cost and how well they do (base.js)
        xpPct: projectBonus(rules, s, 'XpPct'), buildSpeed: B.stationDown(rules, s, 'foundry') ? 0 : Math.trunc((Math.trunc((output(s, 'foundry') * workPct(rules, s)) / 100) * projectBonus(rules, s, 'BuildPct')) / 100),
        forgeDamagePct: projectBonus(rules, s, 'ForgeDamagePct'), launchPct: projectBonus(rules, s, 'LaunchPct') * (B.stationDown(rules, s, 'hangar') ? 2 : 1),
        costPct: B.costPctOf(rules, s), shipPct: B.shipPctOf(rules, s),
        blueprints: [...(s.blueprints || [])], capacityBonus: projectBonus(rules, s, 'Capacity'), sensorPct: Math.trunc((projectBonus(rules, s, 'SensorPct') * (wound ? wound.haze : 100)) / 100), forgeHpPct: projectBonus(rules, s, 'HullPct'),
        spoolPct: Math.max(100, Math.trunc(10000 / Math.max(1, 50 + (s.systems.drive >> 1)))),
      },
      ...factions.map((fid, i) => ({ name: F[fid].Name, faction: fid, team: i + 1, ships: [], tier: tierOf(fid), standing: standingOf(rules, s, fid) })),
      { name: 'Drift fauna', faction: 'fauna', team: factions.length + 1, ships: [] },
      ...(wound ? [{ name: 'The Wound', faction: 'wound', team: factions.length + 2, ships: [], ...wound.slot }] : []),
    ],
    relations: relationsFor(rules, factions, (fid) => (truce(fid) && tierOf(fid) === 0 ? 1 : tierOf(fid)), !!wound),
  };
}

// The named crew a map needs: the leads of the ships aboard, and for ships built there, who
// would lead them (named leads with no ship first, then new people, decided now so the
// simulation stays deterministic). Officers stay aboard the Forge.
const RECRUITS = 6;
export function mapCrew(rules, s) {
  const c = s.crew, leads = {}, recruits = {}, taken = namesInUse(c);
  // the visit a save from before named crew was made in: replay it as it was played
  const plain = s.plainVisit === s.visits;
  const strip = (l) => (plain ? { ...l, damage: 0, hull: 0, learn: 0, escape: 0 } : l);
  for (const e of s.fleet) { const l = leadOf(rules, s, e); if (l) leads[l.id] = strip(l); }
  const roles = Object.keys(rules.content.crew?.leads || {}).filter((r) => ROLES.includes(r));
  for (const r of roles) {
    const list = idle(c, s.fleet, r).map((p) => strip(leadOf(rules, s, { lead: p.id })));
    for (let i = 0; i < RECRUITS; i++) {
      const p = newPerson(rules, c, c.next + i * ROLES.length + ROLES.indexOf(r), r, { lead: true, day: s.day, taken });
      taken.add(p.name);
      const t = traitOf(rules, p), m = mods(rules, p, crewHolds(rules, s));
      list.push(strip({ id: p.id, name: p.name, role: r, title: titleOf(rules, p), trait: p.trait, traitName: t.Name, text: t.Text || '', damage: m.damage, hull: m.hull, learn: m.learn, escape: t.Escape ? 1 : 0, kills: 0, fresh: 1 }));
    }
    recruits[r] = list;
  }
  return { leads, recruits };
}

// Who fights whom on a map: you and each faction by your standing (Hostile: enemies, Allied:
// allies, the rest neutral); factions by their own feuds; monsters against everyone.
// The Wound (when it is there) is everyone's enemy, and pays the fauna no mind.
function relationsFor(rules, factions, tierOf, wound = false) {
  const out = [], fauna = factions.length + 1, demons = factions.length + 2;
  factions.forEach((fid, i) => {
    const t = tierOf(fid);
    out.push([0, i + 1, t === 0 ? 'enemy' : t === 4 ? 'ally' : 'neutral']);
    factions.forEach((gid, j) => { if (j > i) out.push([i + 1, j + 1, factionsAtWar(rules, fid, gid) ? 'enemy' : 'neutral']); });
    out.push([i + 1, fauna, 'enemy']);
    if (wound) out.push([i + 1, demons, 'enemy']);
  });
  out.push([0, fauna, 'enemy']);
  if (wound) out.push([0, demons, 'enemy'], [fauna, demons, 'neutral']);
  return out;
}

// Back from a map: what the visit gained and cost becomes the voyage's, and the days spent
// there pass.
export function returnFromMap(rules, s, report) {
  const V = rules.content.voyage, g = galaxyOf(rules, s), p = g.points[s.at];
  for (const [k, st] of Object.entries(report.stores)) s.stores[k] = st.end;
  // the Shearers find loose cogmarks in the wrecks they cut
  // (tight holds bring a little more home)
  const cargo = B.skillPct(rules, s, 'CargoPct');
  if (cargo > 100) for (const [k, st] of Object.entries(report.stores)) { const got = (st.changes && st.changes.gathered) | 0; if (got > 0) s.stores[k] += Math.trunc((got * (cargo - 100)) / 100); }
  const cut = (report.stores.salvage && report.stores.salvage.changes && report.stores.salvage.changes.gathered) | 0, cogs = Math.trunc((Math.trunc(cut / Math.max(1, num(rules.content.voyage, 'SalvagePerCogmark') || 20)) * B.skillPct(rules, s, 'SalvageCogPct')) / 100);
  if (cogs > 0) { s.stores.cogmarks = (s.stores.cogmarks | 0) + cogs; note(s, `The Shearers found ${cogs} cogmarks in the wrecks.`, 'good'); }
  const maxHp = forgeMaxHp(rules, s), hpBefore = s.forge.hp;
  s.forge.hp = report.forge ? report.forge.hp : 0;
  // the named: new leads of ships built there join; leads who got out of a lost ship come back
  // shaken; leads lost with their ships, or left behind, are gone
  const C = report.crew || {}, c = s.crew, lost = { ...(C.lost || {}) };
  for (const l of C.recruited || []) {
    if (personById(c, l.id) || c.fallen.some((f) => f.id === l.id)) continue;
    c.people.push({ id: l.id, name: l.name, role: l.role, post: '', trait: l.trait, traitDay: s.day, joined: s.day, kills: 0 });
    c.next = Math.max(c.next, l.id + 1);
  }
  for (const l of C.leadsSaved || []) {
    const q = personById(c, l.id), t = q && traitOf(rules, q);
    if (!q) continue;
    q.kills = (q.kills | 0) + (l.kills | 0);
    if (t.Escape && rules.content.crew.traits[t.Escape]) { q.trait = t.Escape; q.traitDay = s.day; }
    note(s, `${fullName(rules, q)} got out in a pod when the ${shipName(rules, l.type)} was lost. ${traitOf(rules, q).Name} now.`, 'info');
  }
  const kills = {};
  for (const e of report.ships.aboard) if (e.lead && e.kills) kills[e.lead] = (kills[e.lead] | 0) + e.kills;
  // triage: the infirmary's rescue crews pull some of them out alive
  const triage = B.skillSum(rules, s, 'Triage');
  for (const l of C.leadsLost || []) {
    const q = personById(c, l.id);
    if (!q) continue;
    if (triage && l.how !== 'left' && (hashMix(hashMix(s.seed | 0, q.id), s.visits | 0) >>> 0) % 100 < triage) {
      q.kills = (q.kills | 0) + (l.kills | 0);
      if (rules.content.crew.traits.shaken) { q.trait = 'shaken'; q.traitDay = s.day; }
      note(s, `The rescue crew pulled ${fullName(rules, q)} out of the wreck of the ${shipName(rules, l.type)}. Shaken, but alive.`, 'good');
      continue;
    }
    q.kills = (q.kills | 0) + (l.kills | 0);
    kill(c, q.id, { day: s.day, how: l.how === 'left' ? `left behind at ${p.name} with the ${shipName(rules, l.type)}` : `killed at ${p.name}, flying the ${shipName(rules, l.type)}` });
    lost[q.role] = Math.max(0, (lost[q.role] | 0) - 1);
    note(s, `${fullName(rules, q)} ${l.how === 'left' ? 'was left behind' : 'was lost'} with the ${shipName(rules, l.type)}.${q.kills ? ` ${q.kills} kill${q.kills > 1 ? 's' : ''}.` : ''}`, 'bad');
  }
  for (const [id, n] of Object.entries(kills)) { const q = personById(c, +id); if (q) q.kills = (q.kills | 0) + n; }
  s.fleet = report.ships.aboard.map((e) => ({ type: e.type, hp: e.hp, xp: e.xp | 0, perks: [...(e.perks || [])], ...(e.lead && personById(c, e.lead) ? { lead: e.lead } : {}) }));
  // pilots who reached a perk level pick a perk; more ships home than berths: the muster
  offerPerks(rules, s);
  if (s.fleet.length > berthsOf(rules, s)) { s.muster = true; note(s, `${s.fleet.length} ships came aboard, and the hangar berths ${berthsOf(rules, s)}. The muster: choose who continues.`, 'info'); }
  // the rest of the crew lost with ships destroyed or left behind
  const f0 = c.fallen.length;
  for (const r of ROLES) if (lost[r]) loseFlying(c, r, lost[r], { day: s.day, how: `killed at ${p.name}` }, s.fleet);
  if (c.fallen.length > f0) note(s, `Also lost at ${p.name}:${among(rules, s, f0).replace(' Among them:', '')}`, 'bad');
  for (const t of assignFleet(c, rules, s.fleet, { day: s.day })) note(s, t, 'info');
  // hull damage wears the Forge's systems down
  const hullLost = Math.trunc(((hpBefore - s.forge.hp) * 100) / maxHp);
  if (hullLost > 0 && report.forge) {
    const rng = new Random(hashMix(hashMix(s.seed, s.visits), 77) || 1);
    let wear = Math.trunc((hullLost * num(V, 'SystemWear') * B.skillPct(rules, s, 'SystemWearPct')) / 100); // (damage control)
    const hit = {};
    while (wear > 0) { const k = SYSTEMS[rng.int(SYSTEMS.length)], n = Math.min(wear, 3 + rng.int(6)); s.systems[k] = Math.max(0, s.systems[k] - n); hit[k] = (hit[k] || 0) + n; wear -= n; }
    note(s, `The hull took ${hullLost}% damage. Systems hit: ${Object.entries(hit).map(([k, n]) => `${rules.content.systems[k].Name} −${n}`).join(', ')}.`, 'bad');
  }
  // the Wound: a fight is heard, even running silent; Hours killed, Nurseries burned, a Hand
  // destroyed or shaken off, a place burned clean (and captives rescued)
  Wd.woundGoIn(rules, s);
  Wd.afterMap(rules, s, g, p.id, report.wound || null, { note, gain: (n) => { s.crew.roles.hands = (s.crew.roles.hands | 0) + n; } });
  // who you met there, and what they think of what you did
  const F = rules.content.factions, st = report.standing || { changes: {}, met: [] };
  for (const fid of st.met) if (F[fid] && meet(rules, s, fid)) note(s, `First contact with the ${F[fid].Name}. They are ${tierName(rules, s.standing[fid])} toward the Forge.`, 'story');
  for (const [fid, c] of Object.entries(st.changes)) {
    if (!F[fid] || !c.delta) continue;
    const t = change(rules, s, fid, c.delta);
    note(s, `${F[fid].Name}: ${c.delta > 0 ? '+' : ''}${c.delta} standing (${Object.entries(c.reasons).map(([why, n]) => `${why} ${n > 0 ? '+' : ''}${n}`).join(', ')}).`, c.delta < 0 ? 'bad' : 'good');
    if (t) note(s, `The ${F[fid].Name} are now ${t.to} toward the Forge.`, 'story');
  }
  // treaties made over comms on the map, and treaties broken there
  for (const fid of st.broken || []) { const d = breakTreaties(rules, s, fid); if (d) { change(rules, s, fid, d); note(s, `You broke your treaty with the ${F[fid].Name} (${d}).`, 'bad'); } }
  for (const t of st.treaties || []) if (F[t.faction]) { const d = addTreaty(rules, s, t.faction, t.kind); note(s, `${t.kind} with the ${F[t.faction].Name} for ${d} days.`, 'good'); }
  for (const [k, n] of Object.entries(st.paid || {})) s.stores[k] = Math.max(0, (s.stores[k] | 0) - n);
  for (const f of st.flags || []) s.flags = [...new Set([...(s.flags || []), f])];
  for (const what of st.reveals || []) note(s, revealPlaces(rules, s, galaxyOf(rules, s), what), 'info');
  // what was found
  for (const id of report.found || []) if (rules.content.items[id]?.Kind === 'blueprint') learn(rules, s, id);
  // what was sealed in a hulk: the memories waiting at that anchor come back
  for (const id of (report.found || []).filter((x) => rules.content.items[x]?.Kind !== 'blueprint')) recover(rules, s, id);
  // whatever was waiting here has been met
  s.ahead = (s.ahead || []).filter((a) => a.at !== p.id);
  // morale: losses hurt, a win helps
  const shipsLost = sum(report.ships.destroyed) + sum(report.ships.leftBehind);
  if (shipsLost) s.morale = Math.max(0, s.morale - Math.min(15, shipsLost * num(V, 'MoraleLoss')));
  if ((report.kills || 0) >= 3) s.morale = Math.min(100, s.morale + num(V, 'MoraleWin'));
  s.visited[p.id] = (s.visited[p.id] | 0) + 1;
  s.visits++;
  const lostCrew = sum(C.lost || {});
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

const shipName = (rules, type) => (rules.actors.has(type) ? rules.actor(type).traitInfo('Tooltip').Name : type);

// ---------------------------------------------------------------- saving
export const SAVE_VERSION = 10;
export function saveVoyage(s) { return JSON.stringify(s); }
export function loadVoyage(rules, text) {
  const s = JSON.parse(text);
  if (s && s.kind === 'voyage' && s.version === 2) { s.standing = {}; s.met = {}; s.version = 3; } // from Milestone 7
  // from Milestone 12 and before: the crew get their names now (and a visit in progress is
  // replayed without their traits, as it was played)
  if (s && s.kind === 'voyage' && s.version === 3) {
    Object.assign(s.crew, { seed: s.seed | 0, next: 1, rolls: 0, people: [], fallen: [] });
    assignFleet(s.crew, rules, s.fleet || [], { day: s.day | 0, fresh: true });
    s.plainVisit = s.visits | 0;
    s.version = 4;
  }
  // from Milestone 13 and before: a voyage becomes the first life of a campaign. Permanent death
  // and free saves both become the one campaign save.
  if (s && s.kind === 'voyage' && s.version === 4) {
    s.campaign = { ...newCampaign(), chart: { known: [...(s.known || [])], visited: [] }, hints: [...(s.hints || [])] };
    s.saves = 'campaign';
    s.version = 5;
  }
  // from Milestone 14: memories. Saves from before already had working sensors and their drive
  // parts, so they keep them: the radar, the emblem, every drive part found or fitted, and every
  // hull they could build.
  if (s && s.kind === 'voyage' && s.version === 5) {
    const c = s.campaign;
    Object.assign(c, { memories: c.memories || {}, echoes: c.echoes | 0, echoAt: c.echoAt || [] });
    c.chart.clues ||= [];
    const mark = (id) => { if (rules.content.memories[id] && !c.memories[id]) c.memories[id] = { life: c.life, day: s.day | 0 }; };
    mark('radar'); mark('emblem');
    for (const it of Object.values(rules.content.items)) if (it.Kind === 'drive' && s.items && s.items[it.id]) { mark(it.id); delete s.items[it.id]; }
    for (const m of Object.values(rules.content.memories)) for (const [op, arg] of givesOf(m)) if (op === 'hull' && (s.blueprints || []).includes(arg)) mark(m.id);
    s.blueprints = buildable(rules, s);
    s.version = 6;
  }
  // from Milestone 16: strain instead of death, strikes, All hands, cogmarks
  if (s && s.kind === 'voyage' && s.version === 6) {
    Object.assign(s, { strain: { thirst: 0, hunger: 0, air: 0, cold: 0 }, cold: 0, strikes: [], allHands: { days: 0, best: 0 } });
    s.stores.cogmarks = s.stores.cogmarks | 0;
    s.version = 7;
  }
  // from Milestone 17: stations train, and the signals officer joins (at the next day)
  if (s && s.kind === 'voyage' && s.version === 7) { s.training = {}; s.version = 8; }
  // from Milestone 18: levels replace experience (each old rank becomes a level), and perks
  if (s && s.kind === 'voyage' && s.version === 8) {
    const steps = weights(rules.content.voyage.Ranks || 'Seasoned 4, Veteran 10, Elite 20');
    for (const e of s.fleet || []) { let r = 0; steps.forEach(([, n], i) => { if ((e.xp | 0) >= n) r = i + 1; }); e.xp = r * (num(rules.content.voyage, 'LevelPoints') || 100); e.perks = []; }
    s.version = 9;
  }
  // from Milestone 20: the Wound's attention, as a new life would wake with it
  if (s && s.kind === 'voyage' && s.version === 9) { s.wound = Wd.newWound(rules, s); s.version = 10; }
  if (s && s.kind === 'voyage') { s.treaties ||= []; s.flags ||= []; s.stock ||= {}; s.queue ||= []; s.seen ||= []; s.ahead ||= []; } // from Milestones 8 and 9
  // from Milestone 10: everything could be built then, so keep it that way
  if (s && s.kind === 'voyage' && !s.blueprints) s.blueprints = [...new Set([...(rules.content.blueprintStart || []), ...Object.values(rules.content.items).filter((i) => i.Kind === 'blueprint').map((i) => i.Unlocks)])];
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
