import { hashMix } from '../engine/math.js';
import { remembers, givesOf, lifeOf } from './life.js';
import { count, officerOf, officerPct, traitOf } from './crew.js';
import { crewHolds } from './comms.js';

// The Forge as a base, and survival that weakens (PLAN.md §6, Milestone 17).
//
// Rooms: the deck plan's rooms (items.yaml, Kind room) built with ore, salvage, days and free
// engineers, into DeckSlots slots. Some need their memory first. They are physical: a new
// life starts without them.
// Strain: running out of water, food, air or boiler heat never kills. Each kind of shortage
// has a strain level, 0 to 3, that rises a level a day while it lasts and falls once it ends;
// every level makes the Forge weaker (capped), and at 2 and 3 stations go dark.
// Stations: the departments the officers run (crew.yaml Stations), each online, dim, dark,
// striking or cold. A dark or striking station loses what it does.
// Mood: Content, Uneasy or Angry, from morale and what is short, with its causes; it changes
// how fast work goes and what things cost. Under Strike, stations' crews walk off, one a day,
// until morale is back over Back or there is a parley.
// All hands: every station green; a bonus while it lasts, and a streak.
// Levels and training (the bridge, Milestone 18): every open station wakes at level 1 each life;
// training takes it to 2 and 3 for that life, each level bringing a trained skill (crew.yaml
// Skills). An officer's work counts half at level 1 and in full from 2. What Jacob remembers
// for a station (its Memories) lasts, and makes training it cheaper.
//
// Pure and deterministic, integer maths only. State on the voyage: s.strain { thirst, hunger,
// air, cold }, s.cold (the percent systems work at while the boilers are out, or 0),
// s.strikes [station ids], s.allHands { days, best }, s.training { station: levels trained }.

export const KINDS = ['thirst', 'hunger', 'air', 'cold'];
const KIND_NAME = { thirst: 'Thirst', hunger: 'Hunger', air: 'Bad air', cold: 'Cold' };
const num = (o, k, d = 0) => (o && o[k] !== undefined ? +o[k] | 0 : d);
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
function log(s, text, kind = 'info') { s.log.push({ day: s.day, text, kind }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); }

// ---------------------------------------------------------------- rooms
export const rooms = (rules) => Object.values(rules.content.items).filter((it) => it.Kind === 'room');
export const built = (s, id) => !!s.items && s.items[id] === 'installed';
export const slotsOf = (rules, it) => (it.Slots === undefined ? 1 : +it.Slots | 0);
export const deckSlots = (rules) => num(rules.content.voyage, 'DeckSlots', 8);
export const slotsUsed = (rules, s) => rooms(rules).filter((it) => built(s, it.id)).reduce((t, it) => t + slotsOf(rules, it), 0);
// the memory a room needs, if any (one that Gives "room <id>")
export const roomMemory = (rules, id) => Object.values(rules.content.memories || {}).find((m) => givesOf(m).some(([op, arg]) => op === 'room' && arg === id)) || null;
export const roomKnown = (rules, s, id) => { const m = roomMemory(rules, id); return !m || remembers(s, m.id); };
// a number from the rooms built: summed (Berths, Recover) or multiplied as percent (with the
// trained skills that share the key: RepairCostPct, WaterPct, CarePct)
export function roomSum(rules, s, key, kind = '') {
  let v = 0;
  for (const it of rooms(rules)) if (built(s, it.id) && it[key] !== undefined && (!kind || !it.Strain || list(it.Strain).includes(kind))) v += +it[key] | 0;
  return v;
}
export function roomPct(rules, s, key) {
  let v = 100;
  for (const it of rooms(rules)) if (built(s, it.id) && it[key] !== undefined) v = Math.trunc((v * +it[key]) / 100);
  return Math.trunc((v * skillPct(rules, s, key)) / 100);
}
export const berths = (rules, s) => num(rules.content.voyage, 'Berths', 160) + roomSum(rules, s, 'Berths');

