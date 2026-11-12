import { Random } from '../engine/random.js';
import { hashMix } from '../engine/math.js';
import { lifeMix, remembers, givesOf } from './life.js';

// The Wound on the chart (Milestone 21; PLAN.md §3, "How the Hands escalate"): the Mainspring's
// attention, the Hands that hunt the Forge, and the places they infest. There is no countdown.
// Attention rises (memories recovered, days passing, staying put, Nurseries burned and Hours
// killed) and falls (silent running, the Choir, static fields); its level decides how many Hands
// hunt. A Hand moves a lane every few days toward where the Forge was last heard; when it reaches
// the Forge, it has caught it, and the next map there has its Hour in it. Being caught is never
// the end: fight (kill the Hour and the Hand is gone for this life), or stitch away at a cost.
// Plain data on the voyage, s.wound:
//   att (points), heard (place id), stay { at, days }, next (hand id),
//   hands [ { id, at, power, next (day it moves), strong, caught } ], gone (hands destroyed),
//   infested { place: day }, cleansed [ place ids ], burned, hours
// Numbers: voyage.yaml, Wound. The galaxy (g) is passed in, so this module needs nothing of voyage.js.

const LEVELS = ['Quiet', 'Noticed', 'Hunted', 'Marked'];
const W = (rules) => rules.content.wound || {};
const num = (o, k, d = 0) => (o && o[k] !== undefined ? +o[k] | 0 : d);
const range = (v, d) => { const [a, b] = String(v || d).split('-').map(Number); return [a | 0, (b === undefined ? a : b) | 0]; };
const pairs = (v) => Object.fromEntries(String(v || '').split(',').map((x) => x.trim().split(/\s+/)).filter((p) => p[0]).map(([k, n]) => [k, +n | 0]));
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

export const silentRunning = (rules, s) => Object.values(rules.content.memories || {}).some((m) => remembers(s, m.id) && givesOf(m).some(([op]) => op === 'silent'));
const memoryCount = (s) => Object.keys((s.campaign && s.campaign.memories) || {}).length;

// A new life's Wound: attention near what its memories have earned.
export function newWound(rules, s) {
  const C = W(rules);
  return { att: Math.min(num(C, 'StartMax', 60), memoryCount(s) * num(C, 'StartPer')), heard: s.at, stay: { at: s.at, days: 0 }, next: 1, hands: [], gone: 0, infested: {}, cleansed: [], burned: 0, hours: 0 };
}
export const woundOf = (rules, s) => (s.wound ||= newWound(rules, s));

// { id, name, text, index, points, hands, strong }
export function attention(rules, s) {
  const C = W(rules), wd = woundOf(rules, s);
  let i = 0;
  LEVELS.forEach((k, j) => { if (C[k] && wd.att >= num(C[k], 'At')) i = j; });
  const L = C[LEVELS[i]] || {};
  return { id: LEVELS[i].toLowerCase(), name: LEVELS[i], text: L.Text || '', index: i, points: wd.att, hands: num(L, 'Hands'), strong: L.Strong === 'true' };
}
// A long life (Milestone 24): how much a day's point is worth this far into the life, how much
// bigger and tougher a Hand's pack is (percent), whether the Hands keep the trail, and how many
// Hands the life itself calls for
// (a small galaxy's life ages faster: ShortLifePct percent of the days)
// (every Hour killed buys a reprieve: the life counts KillReprieve days younger)
export const lifeAge = (rules, s) => Math.max(0, (s.length === 'short' ? Math.trunc(((s.day | 0) * num(W(rules), 'ShortLifePct', 100)) / 100) : s.day | 0) - ((s.wound && s.wound.reprieve) | 0));
export function lifeMult(rules, s) {
  let m = 1;
  for (const [day, k] of Object.entries(pairs(W(rules).LifeDays)).map(([d, k]) => [+d, k])) if (lifeAge(rules, s) >= day) m = Math.max(m, k);
  return m;
}
export const handAgePct = (rules, s) => { const C = W(rules); return 100 + num(C, 'HandAgePct') * Math.trunc(lifeAge(rules, s) / Math.max(1, num(C, 'HandAgeDays', 30))); };
export const keepTrail = (rules, s) => num(W(rules), 'KeepTrail') > 0 && lifeAge(rules, s) >= num(W(rules), 'KeepTrail');
const restDays = (rules, s) => (keepTrail(rules, s) ? num(W(rules), 'TrailRest', 2) : num(W(rules), 'Rest', 5));
const lifeHands = (rules, s) => (num(W(rules), 'SecondHand') > 0 && lifeAge(rules, s) >= num(W(rules), 'SecondHand') ? 2 : s.length === 'short' && num(W(rules), 'ShortFirstHand') > 0 && lifeAge(rules, s) >= num(W(rules), 'ShortFirstHand') ? 1 : 0);
const clampAtt = (rules, n) => Math.max(0, Math.min(num(W(rules), 'Max', 100), n));
// Attention changes; returns the new level if it crossed one.
export function raise(rules, s, n, note) {
  const before = attention(rules, s).index, wd = woundOf(rules, s);
  wd.att = clampAtt(rules, wd.att + n);
  const after = attention(rules, s);
  if (after.index !== before && note) note(s, after.index > before ? `The Mainspring's attention: ${after.name}. ${after.text}` : `The Mainspring's attention falls: ${after.name}. ${after.text}`, after.index > before ? 'bad' : 'good');
  return after.index !== before ? after : null;
}
// down to the bottom of the level below (a Hand destroyed)
function stepDown(rules, s, note) {
  const C = W(rules), a = attention(rules, s), wd = woundOf(rules, s);
  if (a.index <= 0) return;
  const to = num(C[LEVELS[a.index - 1]], 'At');
  raise(rules, s, to - wd.att, note);
}

