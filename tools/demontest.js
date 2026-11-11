// The tech demons (Milestone 21), no browser needed:  npm test
// The Wound's roster and its counters; the AI builds, attacks, falls back and rebuilds; it
// counter-builds against your fleet; Feeders starve when the wrecks are salvaged; attention rises
// and falls as specified and never forces a loss; a Hand can be outrun, shaken off or destroyed;
// infested places and their burning; determinism on demon maps; old saves.
import { rules as loadRules, makeWorld } from './headless.js';
import { makeWorldOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';
import * as Wd from '../src/galaxy/wound.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadRules();
const W = rules.content.wound;
const n = (t, k) => Array(k).fill(t);

// ---------------------------------------------------------------- 1. the roster
{
  const types = ['tick', 'stinger', 'chime', 'hound', 'gnawer', 'feeder', 'hour', 'nursery'];
  check(types.every((t) => rules.actors.has(t)), `the Wound's eight types are in the rules: ${types.join(', ')}`);
  check(['tick', 'stinger', 'chime', 'hound', 'gnawer', 'feeder'].every((t) => rules.actor(t).traitInfo('Gestation')), 'every ship an Hour can grow has its ichor and time (Gestation)');
  check(rules.actor('hour').traitInfo('Gestates') && rules.actor('hour').traitInfo('Drags') && rules.actor('hour').traitInfo('Flees') && rules.actor('nursery').traitInfo('Buds') && !rules.actor('nursery').traitInfo('Flight'), 'an Hour gestates, drags time and flees to regrow; a Nursery buds and does not move');
}

// cost-matched battles: ours on the left, the Wound's on the right
const value = (w, p) => w.actors.filter((a) => a.owner === p && a.health && !a.dead).reduce((t, a) => t + Math.trunc(((a.info.traitInfo('Valued')?.Cost || 300) * a.health.hp) / a.health.maxHp), 0);
async function battle(ours, theirs, swap = false, limit = 25 * 300) {
  const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [] }], sandbox: true, startingShips: [] });
  const A = [80 * CELL, 96 * CELL, 0], Z = [112 * CELL, 96 * CELL, 0], L = swap ? Z : A, R = swap ? A : Z;
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: ours, at: L, attack: R }), null);
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: theirs, at: R, attack: L }), null);
  const [pu, pw] = w.players, v0 = [value(w, pu), value(w, pw)];
  for (let f = 0; f < limit; f++) { w.tick(); if (f % 25 === 0 && (!value(w, pu) || !value(w, pw))) break; }
  return { us: Math.round((value(w, pu) * 100) / v0[0]), them: Math.round((value(w, pw) * 100) / v0[1]), hash: w.syncHash() };
}
{
  const M = [
    [n('picket', 6), n('tick', 15), 'us', 'Pickets (flak) beat a swarm of Ticks'],
    [n('halberd', 2), n('stinger', 9), 'them', 'Stingers beat Halberds (a lance through armour)'],
    [n('dart', 15), n('chime', 6), 'them', 'Chimes beat Darts (they ring, and small craft come apart)'],
    [n('talon', 10), n('hound', 2), 'us', 'Talons beat Hounds'],
    [n('dart', 15), n('gnawer', 1), 'us', 'Darts beat a Gnawer'],
    [n('halberd', 2), n('gnawer', 1), 'them', 'a Gnawer beats Halberds'],
  ];
  for (const [ours, theirs, who, label] of M) {
    const a = await battle(ours, theirs), b = await battle(ours, theirs, true);
    const ok = who === 'us' ? a.them === 0 && b.them === 0 && a.us > 0 && b.us > 0 : a.us === 0 && b.us === 0 && a.them > 0 && b.them > 0;
    check(ok, `${label.padEnd(56)} (ours kept ${a.us}% / ${b.us}%, theirs ${a.them}% / ${b.them}%)`);
  }
  const x = await battle([...n('dart', 6), ...n('picket', 2), 'halberd'], [...n('tick', 8), 'hound', 'stinger', 'stinger', 'chime']);
  const y = await battle([...n('dart', 6), ...n('picket', 2), 'halberd'], [...n('tick', 8), 'hound', 'stinger', 'stinger', 'chime']);
  check(x.hash === y.hash, `a mixed battle with the Wound is deterministic (hash ${x.hash.toString(16)} both runs)`);
}

