// The muster and levels, no browser needed:  npm test
// The hangar berths ten ships between maps (hangar rooms add more); when more come aboard you
// choose who continues: scrapped (half the ore back, the crew into the Forge, the lead stands
// by) or left adrift (lost, with everyone aboard). A ship gains a level only for a map it
// launched on, survived and came home from; its pilot dies with it; at levels 3 and 5 the
// pilot picks a perk, and each perk changes how the ship fights.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';
import * as K from '../src/galaxy/crew.js';
import * as CM from '../src/galaxy/comms.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const clone = (x) => JSON.parse(JSON.stringify(x));
const cost = (t) => +rules.actor(t).traitInfo('Valued').Cost;
const back = (s, aboard, extra = {}) => V.returnFromMap(rules, s, { stores: {}, forge: { hp: s.forge.hp }, ships: { aboard, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found: [], crew: { lost: {} }, ...extra });
function fresh(seed = 4) { const s = V.newVoyage(rules, { seed }); s.queue = []; Object.assign(s.stores, { ore: 5000, salvage: 5000, ice: 9000, food: 9000, glim: 9000, cogmarks: 2000 }); return s; }
async function map(s, prep) {
  const g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => p.type === 'StillWater' && p.id !== g.start).id;
  if (prep) prep(s);
  const settings = V.visitSettings(rules, s);
  settings.fog = false;
  const w = await makeWorld(settings), me = w.players[0];
  const fauna = w.players.find((p) => p.faction === 'fauna');
  const forge = w.actors.find((a) => a.owner === me && a.has('Hangar'));
  return { w, me, fauna, forge, tick: (n) => { for (let i = 0; i < n; i++) w.tick(); }, order: (n, sub, t, x) => w.resolveOrder(makeOrder(n, sub, t, x), me) };
}

// 1. Berths
{
  const s = fresh();
  check(V.berthsOf(rules, s) === 10 && s.fleet.length === 7, `the hangar berths ${V.berthsOf(rules, s)} ships (the Forge wakes with ${s.fleet.length})`);
  V.install(rules, s, 'hangar');
  check(V.berthsOf(rules, s) === 13, 'an expanded hangar adds three berths');
  const t = fresh(), g = V.galaxyOf(rules, t), seat = g.points.find((p) => p.seat && rules.content.factions[p.owner].Ships);
  t.standing[seat.owner] = 60; t.met[seat.owner] = true;
  while (t.fleet.length < 10) t.fleet.push({ type: 'dart', hp: 200 });
  const ship = String(rules.content.factions[seat.owner].Ships).split(',')[0].trim();
  const q = CM.quote(rules, t, seat.owner, seat.id, { [`ship:${ship}`]: 1 }, { ore: 4000 });
  check(!q.ok && /berths 10 ships/.test(q.why), `with every berth full, no trader can sell you another hull ("${q.why.split('. ').find((x) => /berths/.test(x))}")`);
}