// lanes from `from` to every place, along lanes a Hand can use (no static fields)
function handHops(g, from) {
  const n = g.points.length, hops = new Array(n).fill(1e9), q = [from];
  hops[from] = 0;
  while (q.length) {
    const i = q.shift();
    for (const li of g.adj[i]) { const l = g.lanes[li]; if (l.hazard === 'static') continue; const j = l.a === i ? l.b : l.a; if (hops[j] > hops[i] + 1) { hops[j] = hops[i] + 1; q.push(j); } }
  }
  return hops;
}
// any lanes at all, for what the chart can see
function hopsAny(g, from, max) {
  const out = new Map([[from, 0]]);
  let ring = [from];
  for (let d = 1; d <= max; d++) {
    const next = [];
    for (const i of ring) for (const li of g.adj[i]) { const l = g.lanes[li], j = l.a === i ? l.b : l.a; if (!out.has(j)) { out.set(j, d); next.push(j); } }
    ring = next;
  }
  return out;
}
const rngFor = (s, salt) => new Random(hashMix(hashMix(lifeMix(s, s.seed | 0), (s.day | 0) * 7 + salt), 0x3d10) || 1);
// (late in a long life, once they keep the trail, they come a lane every TrailDays)
const moveDays = (rules, h, rng, s = null) => { const C = W(rules); if (s && keepTrail(rules, s)) return Math.max(1, num(C, 'TrailDays', 1)); if (h.strong) return Math.max(1, num(C, 'StrongDays', 2)); const [a, b] = range(C.MoveDays, '2-3'); return a + rng.int(Math.max(1, b - a + 1)); };

// A Hand sets out from the Shore (from a place far from the Forge).
function spawnHand(rules, s, g, strong, note) {
  const C = W(rules), wd = woundOf(rules, s), rng = rngFor(s, 101 + wd.next);
  const from = String(C.HandFrom || 'Shore');
  const hops = handHops(g, s.at);
  let cand = g.points.filter((p) => p.region === from && hops[p.id] < 1e9 && p.id !== s.at);
  if (!cand.length) cand = g.points.filter((p) => hops[p.id] < 1e9 && p.id !== s.at);
  if (!cand.length) return null;
  // the far half of them
  cand.sort((a, b) => hops[b.id] - hops[a.id] || a.id - b.id);
  const p = cand[rng.int(Math.max(1, (cand.length + 1) >> 1))];
  const h = { id: wd.next++, at: p.id, power: Math.trunc((num(C, 'Power', 100) * (strong ? num(C, 'StrongPct', 150) : 100)) / 100), strong: !!strong, next: s.day + moveDays(rules, { strong }, rng, s), caught: false, born: s.day };
  wd.hands.push(h);
  if (note) note(s, strong ? 'The bell-ringer swears he heard a second bell, out past the Shore. Another Hand has set out, and this one is hungry.' : 'Something out past the Shore has started to move. The sensors officer calls it a Hand: an Hour and its pack, following where the Forge was last heard.', 'bad');
  return h;
}

