// Events, monsters and the story, no browser needed:  npm test
// Every event validates and can happen; triggers fire the right events, deterministically, and
// story events once; event effects (rolls, ambushes, monsters, drive parts, days) work; the
// Scrapwyrm hides and ambushes, rust mites hatch from wrecks, the Hollowhorn's song shakes a
// spooling Skein loose; the Choir and the Gaunt offer other ways to the Lens and the Spindle; and
// a scripted voyage, answering every event, reaches the ending.
import { rules as loadCore, makeWorld } from './headless.js';
import { makeOrder } from '../src/engine/order.js';
import { CELL, distSq3 } from '../src/engine/math.js';
import * as V from '../src/galaxy/voyage.js';
import * as C from '../src/galaxy/comms.js';
import { trigger } from '../src/galaxy/events.js';
import { meet } from '../src/galaxy/standing.js';
import { captain, resolveEvents } from './captain.js';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const rules = await loadCore();
const E = rules.content.events;
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

// 1. Every event validates, can happen somewhere, and every node and choice in it can be reached
{
  const errs = [];
  for (const e of Object.values(E)) {
    errs.push(...C.lintDialog(rules, e));
    for (const x of list(e.If)) if (C.parseCond(x).op === 'bad') errs.push(`${e.id}: unknown condition "${x}"`);
  }
  check(!errs.length, `all ${Object.keys(E).length} events validate${errs.length ? `: ${errs.join('; ')}` : ''}`);
  // can each happen? try every place in a galaxy, with drive parts missing, found and fitted,
  // early and late, with and without each flag
  const s0 = V.newVoyage(rules, { seed: 3 }), g = V.galaxyOf(rules, s0);
  const flags = [...new Set(Object.values(E).flatMap((e) => list(e.If).map(C.parseCond).filter((c) => c.op === 'flag').map((c) => c.flag)))];
  // and a crew that has lost people, with every officer's trait and every trait that events ask for
  const sx = JSON.parse(JSON.stringify(s0)), conds = [];
  for (const e of Object.values(E)) { conds.push(...list(e.If).map(C.parseCond)); for (const n of Object.values(e)) if (n && typeof n === 'object') for (const c of Object.values(n)) if (c && c.If) conds.push(...list(c.If).map(C.parseCond)); }
  sx.crew.fallen = [1, 2, 3].map((i) => ({ id: 900 + i, name: `Lost ${i}`, role: 'hands', post: '', trait: 'steady', day: 1, how: 'lost' }));
  for (const c of conds) {
    if (c.op === 'officer' && c.trait) sx.crew.people.find((p) => p.post === c.post).trait = c.trait;
    if (c.op === 'trait') sx.crew.people.push({ id: 950 + sx.crew.people.length, name: `Someone ${c.trait}`, role: 'hands', post: '', trait: c.trait });
  }
  // and a later life of the campaign
  const sl = JSON.parse(JSON.stringify(s0)); sl.campaign.life = 2;
  // and a happy ship, six days into All hands
  const sa = JSON.parse(JSON.stringify(s0)); sa.allHands = { days: 6, best: 6 };
  const states = [];
  for (const base of [s0, sx, sl, sa]) for (const items of [{}, { coils: 'found', lens: 'found', spindle: 'found', heartstone: 'found' }]) for (const day of [1, 30]) for (const fl of [[], flags]) states.push({ ...base, items, day, flags: fl });
  // and the story memories (Milestone 22): everything remembered but one, for each one
  for (const id of Object.keys(rules.content.memories)) {
    const memories = Object.fromEntries(Object.keys(rules.content.memories).filter((k) => k !== id).map((k) => [k, { life: 1, day: 1 }]));
    for (const fl of [[], flags]) states.push({ ...s0, campaign: { ...s0.campaign, memories }, day: 30, flags: fl });
  }
  const unreachable = [];
  let choices = 0;
  for (const e of Object.values(E)) {
    const conds = list(e.If).map(C.parseCond);
    const can = g.points.some((p) => states.some((st) => C.conditionsHold(V.eventContext(rules, { ...st, at: p.id }, g, e), conds)));
    if (!can) unreachable.push(e.id);
    // nodes and choices, from Start, following Goto and rolls
    const seen = new Set([e.Start]), queue = [e.Start], picked = new Set();
    while (queue.length) {
      const id = queue.shift();
      for (const c of [s0, sx, sl].flatMap((st) => C.nodeView(V.eventContext(rules, st, g, e), id).choices)) {
        picked.add(`${id}.${c.id}`);
        const next = [c.goto, ...c.effects.filter((x) => x.op === 'roll').flatMap((x) => [x.yes, x.no])].filter(Boolean);
        for (const n of next) if (!seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    for (const [k, n] of Object.entries(e)) {
      if (!k.startsWith('Node@')) continue;
      if (!seen.has(k.slice(5))) unreachable.push(`${e.id}.${k.slice(5)}`);
      for (const ck of Object.keys(n)) if (ck.startsWith('Choice@')) { choices++; if (!picked.has(`${k.slice(5)}.${ck.slice(7)}`)) unreachable.push(`${e.id}.${k.slice(5)}.${ck.slice(7)}`); }
    }
  }
  check(!unreachable.length, `every event can happen, and every node and every one of the ${choices} choices can be reached${unreachable.length ? `; not: ${unreachable.join(', ')}` : ''}`);
}

// 2. Triggers
{
  const s = V.newVoyage(rules, { seed: 5 }), g = V.galaxyOf(rules, s);
  check(s.queue[0] === 'Prologue', 'a new voyage opens with the prologue');
  resolveEvents(rules, s);
  check(!s.queue.length && s.seen.includes('Prologue'), 'answered, it is gone, and it never comes back');
  trigger(rules, s, g, 'start');
  check(!s.queue.length, 'story events happen once');
  // the Coils' storyline: arriving at their derelict, then remembering them as the cutters find them
  s.at = g.components.coils;
  trigger(rules, s, g, 'arrive');
  const arrive = [...s.queue];
  resolveEvents(rules, s);
  V.returnFromMap(rules, s, { stores: {}, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: 100, found: ['coils'], crew: { lost: {} } });
  const found = [...s.queue];
  resolveEvents(rules, s);
  check(arrive.includes('CoilsHere') && found.includes('CoilsFound') && V.remembers(s, 'coils') && V.drive(rules, s).range === 150, `the Coils' storyline: ${arrive.join(', ')} → ${found.join(', ')}, and the drive reaches 150 spans at once`);
  // chance events: deterministic, and at most one per trigger
  const runs = () => { const t = V.newVoyage(rules, { seed: 7 }), gg = V.galaxyOf(rules, t); t.queue = []; const out = []; for (let d = 0; d < 60; d++) { t.day = d + 2; t.at = (d * 37) % gg.points.length; out.push(trigger(rules, t, gg, 'travel').join('+') || '-'); } return out; };
  const a = runs(), b = runs();
  const most = Math.max(...a.map((x) => (x === '-' ? 0 : x.split('+').length)));
  check(JSON.stringify(a) === JSON.stringify(b) && most <= 1 && a.some((x) => x !== '-'), `travel events are the same for the same voyage, never more than one at a time (${a.filter((x) => x !== '-').length} in 60 stitches: ${[...new Set(a.filter((x) => x !== '-'))].join(', ')})`);
}

// 3. Event effects: a distress call that is a trap, a monster waiting, days passing
{
  const s = V.newVoyage(rules, { seed: 9 }), g = V.galaxyOf(rules, s);
  s.queue = [];
  s.at = g.points.find((p) => p.type === 'ScrapShoal').id;
  const ev = E.DistressCall;
  // find a roll that springs the trap (deterministic, so try a few days)
  let trap = false;
  for (let d = 3; d < 40 && !trap; d++) {
    const t = JSON.parse(JSON.stringify(s)); t.day = d;
    const r = V.eventChoice(rules, t, C.nodeView(V.eventContext(rules, t, g, ev), 'call').choices.find((c) => c.id === 'help').effects);
    if (r.goto === 'trap') {
      V.eventChoice(rules, t, C.nodeView(V.eventContext(rules, t, g, ev), 'trap').choices[0].effects);
      const settings = V.visitSettings(rules, t);
      trap = settings.players.some((p) => p.faction === 'gaunt') && settings.layout.encounters.some((e) => e.side === 'gaunt' && e.behaviour === 'hunt');
    }
  }
  check(trap, 'a distress call can be a lure: the Ashen Gaunt are waiting on the next map there, and hunt the Forge');
  const u = V.newVoyage(rules, { seed: 9 });
  u.at = g.points.find((p) => p.type === 'OreReef').id;
  V.eventChoice(rules, u, C.nodeView(V.eventContext(rules, u, g, E.WyrmSign), 'sign').choices[0].effects);
  const st = V.visitSettings(rules, u);
  check(st.layout.encounters.some((e) => e.ships.includes('wyrm') && e.behaviour === 'burrow'), 'a sign of a Scrapwyrm: one lies buried in a rock field on the next map');
  const day0 = u.day;
  V.eventChoice(rules, u, C.nodeView(V.eventContext(rules, u, g, E.CometStorm), 'storm').choices.find((c) => c.id === 'wait').effects);
  check(u.day === day0 + 1, 'waiting out a comet storm costs a day');
  // stitching away leaves an ambush behind
  const li = g.adj[u.at].find((i) => g.lanes[i].len <= 100);
  const to = g.lanes[li].a === u.at ? g.lanes[li].b : g.lanes[li].a;
  V.stitch(rules, u, to);
  check(!(u.ahead || []).some((a) => a.at !== u.at), 'and whatever was waiting there is gone once the Forge leaves');
}

// 4. Monsters
async function mapWith(type, extra) {
  const s = V.newVoyage(rules, { seed: 11 }), g = V.galaxyOf(rules, s);
  s.at = g.points.find((p) => p.type === type).id;
  const settings = V.visitSettings(rules, s);
  if (extra) extra(settings);
  const w = await makeWorld(settings), me = w.players[0];
  const tick = (n) => { for (let i = 0; i < n; i++) w.tick(); };
  return { w, me, tick, forge: w.actors.find((a) => a.owner === me && a.has('Hangar')), order: (n, sub, t, x) => w.resolveOrder(makeOrder(n, sub, t, x), me) };
}
{
  // the Scrapwyrm: buried in a field, unseen and untargetable, until something comes close
  const m = await mapWith('OreReef', (st) => { st.layout.encounters.push({ side: 'fauna', ships: ['wyrm'], at: st.fields[0].at.map((v) => v * CELL), behaviour: 'burrow', delay: 0 }); });
  m.tick(25 * 5);
  const wyrm = m.w.actors.find((a) => a.type === 'wyrm');
  const dart = m.w.actors.find((a) => a.owner === m.me && a.type === 'dart');
  const hidden = wyrm.burrowed && !dart.attack.canTarget(wyrm);
  dart.x = wyrm.x + 4500; dart.y = wyrm.y; dart.z = wyrm.z; dart.cancelActivity(); dart.activity = null;
  const hp0 = dart.health.hp;
  m.tick(25 * 8);
  const struck = !wyrm.burrowed && (dart.dead || dart.health.hp < hp0);
  // everyone else is gone; alone, it goes back under
  for (const a of m.w.actors) if (a.owner === m.me && a.mobile && !a.dead && a !== m.forge) a.health.kill(null, null);
  m.tick(25 * 60);
  check(hidden && struck && wyrm.burrowed, 'a Scrapwyrm lies buried and untargetable, strikes at a Dart that comes close, and burrows again when it is alone');
}
{
  // rust mites: cutting an infested wreck hatches them, and they eat hulls
  const m = await mapWith('ScrapShoal', (st) => { for (const k of st.layout.wrecks) k.infested = true; });
  m.tick(25 * 6);
  const wreck = m.w.actors.find((a) => a.wreck && a.wreck.infested);
  const sh = m.w.actors.find((a) => a.owner === m.me && a.type === 'shearer');
  m.order('Harvest', [sh], { actor: wreck });
  let mites = [];
  for (let i = 0; i < 25 * 200 && !mites.length; i++) { m.w.tick(); mites = m.w.actors.filter((a) => a.type === 'mites'); }
  const before = m.w.actors.filter((a) => a.owner === m.me && a.health).reduce((t, a) => t + a.health.hp, 0);
  m.tick(25 * 20);
  const after = m.w.actors.filter((a) => a.owner === m.me && a.health && !a.dead).reduce((t, a) => t + a.health.hp, 0);
  check(mites.length >= 3 && after < before, `a Shearer cutting an infested wreck hatches ${mites.length} rust mite swarms, and they chew on the fleet`);
}
{
  // the Hollowhorn's song: near it, the Skein will not spool; far away, it will
  const near = await mapWith('HollowhornGrounds');
  const horn = near.w.actors.find((a) => a.type === 'hollowhorn');
  horn.x = near.forge.x + 15 * CELL; horn.y = near.forge.y; horn.z = near.forge.z;
  for (const a of near.w.actors) if (a.owner === near.me && a.mobile && a !== near.forge) { a.health.kill(null, null); }
  near.tick(3);
  near.order('SpoolSkein', [near.forge]);
  near.tick(near.forge.skein.time + 50);
  const shaken = !near.w.departed && near.forge.skein.spool < near.forge.skein.time;
  const far = await mapWith('HollowhornGrounds');
  const h2 = far.w.actors.find((a) => a.type === 'hollowhorn');
  h2.x = far.forge.x + 120 * CELL; h2.y = far.forge.y; if (h2.mobile) h2.cancelActivity();
  for (const a of far.w.actors) if (a.owner === far.me && a.mobile && a !== far.forge) a.health.kill(null, null);
  far.tick(3);
  far.order('SpoolSkein', [far.forge]);
  for (let i = 0; i < far.forge.skein.time + 50 && !far.w.departed; i++) far.w.tick();
  check(shaken && !!far.w.departed, 'the Hollowhorn\'s song shakes a spooling Skein loose while it is near; far from it, the Forge gets away');
}

// 5. Other ways to the Lens and the Spindle
{
  const s = V.newVoyage(rules, { seed: 13 }), g = V.galaxyOf(rules, s);
  s.queue = [];
  s.at = g.points.find((p) => p.seat && p.owner === 'choir').id;
  meet(rules, s, 'choir'); s.standing.choir = 30; s.stores.glim = 2000;
  const ctx = () => C.chartContext(rules, s, g, 'choir');
  const before = C.nodeView(ctx(), 'hello').choices.map((c) => c.id).includes('lens');
  C.applyOnChart(rules, s, g, 'choir', C.nodeView(ctx(), 'skein').choices[0].effects);
  const lens = C.nodeView(ctx(), 'hello').choices.find((c) => c.id === 'lens');
  C.applyOnChart(rules, s, g, 'choir', C.nodeView(ctx(), 'lens').choices.find((c) => c.id === 'buy').effects);
  check(!before && lens && V.remembers(s, 'lens') && s.stores.glim === 1100, 'the Choir, once they have told you about the Skein and are Friendly, will part with a Stillwater Lens for 900 Glim: you remember it');
  const t = V.newVoyage(rules, { seed: 13 });
  t.at = g.points.find((p) => p.seat && p.owner === 'gaunt').id;
  meet(rules, t, 'gaunt'); t.standing.gaunt = 0; for (const id of ['coils', 'lens']) V.remember(rules, t, id, { quiet: true }); t.stores.salvage = 2000;
  const ch = C.nodeView(C.chartContext(rules, t, g, 'gaunt'), 'hello').choices.find((c) => c.id === 'spindle');
  C.applyOnChart(rules, t, g, 'gaunt', C.nodeView(C.chartContext(rules, t, g, 'gaunt'), 'spindle').choices.find((c) => c.id === 'buy').effects);
  check(ch && V.remembers(t, 'spindle'), 'the Ashen Gaunt, at Neutral, sell an Anchor Spindle at their den for 1500 salvage: you remember it');
}

// 6. A scripted voyage, answering every event as it comes, reaches the ending
{
  const rows = [];
  let ok = true;
  for (const seed of [2, 5]) {
    const { s, visits, stitches } = captain(rules, seed, { events: true });
    const ended = s.won && s.seen.includes('Ending') && s.seen.includes('Prologue') && ['coils', 'lens', 'spindle', 'heartstone'].every((id) => s.seen.some((e) => e.toLowerCase().startsWith(id)));
    if (!ended) ok = false;
    rows.push(`seed ${seed}: ${s.won ? 'home' : s.over ? s.over.reason : 'stuck'} on day ${s.day}, ${visits} visits, ${stitches} stitches, ${s.seen.length} events seen`);
  }
  check(ok, `a scripted voyage hears the prologue, every drive part's story and the ending: ${rows.join('; ')}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll event checks passed');
process.exitCode = failures ? 1 : 0;
