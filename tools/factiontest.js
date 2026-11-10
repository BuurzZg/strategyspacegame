// Factions and reputation, no browser needed:  npm test
// The standing maths (tiers, race standing, meeting a faction); territory and stations in the
// galaxy; on maps, behaviour follows the tier (hostile attacks, wary warns then fires, neutral
// ignores until fired on, friendly turns on your attackers, allied comes to guard the Forge);
// firing, kills and helping change standing; stealing costs standing only when it is seen and
// you have no leave; and an add-on pack adds a faction with no code.
import { rules as loadCore, makeWorld, readText } from './headless.js';
import { loadRules } from '../src/engine/rules.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, distSq3 } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';
import { generateGalaxy } from '../src/galaxy/galaxy.js';
import { tierName, standingOf, raceStanding, meet, change, hasLeave } from '../src/galaxy/standing.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const F = rules.content.factions;

// 1. The standing maths
{
  const names = [-100, -51, -50, -11, -10, 0, 24, 25, 59, 60, 100].map((n) => `${n} ${tierName(rules, n)}`);
  check(names.join(', ') === '-100 Hostile, -51 Hostile, -50 Wary, -11 Wary, -10 Neutral, 0 Neutral, 24 Neutral, 25 Friendly, 59 Friendly, 60 Allied, 100 Allied', `five tiers: ${names.join(', ')}`);
  const s = V.newVoyage(rules, { seed: 4 });
  const start = Object.keys(F).map((f) => `${F[f].Name} ${standingOf(rules, s, f)} (${tierName(rules, standingOf(rules, s, f))})`);
  check(standingOf(rules, s, 'rivet') === 30 && standingOf(rules, s, 'gaunt') === -60 && standingOf(rules, s, 'cinder') === -20, `where you start: ${start.join(', ')}`);
  meet(rules, s, 'rivet');
  const t = change(rules, s, 'rivet', -15);
  check(s.standing.rivet === 15 && t && t.from === 'Friendly' && t.to === 'Neutral', 'firing on the Rivet Moot once and killing nothing: 30 → 15, Friendly → Neutral');
  change(rules, s, 'rivet', -500);
  check(s.standing.rivet === -100, 'standing never goes below -100');
}

// 2. Race standing, and an add-on pack's faction (no code: YAML only)
{
  const packRules = await loadRules(readText, ['core', 'example-pack']);
  const pf = packRules.content.factions;
  check(!!pf.lamp && pf.lamp.Race === 'hullborn', 'the example pack adds the Lamplighters, a second Hullborn faction, in YAML');
  const s = V.newVoyage(packRules, { seed: 6 });
  check(standingOf(packRules, s, 'lamp') === +packRules.content.races.hullborn.Standing, `unmet, with no Hullborn met, they start at the Hullborn standing (${standingOf(packRules, s, 'lamp')})`);
  meet(packRules, s, 'rivet');
  change(packRules, s, 'rivet', -40); // the Rivet Moot are now at -10
  check(raceStanding(packRules, s, 'hullborn') === -10 && standingOf(packRules, s, 'lamp') === -10, 'once you have met the Rivet Moot, the Lamplighters start where you stand with the Hullborn (the average of the Hullborn you have met: -10)');
  meet(packRules, s, 'lamp');
  change(packRules, s, 'rivet', 50);
  check(s.standing.lamp === -10, 'and once met, their standing is their own');
  const g = generateGalaxy(packRules, 6);
  const seat = g.points.find((p) => p.seat && p.owner === 'lamp');
  check(!!seat && seat.type === 'HullTown' && g.points.filter((p) => p.owner === 'lamp').length > 1, `the galaxy gives them a seat (${seat && seat.name}) and territory round it`);
  s.at = seat.id;
  const w = await makeWorld(V.visitSettings(packRules, s));
  const lamp = w.players.find((p) => p.faction === 'lamp');
  const station = w.actors.find((a) => a.station);
  check(!!lamp && station && station.owner === lamp && w.actors.some((a) => a.owner === lamp && a.mobile), 'on the map, their station and their patrol fly their colours');
}