// What the chart sees of the Hands: those within SeeHops lanes. [{ id, at, hops, caught }]
export function handsSeen(rules, s, g) {
  const wd = woundOf(rules, s), near = hopsAny(g, s.at, num(W(rules), 'SeeHops', 2));
  return wd.hands.filter((h) => near.has(h.at)).map((h) => ({ id: h.id, at: h.at, hops: near.get(h.at), caught: !!h.caught, strong: h.strong, power: h.power }));
}
export const caughtBy = (rules, s) => woundOf(rules, s).hands.find((h) => h.caught && h.at === s.at) || null;

// One day of the Wound (voyage.js dayTick). transit: the Forge is between places.
export function woundDay(rules, s, g, { transit = false, note = null } = {}) {
  const C = W(rules), wd = woundOf(rules, s), p = g.points[s.at];
  // days passing, slowly; staying long at one place
  if (wd.stay.at !== s.at) wd.stay = { at: s.at, days: 0 };
  wd.stay.days++;
  let d = 0;
  if (num(C, 'DaysPer') && s.day % num(C, 'DaysPer') === 0) d += lifeMult(rules, s);
  if (!transit && wd.stay.days > num(C, 'StayFrom', 4)) d++;
  // silent running, and the Choir's hiding
  if (silentRunning(rules, s)) d -= num(C, 'Silent');
  if (!transit && p.owner === 'choir') d -= num(C, 'Choir');
  if (d) raise(rules, s, d, note);
  // the Hands this level calls for (one destroyed stays gone: the next level's comes instead);
  // late in a long life, a second, strong one whatever the level
  const a = attention(rules, s), want = Math.max(a.hands, lifeHands(rules, s)), late = lifeHands(rules, s) >= 2;
  while (wd.hands.length + wd.gone < want) if (!spawnHand(rules, s, g, (a.strong || late) && wd.hands.length + wd.gone >= 1, note)) break;
  // late in a long life the Hands follow the Forge itself, heard or not
  if (keepTrail(rules, s)) wd.heard = s.at;
  // they grow, and move
  const rng = rngFor(s, 7);
  for (const h of wd.hands) {
    h.power += Math.trunc((num(C, 'Grow') * (h.strong ? num(C, 'StrongPct', 150) : 100)) / 100);
    if (h.caught) {
      // it has the Forge: its pickets harass it each day
      if (h.at === s.at && !transit) { const n = Math.trunc((s.forge.hp * num(C, 'Harass')) / 100); if (n > 0) s.forge.hp = Math.max(1, s.forge.hp - n); }
      else h.caught = false;
      continue;
    }
    if (s.day < h.next) continue;
    h.next = s.day + moveDays(rules, h, rng, s);
    const hops = handHops(g, wd.heard), opts = g.adj[h.at].map((li) => g.lanes[li]).filter((l) => l.hazard !== 'static').map((l) => (l.a === h.at ? l.b : l.a));
    if (!opts.length) continue;
    let to;
    if (h.at === wd.heard || (!keepTrail(rules, s) && rng.int(100) < num(C, 'LosePct'))) to = opts[rng.int(opts.length)]; // lost the trail
    else to = opts.reduce((b, j) => (hops[j] < hops[b] || (hops[j] === hops[b] && j < b) ? j : b), opts[0]);
    const left = h.at;
    h.at = to;
    // it may infest the place it leaves
    if (a.index >= 2 && Object.keys(wd.infested).length < num(C, 'InfestMax') && !wd.cleansed.includes(left) && !g.points[left].trader && !g.points[left].seat && left !== g.start && rng.int(100) < num(C, 'InfestPct') * (h.strong ? 2 : 1)) wd.infested[left] = s.day;
  }
  if (!transit) catchCheck(rules, s, note);
}
// A Hand where the Forge is (and not mid-stitch) has caught it.
export function catchCheck(rules, s, note) {
  for (const h of woundOf(rules, s).hands) {
    if (h.at !== s.at || h.caught || s.day < (h.rest | 0)) continue;
    h.caught = true;
    if (note) note(s, `A Hand has caught the Forge at this place. Its Hour is coming. Go in and fight it, or stitch away (it will cost you).`, 'bad');
  }
}