// ---------------------------------------------------------------- 2. the AI on a sandbox field
// A Hour with ichor to spend, and an enemy fleet sitting far off: what does it grow?
async function grows(enemy, secs = 90, ichor = 6000) {
  const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [], ichor }], sandbox: true, startingShips: [] });
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: ['hour', 'feeder', 'feeder'], at: [150 * CELL, 96 * CELL, 0] }), null);
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: enemy, at: [30 * CELL, 96 * CELL, 0] }), null);
  for (let f = 0; f < secs * 25; f++) w.tick();
  return w.wound.report().grown;
}
{
  const fighters = await grows(n('dart', 12)), big = await grows(n('halberd', 3)), none = await grows(['gleaner']);
  check((fighters.chime | 0) >= 2 && !(fighters.stinger | 0), `against 12 Darts it grows Chimes (${JSON.stringify(fighters)})`);
  check((big.stinger | 0) >= 2 && !(big.chime | 0), `against 3 Halberds it grows Stingers (${JSON.stringify(big)})`);
  check(!(none.chime | 0) && !(none.stinger | 0) && (none.hound | 0) + (none.tick | 0) > 0, `against nothing to counter it grows its own mix (${JSON.stringify(none)})`);
}

// ---------------------------------------------------------------- 3. Feeders and the wrecks
async function feeding(cutPct) {
  const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [] }], sandbox: true, startingShips: [] });
  for (let k = 0; k < 4; k++) w.createActor('wreck', w.neutral, { x: (120 + k * 6) * CELL, y: 96 * CELL, z: 0, of: 'halberd', salvage: 1500, radius: 800 });
  // Shearers got there first: what is left of each wreck
  for (const t of w.traitsOfType('Wreck')) t.take(Math.trunc((t.salvage * cutPct) / 100));
  w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: ['feeder', 'feeder'], at: [100 * CELL, 96 * CELL, 0] }), null);
  for (let f = 0; f < 25 * 120; f++) w.tick();
  return w.wound.report().ichor.fed;
}
{
  const full = await feeding(0), cut = await feeding(90), gone = await feeding(100);
  check(full > 0 && cut * 4 < full && gone === 0, `Feeders strip wrecks for ichor (${full} in two minutes); with the wrecks salvaged first they starve (${cut} with 90% cut, ${gone} with all of it)`);
}