// 3. Territory and stations
{
  const g = generateGalaxy(rules, 9);
  const seats = {}, claimed = {};
  for (const p of g.points) { if (p.seat) seats[p.owner] = (seats[p.owner] || 0) + 1; if (p.owner) claimed[p.owner] = (claimed[p.owner] || 0) + 1; }
  const want = Object.fromEntries(Object.values(F).map((f) => [f.id, String(f.Seats).split(',').reduce((n, x) => n + (+x.trim().split(/\s+/)[1] || 0), 0)]));
  check(JSON.stringify(Object.keys(want).map((k) => seats[k] || 0)) === JSON.stringify(Object.values(want)), `each faction's seats as listed: ${Object.entries(seats).map(([k, n]) => `${F[k].Name} ${n}`).join(', ')}`);
  check(!g.points[g.start].owner && g.points.filter((p) => p.seat).every((p) => p.type === F[p.owner].Station), `stations are their faction's place type; the start is nobody's; ${Object.entries(claimed).map(([k, n]) => `${k} claims ${n}`).join(', ')}`);
}

// A map at a faction's seat, with that faction at a given standing.
async function at(fid, standing, { seed = 9, more = {} } = {}) {
  const s = V.newVoyage(rules, { seed });
  const g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => p.seat && p.owner === fid).id;
  meet(rules, s, fid); s.standing[fid] = standing;
  const settings = V.visitSettings(rules, s);
  // other factions passing through (hostile to you, not at war with the owner unless they say so)
  for (const [k, n] of Object.entries(more)) {
    meet(rules, s, k); s.standing[k] = n;
    const i = settings.players.length;
    settings.players.push({ name: F[k].Name, faction: k, team: i, ships: [], tier: 0, standing: n });
    settings.relations.push([0, i, 'enemy']);
    settings.players.forEach((p, j) => { if (j > 0 && j < i) settings.relations.push([j, i, p.faction === 'fauna' ? 'enemy' : 'neutral']); });
  }
  const w = await makeWorld(settings), me = w.players[0];
  const them = w.players.find((p) => p.faction === fid);
  const station = w.actors.find((a) => a.station);
  const notes = [];
  const tick = (n) => { for (let i = 0; i < n; i++) { w.tick(); for (const e of w.fxEvents) if (e.t === 'notify') notes.push(e.text); w.fxEvents.length = 0; } };
  const order = (name, subjects, target, extra) => w.resolveOrder(makeOrder(name, subjects, target, extra), me);
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  return { s, w, me, them, station, tick, order, notes, forge, settings };
}
// put a ship of mine at a distance from the station
const park = (a, st, cells) => { a.x = st.x + cells * CELL; a.y = st.y; a.z = st.z; a.cancelActivity(); a.activity = null; };