// ---------------------------------------------------------------- strain
export const strainOf = (s) => s.strain || { thirst: 0, hunger: 0, air: 0, cold: 0 };
export const strainTotal = (s) => KINDS.reduce((t, k) => t + (strainOf(s)[k] | 0), 0);
// the levels that count toward the penalties (capped)
const strainLevels = (rules, s) => Math.min(num(rules.content.strain, 'Cap', 4), strainTotal(s));
// stations a kind of strain has taken dark: the first at level 2, the second too at 3
export function strainDark(rules, s) {
  const out = new Map(), D = (rules.content.strain || {}).Dark || {}, st = strainOf(s);
  for (const k of KINDS) {
    const ids = list(D[k]), n = (st[k] | 0) >= 3 ? 2 : (st[k] | 0) >= 2 ? 1 : 0;
    for (const id of ids.slice(0, n)) if (!out.has(id)) out.set(id, k);
  }
  return out;
}

// ---------------------------------------------------------------- stations
// [{ id, name, post, officer, state, why, notYet, mood, text, dark }] in crew.yaml order
export function stations(rules, s) {
  const S = (rules.content.crew && rules.content.crew.stations) || {}, posts = rules.content.crew.posts, M = rules.content.memories || {};
  const dark = strainDark(rules, s), strikes = s.strikes || [];
  return Object.values(S).map((st) => {
    const o = st.Post ? officerOf(s.crew, st.Post) : null;
    let state = 'online', why = '', notYet = false;
    if (st.Needs && !remembers(s, st.Needs)) { state = 'dark'; notYet = true; why = `Needs a memory: ${M[st.Needs] ? M[st.Needs].Name : st.Needs}.`; }
    else if (st.Room && !built(s, st.Room)) { state = 'dark'; notYet = true; why = `Needs the ${rules.content.items[st.Room].Name.toLowerCase()} on the deck plan.`; }
    else if (strikes.includes(st.id)) { state = 'striking'; why = 'Its crew have walked off.'; }
    else if (dark.has(st.id)) { state = 'dark'; why = `${KIND_NAME[dark.get(st.id)]}: the crew can't keep it running.`; }
    else if (s.cold) { state = 'cold'; why = 'The boilers are out: half its work.'; }
    else if (st.Post && !o) { state = 'dim'; why = `No ${posts[st.Post].Name.toLowerCase()}.`; }
    else if (st.System && (s.systems[st.System] | 0) < 50) { state = 'dim'; why = `The ${rules.content.systems[st.System].Name.toLowerCase()} needs repair.`; }
    // each station's mood: the crew's, judged as if morale were a little higher under a Beloved
    // officer and a little lower under a Grim one; red while it is dark or striking
    const order = ['angry', 'uneasy', 'content'];
    const t = o ? traitOf(rules, o) : null;
    let m = order.indexOf(moodOf(rules, s, s.morale + 5 * (t ? +t.Morale | 0 : 0)).mark);
    if (!notYet && (state === 'dark' || state === 'striking')) m = 0;
    else if (state !== 'online' && !notYet) m = Math.min(m, 1);
    return { id: st.id, name: st.Name, post: st.Post || '', officer: o ? o.name : '', state, why, notYet, mood: notYet ? '' : order[m], text: st.Text || '', dark: st.Dark || '' };
  });
}
// Has a station opened (its memory known, its room built)?
export function opened(rules, s, id) {
  const st = rules.content.crew.stations[id];
  return !!st && !(st.Needs && !remembers(s, st.Needs)) && !(st.Room && !built(s, st.Room));
}
// ---------------------------------------------------------------- levels and training
// A station's level now: 0 while it is down or not open yet; 1 when manned; 2 and 3 trained.
export function levelOf(rules, s, id, st = null) {
  if (st ? st.notYet || st.state === 'dark' || st.state === 'striking' : stationDown(rules, s, id)) return 0;
  return Math.min(3, 1 + ((s.training && s.training[id]) | 0));
}
// The station a post runs (or null), and the level an officer at that post works at
export const stationOfPost = (rules, post) => Object.values(rules.content.crew.stations || {}).find((x) => x.Post === post) || null;
export function postLevel(rules, s, post, list = null) { const S = stationOfPost(rules, post); return S ? levelOf(rules, s, S.id, list && list.find((x) => x.id === S.id)) : 2; }
// The officers' part of a bonus key, at their stations' levels (half at level 1)
export function officerPctAt(rules, s, key) {
  if (!s.crew.people) return 100;
  return officerPct(rules, s.crew, key, crewHolds(rules, s), (post) => postLevel(rules, s, post));
}
// The trained skills working now: [skill ids], the first at level 2, the second at 3
export function skillsNow(rules, s) {
  const S = rules.content.crew.stations || {}, out = [];
  if (!s.training) return out;
  for (const id of Object.keys(s.training)) {
    if (!S[id] || !s.training[id]) continue;
    const lv = levelOf(rules, s, id), tr = list(S[id].Train);
    for (let k = 0; k < lv - 1 && k < tr.length; k++) out.push(tr[k]);
  }
  return out;
}
export function skillPct(rules, s, key) {
  const K = rules.content.crew.skills || {};
  let v = 100;
  if (!s.training || !Object.keys(s.training).length) return v;
  for (const id of skillsNow(rules, s)) if (K[id] && K[id][key] !== undefined) v = Math.trunc((v * +K[id][key]) / 100);
  return v;
}
export function skillSum(rules, s, key) {
  const K = rules.content.crew.skills || {};
  if (!s.training || !Object.keys(s.training).length) return 0;
  return skillsNow(rules, s).reduce((t, id) => t + ((K[id] && +K[id][key]) | 0), 0);
}
// Does Jacob remember anything for this station?
export const remembersFor = (rules, s, id) => list((rules.content.crew.stations[id] || {}).Memories).some((m) => remembers(s, m));
// Training a station to its next level: { ok, why, level, cogmarks, days }
export function trainPlan(rules, s, id) {
  const T = rules.content.training || {}, st = stations(rules, s).find((x) => x.id === id);
  if (!st) return { ok: false, why: 'No such station.' };
  if (st.notYet) return { ok: false, why: st.why };
  if (st.state === 'dark' || st.state === 'striking') return { ok: false, why: `${st.name} is ${st.state === 'striking' ? 'on strike' : 'dark'}: nobody to train.` };
  const lv = levelOf(rules, s, id, st);
  if (lv >= 3) return { ok: false, why: `${st.name} is as good as it gets: expert.` };
  const cost = list(T.Cogmarks).map(Number), days = list(T.Days).map(Number), k = lv - 1;
  const pct = remembersFor(rules, s, id) ? num(T, 'Remembered', 50) : 100;
  const c = Math.trunc(((cost[k] || 30) * pct) / 100), d = days[k] || 1;
  if ((s.stores.cogmarks | 0) < c) return { ok: false, why: `Training it takes ${c} cogmarks; the Forge has ${s.stores.cogmarks | 0}.`, level: lv + 1, cogmarks: c, days: d };
  return { ok: true, level: lv + 1, cogmarks: c, days: d, cheaper: pct < 100 };
}