// Arriving at a place (voyage.js arrived): the Forge is heard there, unless it runs silent;
// a stitch through a static field shook the Hands off a little. lanes: what was crossed.
export function woundArrive(rules, s, g, { lanes = [], note = null } = {}) {
  const C = W(rules), wd = woundOf(rules, s);
  if (!silentRunning(rules, s)) wd.heard = s.at;
  const stat = lanes.filter((li) => g.lanes[li].hazard === 'static').length;
  if (stat) raise(rules, s, -stat * num(C, 'Static'), note);
  catchCheck(rules, s, note);
}
// Going in to a map: even running silent, a fight is heard.
export function woundGoIn(rules, s) { woundOf(rules, s).heard = s.at; }

// Leaving a place where a Hand has caught the Forge, without fighting: the cost.
export function escapePlan(rules, s) {
  const h = caughtBy(rules, s);
  if (!h) return null;
  const e = pairs(W(rules).Escape);
  return { hull: e.hull | 0, morale: e.morale | 0, wear: e.wear | 0, hand: h.id };
}
export function escape(rules, s, systems, note, maxHp = s.forge.hp) {
  const e = escapePlan(rules, s);
  if (!e) return;
  const h = woundOf(rules, s).hands.find((x) => x.id === e.hand);
  h.caught = false;
  h.next = h.rest = s.day + restDays(rules, s);
  // under fire, the loss is of the whole hull (Milestone 24): with less left than that, the Forge
  // comes apart as it tears free (voyage.js ends the life)
  s.forge.hp -= Math.trunc((maxHp * e.hull) / 100);
  if (s.forge.hp <= 0) { s.forge.hp = 0; return; }
  s.morale = Math.max(0, s.morale - e.morale);
  const rng = rngFor(s, 13), k = systems[rng.int(systems.length)];
  s.systems[k] = Math.max(0, s.systems[k] - e.wear);
  if (note) note(s, `The Forge tears free of the Hand: −${e.hull}% hull, morale −${e.morale}, and the ${k} took a hit as the Skein spooled under fire.`, 'bad');
}

// What a map at place `p` holds of the Wound: { hand, infested, roam } (any may be null), and
// the slot for the Wound's player. pid: the place.
export function mapWound(rules, s, g, pid) {
  const C = W(rules), wd = woundOf(rules, s), p = g.points[pid], a = attention(rules, s);
  const rng = new Random(hashMix(hashMix(lifeMix(s, s.seed | 0), pid * 131 + (s.visited[pid] | 0)), 0x3d11) || 1);
  const h = wd.hands.find((x) => x.at === pid) || null;
  const infested = wd.infested[pid] !== undefined && !wd.cleansed.includes(pid);
  let roam = null;
  if (!h && !infested && a.index >= 1) {
    const r = pairs(C.Roam)[p.region] | 0;
    if (r && rng.int(100) < r) roam = list(C.RoamPack);
  }
  if (!h && !infested && !roam) return null;
  const encounters = [];
  let ichor = 0, plant = 0, grow = '';
  if (h) {
    // a long life's Hands bring more Hounds and Ticks, and every ship tougher (Milestone 24)
    const age = handAgePct(rules, s), more = (k) => Math.trunc((k * age) / 100);
    const ships = ['hour'];
    for (let k = 0; k < more(1 + Math.trunc(h.power / Math.max(1, num(C, 'PackHound', 120)))); k++) ships.push('hound');
    for (let k = 0; k < more(3 + Math.trunc(h.power / Math.max(1, num(C, 'PackTick', 35)))); k++) ships.push('tick');
    ships.push('feeder', 'feeder');
    if (h.strong) ships.push('stinger', 'stinger', 'gnawer');
    encounters.push({ ships, behaviour: 'hand', hpPct: age });
    ichor += h.power * num(C, 'IchorPer', 3);
    grow = h.strong ? 'feeder, tick, chime, stinger, hound, gnawer' : 'feeder, tick, chime, stinger, hound';
  }
  if (infested) {
    const [lo, hi] = range(C.Nurseries, '2-3');
    plant = lo + rng.int(Math.max(1, hi - lo + 1));
    encounters.push({ ships: list(C.Garrison), behaviour: 'lurk' });
    ichor += num(C, 'GarrisonIchor');
  }
  if (roam) encounters.push({ ships: roam, behaviour: 'hunt', delay: 60 + rng.int(60) });
  return {
    hand: h ? h.id : 0, infested, roam: !!roam, encounters,
    haze: infested ? num(C, 'Haze', 70) : 100,
    slot: { ichor, plant, hand: h ? 'hunt' : 'lair', delay: num(C, 'HuntDelay', 45) * 25, grow: grow || 'feeder, tick' },
  };
}