// 4. Behaviour follows the tier
{
  // Hostile: a Gaunt den opens fire on a Dart that comes close
  const h = await at('gaunt', -80);
  h.tick(25 * 8);
  const dart = h.w.actors.find((a) => a.owner === h.me && a.type === 'dart');
  park(dart, h.station, 8);
  const hp0 = dart.health.hp;
  h.tick(25 * 10);
  check(h.me.isEnemy(h.them) && (dart.dead || dart.health.hp < hp0), 'Hostile: the Ashen Gaunt fire on a Dart that comes near their den');

  // Wary: warns you off, then fires if you linger
  const wy = await at('rivet', -30);
  wy.tick(25 * 8);
  const d2 = wy.w.actors.find((a) => a.owner === wy.me && a.type === 'dart');
  park(d2, wy.station, 12);
  wy.tick(25 * 3);
  const warned = wy.notes.some((t) => /Keep your distance/.test(t)), peaceful = !wy.me.isEnemy(wy.them);
  park(d2, wy.station, 7);
  wy.tick(25 * 24);
  check(warned && peaceful && wy.me.isEnemy(wy.them) && wy.notes.some((t) => /We warned you/.test(t)), 'Wary: the Rivet Moot warn a Dart off, and open fire when it lingers close for 20 seconds');

  // Neutral: ignores you until you fire on it; then it is war, and it costs standing
  const n = await at('rivet', 0);
  n.tick(25 * 8);
  const d3 = n.w.actors.find((a) => a.owner === n.me && a.type === 'dart');
  park(d3, n.station, 6);
  n.tick(25 * 30);
  const ignored = !n.me.isEnemy(n.them) && !d3.dead && d3.health.hp === d3.health.maxHp;
  const picket = n.w.actors.find((a) => a.owner === n.them && a.type === 'picket');
  const hal = n.w.actors.find((a) => a.owner === n.me && a.type === 'halberd');
  park(hal, picket, 3);
  n.order('Attack', [hal], { actor: picket });
  n.tick(25 * 20);
  const rep = n.w.diplomacy.report();
  check(ignored && n.me.isEnemy(n.them) && rep.changes.rivet && rep.changes.rivet.reasons['fired on'] <= -10, `Neutral: the Rivet Moot ignore a Dart beside their town, until a Halberd fires on them (standing ${rep.changes.rivet && rep.changes.rivet.delta})`);

  // Friendly: they turn on whoever attacks your ships near them
  const fr = await at('rivet', 40, { more: { cinder: -80 } });
  fr.tick(25 * 8);
  const cinder = fr.w.players.find((p) => p.faction === 'cinder') || null;
  let turned = false;
  if (cinder) {
    const d4 = fr.w.actors.find((a) => a.owner === fr.me && a.type === 'dart');
    park(d4, fr.station, 6);
    const raider = fr.w.createActor('talon', cinder, { x: d4.x + 1500, y: d4.y, z: d4.z });
    d4.health.damage(raider, 100, cinder);
    turned = fr.w.relationOf(fr.them, cinder) === 'enemy';
  }
  check(turned, 'Friendly: when Cinder Pact raiders attack your Dart by a Rivet town, the Rivet Moot turn on them');

  // Allied: allies from the start, and their patrol comes to guard the Forge
  const al = await at('rivet', 70);
  const pat = al.w.actors.filter((a) => a.owner === al.them && a.mobile);
  const d0 = Math.min(...pat.map((a) => distSq3(a.x, a.y, a.z, al.forge.x, al.forge.y, al.forge.z)));
  al.tick(25 * 40);
  const d1 = Math.min(...pat.filter((a) => !a.dead).map((a) => distSq3(a.x, a.y, a.z, al.forge.x, al.forge.y, al.forge.z)));
  check(al.me.isAlly(al.them) && d1 < d0 / 2, 'Allied: the Rivet Moot are allies, and their patrol flies to the Forge to guard it');
}

// 5. Kills and help change standing
{
  const k = await at('rivet', 0, { seed: 11 });
  k.tick(25 * 8);
  const picket = k.w.actors.find((a) => a.owner === k.them && a.type === 'picket');
  picket.health.damage(null, picket.health.hp + 1, k.me);
  k.tick(2);
  const r = k.w.diplomacy.report().changes.rivet;
  check(r && r.reasons.destroyed === -25 && r.reasons['fired on'] === -10, `destroying a Rivet picket: −10 for firing, −25 for the kill (${r && r.delta})`);
  // killing the Gaunt where the Rivet Moot can see it
  const hp = await at('rivet', 30, { seed: 11 });
  hp.tick(25 * 4);
  const gaunt = hp.w.players.find((p) => p.faction === 'gaunt');
  let helped = null;
  if (gaunt) {
    for (let i = 0; i < 12; i++) { const g = hp.w.createActor('dart', gaunt, { x: hp.station.x + 5 * CELL, y: hp.station.y + i * 600, z: hp.station.z }); g.health.damage(null, g.health.hp + 1, hp.me); }
    hp.tick(2);
    helped = hp.w.diplomacy.report().changes.rivet;
  }
  check(!gaunt || (helped && helped.delta === +rules.content.reputation.HelpMax), `killing Gaunt raiders where the Rivet Moot can see it: +2 each, at most +${rules.content.reputation.HelpMax} a visit${gaunt ? ` (${helped && helped.delta})` : ' (no Gaunt here)'}`);
}