// Is a station not working now (dark, striking, or not opened yet)? (The same as stations()
// says, without working out everyone's mood.)
export function stationDown(rules, s, id) {
  if (!(rules.content.crew.stations || {})[id]) return false;
  return !opened(rules, s, id) || (s.strikes || []).includes(id) || strainDark(rules, s).has(id);
}

// ---------------------------------------------------------------- mood
const NEED = (rules, s) => { const N = rules.content.voyage.Need, n = count(s.crew); const per = (k) => Math.trunc((n * (+N[k] | 0) + 9) / 10); return { ice: per('Water'), food: per('Food'), air: per('Air'), glim: num(rules.content.voyage, 'ReactorGlim') }; };
// { mark: content | uneasy | angry, causes: [{ id, text, bad }] } (`morale`: judged at another)
export function moodOf(rules, s, morale = s.morale) {
  const V = rules.content.voyage, Mo = rules.content.mood || {}, need = NEED(rules, s), st = strainOf(s), low = num(V, 'LowDays', 3);
  const causes = [];
  let out = false, short = false;
  for (const [k, kind, name] of [['ice', 'thirst', 'Thirst'], ['food', 'hunger', 'Hunger'], ['air', 'air', 'Bad air'], ['glim', 'cold', 'Cold']]) {
    const have = s.stores[k] | 0, what = k === 'ice' ? 'water' : k === 'glim' ? 'Glim for the boilers' : k;
    // a store gone makes them angry; one running low, or strain still easing off, uneasy
    if (k === 'glim' ? !!s.cold : have <= 0) { out = true; causes.push({ id: kind, text: k === 'glim' ? 'Cold: the boilers are out of Glim.' : `${name}: no ${what} left${st[kind] ? `, strain ${st[kind]}` : ''}.`, bad: true }); }
    else if ((st[kind] | 0) > 0) { short = true; causes.push({ id: kind, text: `${name}: strain ${st[kind]}, easing off.`, bad: false }); }
    else if (have < need[k] * low) { short = true; causes.push({ id: kind, text: `${name}: ${what} is running low.`, bad: false }); }
  }
  const grief = num(Mo, 'Grief', 3), dead = (s.crew.fallen || []).filter((f) => (f.day | 0) > (s.day | 0) - grief).length;
  if (dead) causes.push({ id: 'grief', text: `Grief: ${dead} lost in the last ${grief} days.`, bad: false });
  if (count(s.crew) > berths(rules, s)) causes.push({ id: 'crowded', text: `Crowded: ${count(s.crew)} aboard, with berths for ${berths(rules, s)}.`, bad: false });
  if ((s.strikes || []).length) causes.push({ id: 'strike', text: `On strike: ${(s.strikes || []).length} station${s.strikes.length > 1 ? 's' : ''}.`, bad: true });
  const mark = morale < num(Mo, 'Angry', 30) || out ? 'angry' : morale < num(Mo, 'Content', 60) || short ? 'uneasy' : 'content';
  return { mark, causes };
}