// ---------------------------------------------------------------- 4. a Hand on a real map
// The voyage at a wreck field, a Hand caught there, the fleet left to defend itself.
async function handMap(seed = 4, extra = [], secs = 420) {
  const s = V.newVoyage(rules, { seed }); s.queue = [];
  const g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => p.type === 'Wreck' && !p.owner).id;
  const wd = Wd.woundOf(rules, s); wd.att = 50;
  wd.hands.push({ id: 1, at: s.at, power: 160, strong: false, next: 99, caught: true });
  for (const t of extra) s.fleet.push({ type: t, hp: rules.actor(t).traitInfo('Health').HP });
  const settings = V.visitSettings(rules, s);
  const w = await makeWorld(settings);
  for (let f = 0; f < secs * 25 && !w.gameOver; f++) w.tick();
  return { s, w, settings, r: w.wound.report() };
}
{
  const a = await handMap(4, [...n('picket', 3), 'halberd', 'halberd', ...n('dart', 4)]);
  const wp = a.settings.players.find((p) => p.faction === 'wound');
  check(!!wp && a.settings.layout.encounters.some((e) => e.side === 'wound' && e.behaviour === 'hand' && e.ships[0] === 'hour'), `a caught Forge's map holds the Hand: its Hour and pack (${a.settings.layout.encounters.find((e) => e.side === 'wound').ships.length} ships) and ${wp.ichor} ichor`);
  const rel = (x, y) => a.settings.relations.find(([p, q]) => (p === x && q === y) || (p === y && q === x))?.[2];
  const wi = a.settings.players.indexOf(wp), fi = a.settings.players.findIndex((p) => p.faction === 'fauna');
  check(rel(0, wi) === 'enemy' && rel(fi, wi) === 'neutral' && a.settings.players.slice(1, fi).every((_, i) => rel(i + 1, wi) === 'enemy'), 'the Wound is everyone\'s enemy, and pays the fauna no mind');
  const r = a.r;
  check(Object.values(r.grown).reduce((t, k) => t + k, 0) >= 3 && r.waves >= 2 && r.retreats >= 1, `the AI builds (${JSON.stringify(r.grown)}), attacks in waves (${r.waves}), falls back when a wave breaks (${r.retreats}) and comes again`);
  check(r.ichor.fed > 0 && r.ichor.spent > 0, `it lives on ichor: ${r.ichor.start} to start, ${r.ichor.fed} fed from wrecks, ${r.ichor.dead} from the dead, ${r.ichor.spent} spent`);
  const b = await handMap(4, [...n('picket', 3), 'halberd', 'halberd', ...n('dart', 4)]);
  check(a.w.syncHash() === b.w.syncHash(), `a demon map is deterministic (hash ${a.w.syncHash().toString(16)} both runs)`);
  // its Hour plants Nurseries when it has the ichor
  const c = await (async () => {
    const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [], ichor: 2000, grow: 'feeder' }], sandbox: true, startingShips: [], fields: [{ name: 'Test', at: [140, 96, 0], count: 8, spread: 6, ore: [500, 600] }] });
    w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: ['hour'], at: [150 * CELL, 96 * CELL, 0] }), null);
    for (let f = 0; f < 25 * 200; f++) w.tick();
    return w.wound.report();
  })();
  check(c.planted >= 2 && c.nurseries === c.planted, `an Hour expands: it plants Nurseries on the rocks near it (${c.planted} in 200 s)`);
  // near an Hour, time drags
  {
    const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [] }], sandbox: true, startingShips: [] });
    w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: ['hour'], at: [100 * CELL, 96 * CELL, 0] }), null);
    w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: ['dart'], at: [60 * CELL, 96 * CELL, 0] }), null);
    const d = w.actors.find((a) => a.type === 'dart'), h = w.actors.find((a) => a.type === 'hour');
    const top0 = d.mobile.top;
    d.x = h.x + 6000; d.y = h.y; d.z = h.z;
    for (let f = 0; f < 30; f++) w.tick();
    check(top0 === d.mobile.info.MaxSpeed && d.mobile.top === Math.trunc((d.mobile.info.MaxSpeed * +rules.actor('hour').traitInfo('Drags').Pct) / 100), `near an Hour, time drags: a Dart flies at ${d.mobile.top} instead of ${d.mobile.info.MaxSpeed}`);
  }
  // badly hurt, an Hour runs to regrow
  {
    const w = await makeWorld({ players: [{ name: 'Us', faction: 'meridian', client: 0, ships: [] }, { name: 'The Wound', faction: 'wound', team: 1, ships: [] }], sandbox: true, startingShips: [] });
    w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 1, types: ['hour'], at: [100 * CELL, 96 * CELL, 0] }), null);
    w.resolveOrder(makeWorldOrder('SandboxSpawn', { player: 0, types: ['dart'], at: [80 * CELL, 96 * CELL, 0] }), null);
    const h = w.actors.find((a) => a.type === 'hour');
    h.health.hp = Math.trunc(h.health.maxHp / 4);
    for (let f = 0; f < 50; f++) w.tick();
    const fled = h.fleeing, hp0 = h.health.hp;
    for (let f = 0; f < 25 * 20; f++) w.tick();
    check(fled && h.health.hp > hp0 && h.x > 100 * CELL, `badly hurt, an Hour runs from its enemies and regrows (${Math.round((hp0 * 100) / h.health.maxHp)}% → ${Math.round((h.health.hp * 100) / h.health.maxHp)}% in 20 s)`);
  }
}