// 6. Stealing: costs standing per load when seen and you have no leave; the first is a warning
async function skim(fid, standing, { hide = false } = {}) {
  const m = await at(fid, standing, { seed: 13 });
  m.tick(25 * 6);
  if (hide) for (const a of m.w.actors) if (a.owner === m.them) { a.health.kill(null, null); }
  m.tick(2);
  const cloud = m.w.actors.filter((a) => a.cloud && !a.dead).sort((a, b) => distSq3(a.x, a.y, a.z, m.forge.x, m.forge.y, m.forge.z) - distSq3(b.x, b.y, b.z, m.forge.x, m.forge.y, m.forge.z))[0];
  const sk = m.w.actors.find((a) => a.owner === m.me && a.type === 'skimmer');
  // every cloud where the station can see it
  if (!hide && m.station) m.w.actors.filter((a) => a.cloud && !a.dead).forEach((c, i) => { c.x = m.station.x + (8 + (i % 3) * 2) * CELL; c.y = m.station.y + (i - 2) * 3 * CELL; c.z = m.station.z; });
  m.order('Harvest', [sk], { actor: cloud });
  m.tick(25 * 300);
  return { rep: m.w.diplomacy.report().changes[fid], notes: m.notes, m };
}
{
  const seen = await skim('synod', 0);
  check(seen.notes.some((t) => /our claim/.test(t)) && seen.rep && seen.rep.reasons['took from their claim'] < 0, `skimming at a Synod refinery in full view, with no leave: a warning, then ${seen.rep && seen.rep.reasons['took from their claim']} standing for the loads after it`);
  const unseen = await skim('synod', 0, { hide: true });
  check(!unseen.rep || !unseen.rep.reasons['took from their claim'], 'with nobody there to see it, nothing is noticed');
  const leave = await skim('synod', 30);
  check(hasLeave(rules, leave.m.s, 'synod') && (!leave.rep || !leave.rep.reasons['took from their claim']), 'Friendly with the Synod, you have leave: skimming their clouds costs nothing');
  // and the voyage keeps it
  const s = seen.m.s, before = s.standing.synod;
  for (let i = 0; i < 25 * 80 && !seen.m.w.report; i++) seen.m.w.tick();
  const f = seen.m.forge;
  seen.m.order('SpoolSkein', [f]);
  for (let i = 0; i < f.skein.time + 2; i++) seen.m.w.tick();
  V.returnFromMap(rules, s, seen.m.w.report);
  check(s.standing.synod === before + seen.m.w.report.standing.changes.synod.delta && s.log.some((l) => /Lantern Synod: -/.test(l.text)), `back on the chart, the voyage remembers: the Lantern Synod ${before} → ${s.standing.synod}`);
}

// 7. Determinism with factions on the map
async function sameVisit() {
  const m = await at('rivet', 0, { seed: 17 });
  m.tick(25 * 10);
  const hal = m.w.actors.find((a) => a.owner === m.me && a.type === 'halberd'), picket = m.w.actors.find((a) => a.owner === m.them && a.type === 'picket');
  park(hal, picket, 3);
  m.order('Attack', [hal], { actor: picket });
  m.tick(25 * 40);
  return m.w.syncHash();
}
{
  const a = await sameVisit(), b = await sameVisit();
  check(a === b, `deterministic (hash ${a.toString(16)} both runs)`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll faction checks passed');
process.exitCode = failures ? 1 : 0;