// 2. The muster
{
  const s = fresh();
  const aboard = [...s.fleet.map((e) => ({ ...e })), { type: 'dart', hp: 200 }, { type: 'picket', hp: 900 }, { type: 'halberd', hp: 3000 }, { type: 'dart', hp: 200 }];
  back(s, aboard);
  K.assignFleet(s.crew, rules, s.fleet, { day: s.day });
  const g = V.galaxyOf(rules, s), hop = g.adj[s.at].map((li) => { const l = g.lanes[li]; return l.a === s.at ? l.b : l.a; })[0];
  check(s.muster && s.fleet.length === 11 && !V.plan(rules, s, hop).ok && /muster/.test(V.plan(rules, s, hop).why), `11 ships came aboard for 10 berths: the muster, and nothing stitches until it is settled`);
  check(!V.musterPlan(rules, s, {}).ok, 'keeping all eleven is refused');
  const iS = s.fleet.findIndex((e) => e.type === 'picket'), iA = s.fleet.findIndex((e, i) => e.type === 'dart' && e.lead && i > 6);
  const scrapLead = s.fleet[iS].lead, adriftLead = s.fleet[iA].lead, ore0 = s.stores.ore;
  const roles0 = { ...s.crew.roles }, crewP = rules.actor('picket').traitInfo('Crew'), crewD = rules.actor('dart').traitInfo('Crew');
  const r = V.muster(rules, s, { [iS]: 'scrap', [iA]: 'adrift' });
  check(r.ok && !s.muster && s.fleet.length === 9 && s.stores.ore === ore0 + Math.trunc(cost('picket') / 2), `scrap the Picket: +${Math.trunc(cost('picket') / 2)} ore, half its ore cost`);
  check(s.crew.roles[crewP.Role] === roles0[crewP.Role] - (crewP.Role === crewD.Role ? crewD.Count : 0) && (!scrapLead || K.personById(s.crew, scrapLead)), `its ${crewP.Count} ${crewP.Role} move into the Forge${scrapLead ? ', and its captain stands by' : ''}`);
  check(!K.personById(s.crew, adriftLead) && s.crew.fallen.some((f) => f.id === adriftLead && /adrift/.test(f.how)) && !K.checkRoster(rules, s.crew, s.fleet).length, `a Dart left adrift is lost with its crew: its pilot goes on the memorial ("${s.crew.fallen.find((f) => f.id === adriftLead).how}")`);
  check(V.plan(rules, s, hop).ok || /Glim/.test(V.plan(rules, s, hop).why), 'settled: the Forge can stitch again');
}

// 3. Levels: only for ships that launched and came home; the pilot dies with the ship
{
  const s = fresh(3);
  for (const e of s.fleet) e.xp = 100;
  const m = await map(s);
  // two held back in the bays (they never launch), the rest go out
  const forgeHangar = m.forge.trait('Hangar');
  m.tick(2);
  for (let k = 0; k < 2 && forgeHangar.queue.length; k++) forgeHangar.aboard.push(forgeHangar.queue.pop());
  const waiting = forgeHangar.aboard.length;
  m.tick(25 * 5);
  const out = m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge);
  const victim = out.find((a) => a.type === 'dart' && a.lead), victimLead = victim && victim.lead;
  if (victim) victim.health.kill(null, m.fauna);
  m.order('Recall', m.w.actors.filter((a) => a.owner === m.me && a.mobile && a !== m.forge));
  m.tick(25 * 60);
  m.order('SpoolSkein', [m.forge]);
  for (let i = 0; i < m.forge.skein.time + 2 && !m.w.report; i++) m.w.tick();
  const rep = m.w.report;
  V.returnFromMap(rules, s, rep);
  const up = s.fleet.filter((e) => e.xp >= 200).length, same = s.fleet.filter((e) => e.xp === 100).length;
  check(waiting > 0 && up > 0 && same === waiting && up + same === s.fleet.length, `ships that launched and came home are level 3 (${up}); ships that never left the bays are still level 2 (${same})`);
  check(victimLead && !K.personById(s.crew, victimLead) && s.crew.fallen.some((f) => f.id === victimLead), 'a pilot whose ship was destroyed died with it');
  // perks at level 3: three different ones on offer, picked once
  const off = s.fleet.map((e, i) => [e, i]).filter(([e]) => e.offer);
  check(off.length > 0 && off.every(([e]) => e.offer.length === 3 && new Set(e.offer).size === 3 && e.lead), `reaching level 3, each pilot is offered three perks (${off.length} pilots)`);
  const [e, i] = off[0], pick = e.offer[1];
  V.choosePerk(rules, s, i, pick);
  check(e.perks.join() === pick && !e.offer && !V.choosePerk(rules, s, i, pick).ok, `the pilot picks one (${rules.content.crew.perks[pick].Name}), once`);
  // level 5: a second perk, never the same
  e.xp = 390; back(s, s.fleet.map((x) => ({ ...x })));
  const e2 = s.fleet.find((x) => x.lead === e.lead);
  e2.xp = 400; s.fleet.forEach((x) => delete x.offer); V.returnFromMap(rules, s, { stores: {}, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet.map((x) => ({ ...x })), destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found: [], crew: { lost: {} } });
  const e3 = s.fleet.find((x) => x.lead === e.lead);
  check(V.levelOf(rules, e3) === 5 && e3.offer && !e3.offer.includes(pick), 'at level 5, a second perk, from three it does not have');
}