// ---------------------------------------------------------------- 5. an infested place
{
  const s = V.newVoyage(rules, { seed: 6 }); s.queue = [];
  const g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => (p.type === 'OreReef' || p.type === 'ScrapShoal') && !p.owner).id;
  const plain = V.visitSettings(rules, s);
  const wd = Wd.woundOf(rules, s); wd.att = 50; wd.infested[s.at] = s.day;
  const st = V.visitSettings(rules, s);
  const w = await makeWorld(st);
  const nurseries = () => w.actors.filter((a) => a.type === 'nursery' && !a.dead);
  const [lo, hi] = String(W.Nurseries).split('-').map(Number);
  check(nurseries().length >= lo && nurseries().length <= hi && st.players[0].sensorPct < plain.players[0].sensorPct && st.poi.wound.infested, `an infested place: ${nurseries().length} Nurseries on the rocks, a garrison, and the spore haze (sensors ${plain.players[0].sensorPct}% → ${st.players[0].sensorPct}%)`);
  // burn them all
  for (let f = 0; f < 50; f++) w.tick();
  const forge = w.actors.find((a) => a.has('Hangar'));
  for (const a of nurseries()) a.health.damage(forge, a.health.hp + 1, w.players[0]);
  for (let f = 0; f < 5; f++) w.tick();
  const r = w.wound.report();
  const echoes = s.campaign.echoes | 0, crew = s.crew.roles.hands;
  const att = wd.att;
  Wd.afterMap(rules, s, g, s.at, r, { note: V.note, gain: (k) => { s.crew.roles.hands += k; } });
  check(r.burned === r.planted && wd.cleansed.includes(s.at) && wd.infested[s.at] === undefined && s.campaign.echoes > echoes, `burn every Nursery and the place is clean for this life (+${s.campaign.echoes - echoes} echo${s.crew.roles.hands > crew ? `, ${s.crew.roles.hands - crew} captives rescued` : ''})`);
  check(wd.att === att + r.burned * +W.Burned, `the Mainspring notices: attention +${wd.att - att} for ${r.burned} Nurseries burned`);
  check(!Wd.mapWound(rules, s, g, s.at) || !Wd.mapWound(rules, s, g, s.at).infested, 'a place burned clean stays clean');
}

// ---------------------------------------------------------------- 6. attention
{
  const s = V.newVoyage(rules, { seed: 3 }); s.queue = [];
  const g = V.galaxyOf(rules, s), wd = s.wound;
  check(Wd.attention(rules, s).name === 'Quiet' && wd.att === 0 && !wd.hands.length, 'a first life wakes Quiet, with nothing hunting it');
  const a0 = wd.att;
  V.remember(rules, s, 'radar');
  check(wd.att === a0 + +W.Memory, `every memory recovered raises it (+${W.Memory}): the more Jacob remembers, the louder the Twain sings`);
  const a1 = wd.att, d = +W.DaysPer;
  V.passDays(rules, s, d, { transit: true });
  check(wd.att === a1 + 1, `days passing raise it, slowly (a point every ${d} days)`);
  const a2 = wd.att; wd.stay = { at: s.at, days: 0 };
  for (let k = 0; k < +W.StayFrom + 3; k++) V.rest(rules, s);
  check(wd.att - a2 >= 3, `staying long at one place raises it (+${wd.att - a2} over ${+W.StayFrom + 3} days)`);
  // silent running
  const t = V.newVoyage(rules, { seed: 3 }); t.queue = []; t.wound.att = 40;
  V.remember(rules, t, 'rods'); V.remember(rules, t, 'silent');
  const b0 = t.wound.att;
  V.passDays(rules, t, 6, { transit: true });
  check(Wd.silentRunning(rules, t) && t.wound.att < b0, `silent running lowers it (${b0} → ${t.wound.att} over 6 days)`);
  const heard = t.wound.heard, gt = V.galaxyOf(rules, t), next = gt.adj[t.at].map((li) => gt.lanes[li]).map((l) => (l.a === t.at ? l.b : l.a))[0];
  t.at = next; Wd.woundArrive(rules, t, gt, {});
  check(t.wound.heard === heard, 'and running silent, arriving somewhere is not heard (only a fight is)');
  // the Choir hides the Forge
  const choir = g.points.find((p) => p.owner === 'choir');
  if (choir) { const u = V.newVoyage(rules, { seed: 3 }); u.queue = []; u.wound.att = 40; u.at = choir.id; u.wound.stay = { at: u.at, days: 0 }; V.rest(rules, u); V.rest(rules, u); check(u.wound.att < 40, `a stay with the Choir lowers it (40 → ${u.wound.att} in two days)`); }
  // a static field stitch shakes them off
  const st = g.lanes.findIndex((l) => l.hazard === 'static');
  if (st >= 0) { const u = V.newVoyage(rules, { seed: 3 }); u.queue = []; u.wound.att = 40; u.at = g.lanes[st].b; Wd.woundArrive(rules, u, g, { lanes: [st] }); check(u.wound.att === 40 - +W.Static, `a stitch through a static field lowers it (−${W.Static}), and the Hands won't follow through one`); }
  // levels and Hands
  const h = V.newVoyage(rules, { seed: 3 }); h.queue = [];
  h.wound.att = +W.Hunted.At;
  V.passDays(rules, h, 1);
  check(Wd.attention(rules, h).name === 'Hunted' && h.wound.hands.length === 1 && rules.content.regions[V.galaxyOf(rules, h).points[h.wound.hands[0].at].region].id === W.HandFrom, `Hunted: a Hand sets out from ${W.HandFrom}`);
  h.wound.att = +W.Marked.At;
  V.passDays(rules, h, 1);
  check(Wd.attention(rules, h).name === 'Marked' && h.wound.hands.length === 2 && h.wound.hands.some((x) => x.strong), 'Marked: two Hands, one of them strong');
  // a new life wakes near what its memories earned
  const m = V.newVoyage(rules, { seed: 3 }); m.queue = [];
  for (const id of ['radar', 'emblem', 'coils', 'lens', 'spindle']) V.remember(rules, m, id);
  m.over = { reason: 'letgo', day: m.day, text: '' };
  const m2 = V.newLife(rules, m);
  check(m2.wound.att === Math.min(+W.StartMax, Object.keys(m2.campaign.memories).length * +W.StartPer) && m2.wound.att > 0 && !m2.wound.hands.length && !Object.keys(m2.wound.infested).length, `a new life wakes near the level its memories earned (${m2.wound.att} points: ${Wd.attention(rules, m2).name}), with no Hands out and nothing infested yet`);
}