// ---------------------------------------------------------------- what it all does
// Every one of these is a percent (100: as normal). What strain costs is softened by the
// surgeon's work and the infirmary (CarePct: less is better).
export const carePct = (rules, s) => Math.trunc((roomPct(rules, s, 'CarePct') * officerPctAt(rules, s, 'CarePct')) / 100);
// (capped at Cap levels' worth, whatever the surgeon)
const strainPctOf = (rules, s, key, sign) => { const k = num(rules.content.strain, key); return 100 + sign * Math.min(num(rules.content.strain, 'Cap', 4) * k, Math.trunc((strainLevels(rules, s) * k * carePct(rules, s)) / 100)); };
const moodCost = (rules, s) => { const Mo = rules.content.mood || {}, m = moodOf(rules, s).mark; return m === 'angry' ? num(Mo, 'AngryCost', 130) : m === 'uneasy' ? num(Mo, 'UneasyCost', 110) : 100; };
export function allHandsOn(rules, s) { return !!(s.allHands && s.allHands.days > 0); }
// how fast work goes: Content is quicker, strain slower, All hands quicker still
export function workPctOf(rules, s) {
  const Mo = rules.content.mood || {}, A = rules.content.allHands || {};
  let p = moodOf(rules, s).mark === 'content' ? num(Mo, 'WorkPct', 110) : 100;
  p = Math.trunc((p * strainPctOf(rules, s, 'Work', -1)) / 100);
  if (allHandsOn(rules, s)) p = Math.trunc((p * num(A, 'Work', 110)) / 100);
  return Math.max(10, p);
}
// what building rooms and ships costs
export function costPctOf(rules, s) {
  return Math.trunc((moodCost(rules, s) * strainPctOf(rules, s, 'Cost', 1)) / 100);
}
// the Glim a stitch burns
export function glimPctOf(rules, s) {
  const A = rules.content.allHands || {};
  let p = Math.trunc((moodCost(rules, s) * strainPctOf(rules, s, 'Glim', 1)) / 100);
  if (allHandsOn(rules, s)) p = Math.trunc((p * num(A, 'Glim', 90)) / 100);
  if (stationDown(rules, s, 'navigation')) p = Math.trunc((p * 150) / 100);
  return p;
}
// how well ships do on maps
export function shipPctOf(rules, s) {
  let p = strainPctOf(rules, s, 'Ships', -1);
  if (allHandsOn(rules, s)) p = Math.trunc((p * num(rules.content.allHands, 'Ships', 105)) / 100);
  return Math.max(10, p);
}