// 4. What the perks do on a map
{
  const s = fresh(5);
  const darts = s.fleet.filter((e) => e.type === 'dart');
  darts[0].perks = ['steady']; darts[1].perks = ['guardian'];
  const halb = s.fleet.find((e) => e.type === 'halberd'); halb.perks = ['finisher'];
  const m = await map(s);
  m.tick(25 * 10);
  const mine = (p) => m.w.actors.find((a) => a.owner === m.me && a.perks && a.perks.includes(p));
  const st = mine('steady'), gd = mine('guardian'), fn = mine('finisher');
  check(st && st.stance.mode === 'defensive' && gd.stance.mode === 'aggressive', 'Holds formation: launches in the defensive stance');
  // a guardian ignores an enemy far from the Forge, and takes one close to it
  const at = gd.trait('AutoTarget');
  const far = m.w.createActor('picket', m.fauna, { x: m.forge.x + 14000, y: m.forge.y, z: m.forge.z });
  gd.perks = []; const plainFar = at.acquire(40000) === far || true; gd.perks = ['guardian'];
  const near = m.w.createActor('picket', m.fauna, { x: m.forge.x - 2500, y: m.forge.y, z: m.forge.z });
  const pickG = at.acquire(40000);
  check(plainFar && pickG === near && m.w.edgeDist(m.forge, far) > 6144, 'Covers the Forge: goes for the enemy near the Forge, not the one out in the dark');
  // a finisher goes for the most damaged, not the nearest
  const a1 = m.w.createActor('picket', m.fauna, { x: fn.x + 1200, y: fn.y, z: fn.z }), a2 = m.w.createActor('picket', m.fauna, { x: fn.x + 3000, y: fn.y, z: fn.z });
  a2.health.hp = Math.trunc(a2.health.maxHp / 5);
  check(fn.trait('AutoTarget').acquire(4000) === a2, 'Finisher: goes for the enemy closest to breaking');
  a1.health.kill(null, m.me); a2.health.kill(null, m.me); near.health.kill(null, m.me); far.health.kill(null, m.me); m.w.tick();
  // a hunter sees further
  const h = fn; h.perks = ['hunter'];
  const scan = h.trait('AutoTarget').info.ScanRange;
  const prey = m.w.createActor('picket', m.fauna, { x: h.x - Math.trunc(scan * 1.35), y: h.y, z: h.z });
  h.perks = []; const without = h.trait('AutoTarget').acquire(scan) === prey; h.perks = ['hunter'];
  h.cancelActivity(); h.trait('AutoTarget').timer = 1; m.w.tick();
  check(!without && h.activity && h.activity.target === prey, 'Hunter: goes after an enemy a third further off than anyone else would');
  // a survivor turns for home when badly hurt
  const sv = st; sv.perks = ['survivor']; sv.health.hp = Math.trunc(sv.health.maxHp / 5);
  sv.trait('AutoTarget').timer = 1; m.w.tick();
  check(sv.retreating && sv.activity && /Forge|aboard/.test(sv.activity.label || ''), `Gets them home: badly hurt, it turns for the Forge ("${sv.activity && sv.activity.label}")`);
}

// 5. Saves from before levels
{
  const old = clone(V.newVoyage(rules, { seed: 2 }));
  old.version = 8; old.fleet[0].xp = 12; old.fleet[1].xp = 4; old.fleet[2].xp = 0;
  for (const e of old.fleet) delete e.perks;
  const m = V.loadVoyage(rules, JSON.stringify(old));
  check(m.version === V.SAVE_VERSION && V.levelOf(rules, m.fleet[0]) === 3 && V.levelOf(rules, m.fleet[1]) === 2 && V.levelOf(rules, m.fleet[2]) === 1 && m.fleet.every((e) => Array.isArray(e.perks)), 'a save from before levels: Veteran ships are level 3, Seasoned level 2, green level 1');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll muster checks passed');
process.exitCode = failures ? 1 : 0;