// The Mainspring's lair (Milestone 22): the demon lord at the far end of the map, its pack
// beside it, Nurseries on the rocks, and ichor to grow more (voyage.yaml Wound: Lair*). A Hand
// that happens to be there joins it.
export function lairWound(rules, s, g, pid, w = null) {
  const C = W(rules), list2 = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const pct = s.length === 'short' ? num(C, 'ShortLairPct', 100) : 100, pack = list2(C.LairPack);
  const encounters = [{ ships: ['mainspring'], behaviour: 'lair', at: [82, 50] }, { ships: pack.slice(0, Math.max(1, Math.trunc((pack.length * pct) / 100))), behaviour: 'lair', at: [70, 38] }];
  if (w) for (const e of w.encounters) encounters.push(e);
  return {
    hand: w ? w.hand : 0, infested: false, roam: false, lair: true, encounters, haze: 100,
    slot: { lairPct: pct, ichor: Math.trunc((num(C, 'LairIchor', 1200) * pct) / 100) + (w ? w.slot.ichor : 0), plant: num(C, 'LairNurseries', 2), hand: 'lair', delay: 0, grow: 'feeder, tick, chime, stinger, hound, gnawer', growPct: num(C, 'LairGrowPct', 100), nurseries: num(C, 'LairNurseries', 2) },
  };
}

// Back from a map with the Wound in it (report.wound, from the WoundAI): Hours killed, Nurseries
// burned, the Hand destroyed or shaken off, the place cleansed.
export function afterMap(rules, s, g, pid, r, { note = null, gain = null } = {}) {
  if (!r) return;
  const C = W(rules), wd = woundOf(rules, s);
  wd.burned += r.burned | 0; wd.hours += r.hours | 0;
  const up = (r.burned | 0) * num(C, 'Burned') + (r.hours | 0) * num(C, 'HourKilled');
  if (up) raise(rules, s, up, note);
  const h = wd.hands.find((x) => x.at === pid);
  if (h && r.hand) {
    if (r.hours > 0) {
      wd.hands = wd.hands.filter((x) => x !== h);
      wd.gone++;
      wd.reprieve = (wd.reprieve | 0) + num(C, 'KillReprieve');
      if (note) note(s, 'The Hour is dead, and its Hand with it. Whatever was listening lost a finger tonight. It will not come back in this life.', 'good');
      stepDown(rules, s, note);
    } else {
      // shaken off: it regrows (as hurt as its Hour), and loses the Forge for a while
      h.caught = false;
      h.power = Math.max(num(C, 'Power', 100) >> 1, Math.trunc((h.power * Math.max(40, r.hourPct | 0)) / 100));
      h.next = h.rest = s.day + restDays(rules, s);
      if (note) note(s, 'The Forge got out from under the Hand. It is still out there, licking its wounds.', 'info');
    }
  }
  const infested = wd.infested[pid] !== undefined && !wd.cleansed.includes(pid);
  if (infested && ((r.planted > 0 && r.nurseries === 0) || r.hours > 0)) {
    wd.cleansed.push(pid);
    delete wd.infested[pid];
    const rng = new Random(hashMix(hashMix(lifeMix(s, s.seed | 0), pid), 0x3d12) || 1);
    const echoes = num(C, 'CleanseEchoes');
    s.campaign.echoes = (s.campaign.echoes | 0) + echoes;
    let captives = 0;
    if (rng.int(100) < num(C, 'CaptivePct')) { const [lo, hi] = range(C.Captives, '3-8'); captives = lo + rng.int(Math.max(1, hi - lo + 1)); if (gain) gain(captives); }
    if (note) note(s, `${g.points[pid].name} is burned clean. The red veins go dark.${echoes ? ` +${echoes} echo${echoes > 1 ? 'es' : ''}: something in the flesh remembered you.` : ''}${captives ? ` In the last pod, ${captives} people from the havens, alive. They come aboard as hands.` : ''}`, 'good');
  }
}