// ---------------------------------------------------------------- a day
// Strain after a day: out (which kinds ran out today). Returns notes.
export function dayStrain(rules, s, out) {
  const st = (s.strain ||= { thirst: 0, hunger: 0, air: 0, cold: 0 }), before = strainDark(rules, s);
  const infirmary = !stationDown(rules, s, 'infirmary');
  for (const k of KINDS) {
    const was = st[k] | 0;
    if (out[k]) st[k] = Math.min(3, was + 1);
    else {
      let rec = 1;
      for (const it of rooms(rules)) {
        if (!built(s, it.id) || !it.Recover || (it.Strain && !list(it.Strain).includes(k))) continue;
        if (it.id === 'infirmary' && !infirmary) continue;
        rec += +it.Recover | 0;
      }
      st[k] = Math.max(0, was - rec);
    }
    if (st[k] > was) log(s, `${KIND_NAME[k]}: strain ${st[k]}. ${['', 'The crew are slower, and everything costs more.', 'People are fainting at their posts.', 'The Forge is badly weakened.'][st[k]]}`, 'bad');
    else if (st[k] < was && st[k] === 0) log(s, `${KIND_NAME[k]} has passed.`, 'good');
  }
  const after = strainDark(rules, s), S = rules.content.crew.stations;
  for (const [id] of after) if (!before.has(id) && opened(rules, s, id)) log(s, `${S[id].Name} goes dark. ${S[id].Dark}`, 'bad');
  for (const [id] of before) if (!after.has(id) && opened(rules, s, id)) log(s, `${S[id].Name} is working again.`, 'good');
}

// Strikes: under Strike, one more station's crew walk off each day; over Back, they all return.
export function dayStrikes(rules, s) {
  const Mo = rules.content.mood || {};
  s.strikes ||= [];
  if (s.strikes.length && s.morale > num(Mo, 'Back', 30)) {
    log(s, `The strike is over: ${s.strikes.map((id) => rules.content.crew.stations[id].Name).join(', ')} back at work.`, 'good');
    s.strikes = [];
    return;
  }
  if (s.morale >= num(Mo, 'Strike', 15)) return;
  const can = stations(rules, s).filter((x) => !x.notYet && x.state !== 'striking');
  if (!can.length) return;
  const pick = can[(hashMix(hashMix(s.seed | 0, (s.day | 0) + 0x5717), lifeOf(s)) >>> 0) % can.length];
  s.strikes.push(pick.id);
  log(s, `The ${pick.name.toLowerCase()} crew walk off and fold their arms on the bridge. ${rules.content.crew.stations[pick.id].Dark}`, 'bad');
}

// A parley with the strikers: a day of talking (how 'day'), or paying them (how 'pay').
export function parleyPlan(rules, s, how) {
  const Mo = rules.content.mood || {}, n = (s.strikes || []).length;
  if (!n) return { ok: false, why: 'Nobody is on strike.' };
  if (how === 'pay') {
    const c = num(Mo, 'Pay', 40) * n;
    return (s.stores.cogmarks | 0) >= c ? { ok: true, cogmarks: c, days: 0 } : { ok: false, why: `It takes ${c} cogmarks; the Forge has ${s.stores.cogmarks | 0}.`, cogmarks: c };
  }
  return { ok: true, cogmarks: 0, days: 1 };
}

// All hands, checked at the end of a day: is every station green?
export function allHandsNow(rules, s) {
  const Mo = rules.content.mood || {}, m = moodOf(rules, s);
  if (s.morale < num(Mo, 'Content', 60) || m.mark !== 'content' || strainTotal(s) > 0 || (s.strikes || []).length || s.cold) return false;
  return stations(rules, s).every((x) => x.notYet || (x.state === 'online' && x.mood === 'content'));
}
// Returns true the day a streak reaches the song.
export function dayAllHands(rules, s) {
  const A = (s.allHands ||= { days: 0, best: 0 }), on = allHandsNow(rules, s);
  if (on) {
    A.days++;
    A.best = Math.max(A.best | 0, A.days);
    if (A.days === 1) log(s, 'All hands! Every station is green: the lamps go gold, and the bell rings.', 'good');
    return A.days === num(rules.content.allHands, 'Song', 6);
  }
  if (A.days) log(s, `All hands ends after ${A.days} day${A.days > 1 ? 's' : ''}.`, 'info');
  A.days = 0;
  return false;
}