// ---------------------------------------------------------------- 7. the Hands: hunting, caught, outrun, destroyed
{
  const s = V.newVoyage(rules, { seed: 9 }); s.queue = [];
  const g = V.galaxyOf(rules, s), wd = s.wound;
  // a Hand two lanes away closes in on where the Forge was heard
  const hop1 = g.adj[s.at].map((li) => g.lanes[li]).filter((l) => l.hazard !== 'static').map((l) => (l.a === s.at ? l.b : l.a))[0];
  const hop2 = g.adj[hop1].map((li) => g.lanes[li]).filter((l) => l.hazard !== 'static').map((l) => (l.a === hop1 ? l.b : l.a)).find((j) => j !== s.at && !g.adj[j].some((li) => g.lanes[li].a === s.at || g.lanes[li].b === s.at));
  wd.att = 50; wd.hands.push({ id: 9, at: hop2, power: 100, strong: false, next: s.day, caught: false });
  wd.heard = s.at;
  let caughtDay = 0;
  for (let k = 0; k < 20 && !caughtDay; k++) { V.rest(rules, s); if (Wd.caughtBy(rules, s)) caughtDay = s.day; }
  check(caughtDay > 0, `a Hand follows where the Forge was heard and catches it (day ${caughtDay})`);
  const hp = s.forge.hp;
  for (let k = 0; k < 30; k++) V.rest(rules, s);
  check(!s.over && s.forge.hp > 0 && s.forge.hp < hp, `caught, its pickets harass the Forge every day, but never end the life (hull ${hp} → ${s.forge.hp} after 30 days)`);
  // tear free
  const far = g.points.map((p) => p.id).find((j) => j !== s.at && V.plan(rules, s, j).ok && V.plan(rules, s, j).route.hops.length >= 2);
  const m0 = s.morale, hp1 = s.forge.hp;
  const esc = Wd.escapePlan(rules, s);
  V.stitch(rules, s, far);
  check(esc && !s.over && s.forge.hp < hp1 && s.morale <= m0 && !Wd.caughtBy(rules, s), `stitching away tears the Forge free, at a cost (−${esc.hull}% hull, −${esc.morale} morale, a system hit)`);
  // outrun: the Hand is slower than the Forge
  const hops = (from, to) => { const seen = new Map([[from, 0]]), q = [from]; while (q.length) { const i = q.shift(); for (const li of g.adj[i]) { const l = g.lanes[li], j = l.a === i ? l.b : l.a; if (!seen.has(j)) { seen.set(j, seen.get(i) + 1); q.push(j); } } } return seen.get(to); };
  const h = wd.hands[0];
  check(hops(h.at, s.at) >= 1 && !Wd.caughtBy(rules, s), `a Hand can be outrun: after a stitch of several lanes the Forge is ${hops(h.at, s.at)} lane${hops(h.at, s.at) > 1 ? 's' : ''} ahead of it`);
  // shaken off on a map: the Hour survived (attention back at Hunted, this Hand alone)
  wd.att = +W.Hunted.At + 5; wd.hands = [h];
  h.at = s.at; h.caught = true;
  const p0 = h.power;
  Wd.afterMap(rules, s, g, s.at, { hand: 1, hours: 0, hourPct: 50, burned: 0, nurseries: 0, planted: 0 }, { note: V.note });
  check(wd.hands.length === 1 && !h.caught && h.power < p0, `spooling out of the fight shakes it off for a while; it regrows from what its Hour kept (${p0} → ${h.power})`);
  // destroyed: gone for this life, and attention drops a step
  h.caught = true;
  const lvl = Wd.attention(rules, s).index;
  Wd.afterMap(rules, s, g, s.at, { hand: 1, hours: 1, hourPct: 0, burned: 0, nurseries: 0, planted: 0 }, { note: V.note });
  check(!wd.hands.length && wd.gone === 1 && Wd.attention(rules, s).index === lvl - 1, `kill its Hour and the Hand is destroyed: gone for the rest of the life, and attention falls a step (${['Quiet', 'Noticed', 'Hunted', 'Marked'][lvl]} → ${Wd.attention(rules, s).name})`);
  V.passDays(rules, s, 5);
  wd.att = +W.Hunted.At; V.passDays(rules, s, 2);
  check(!wd.hands.length, 'a destroyed Hand does not come back at the same level');
  // a Hand may infest the places it passes
  const t = V.newVoyage(rules, { seed: 9 }); t.queue = []; t.wound.att = +W.Marked.At;
  V.passDays(rules, t, 60, { transit: true });
  check(Object.keys(t.wound.infested).length > 0, `the Hands infest places as they go (${Object.keys(t.wound.infested).length} after 60 days Marked)`);
  // on the chart: what the sensors can see
  const seen = Wd.handsSeen(rules, t, V.galaxyOf(rules, t));
  check(seen.every((x) => x.hops <= +W.SeeHops), `the chart shows only the Hands within ${W.SeeHops} lanes (${seen.length} now)`);
}

// ---------------------------------------------------------------- 8. old saves, and roaming packs
{
  const s = V.newVoyage(rules, { seed: 2 }); s.queue = [];
  const old = JSON.parse(V.saveVoyage(s)); old.version = 9; delete old.wound;
  const back = V.loadVoyage(rules, JSON.stringify(old));
  check(back.version === V.SAVE_VERSION && back.wound && back.wound.hands.length === 0, `a save from Milestone 20 loads, its Wound waking as a new life would (attention ${back.wound.att})`);
  // Noticed: a lone pack turns up now and then in the outer regions
  const g = V.galaxyOf(rules, s), roam = Object.keys(Object.fromEntries(String(W.Roam).split(',').map((x) => x.trim().split(/\s+/))));
  s.wound.att = +W.Noticed.At;
  let seen = 0, tried = 0;
  for (const p of g.points) { if (!roam.includes(p.region) || p.trader || p.wayhouse) continue; tried++; const m = Wd.mapWound(rules, s, g, p.id); if (m && m.roam) seen++; }
  check(seen > 0 && seen < tried, `Noticed: a lone pack roams the outer regions (${seen} of ${tried} maps there)`);
  s.wound.att = 0;
  check(g.points.every((p) => !Wd.mapWound(rules, s, g, p.id)), 'Quiet: nothing of the Wound on any map');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll demon checks passed');
process.exitCode = failures ? 1 : 0;
