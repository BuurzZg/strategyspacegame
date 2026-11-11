// The abstract captain: plays the galaxy layer to the end with simple rules, and visits that
// yield what a short stay at that kind of place would (no maps are played). Used by the voyage
// test (it shows the voyage can be won, and roughly how long it takes) and the event test (with
// events answered as they come: the first choice that can be taken, at every node).
import * as V from '../src/galaxy/voyage.js';
import { stitchGlim } from '../src/galaxy/galaxy.js';
import { nodeView } from '../src/galaxy/comms.js';
import * as B from '../src/galaxy/base.js';
import * as K from '../src/galaxy/crew.js';

export function resolveEvents(rules, s, pick = (choices) => choices.find((c) => c.ok)) {
  for (let n = 0; s.queue && s.queue.length && n < 50; n++) {
    const ev = rules.content.events[s.queue[0]];
    let node = ev.Start;
    for (let k = 0; node && k < 20; k++) {
      const v = nodeView(V.eventContext(rules, s, V.galaxyOf(rules, s), ev), node);
      const c = v && pick(v.choices);
      if (!c) break;
      const r = V.eventChoice(rules, s, c.effects);
      node = r.goto || (r.close ? null : c.goto);
    }
    s.queue.shift();
  }
}

// start: an existing voyage to play on (a later life of a campaign); giveUp: let go of the life
// on this day (to test what a death carries over)
// trace(s, goal, urgent): called each turn, for debugging
export function captain(rules, seed, { events = false, length = 'full', start = null, giveUp = 0, trace = null } = {}) {
  const VY = rules.content.voyage;
  const s = start || V.newVoyage(rules, { seed, length });
  const g = V.galaxyOf(rules, s);
  const order = ['coils', 'lens', 'spindle', 'heartstone'];
  const YIELD = { IceTail: { ice: 3200, ore: 400 }, LanternMist: { glim: 2400, spores: 700, ore: 200 }, OreReef: { ore: 2000 }, ScrapShoal: { ore: 900, salvage: 700, ice: 300 }, Wreck: { salvage: 1600, ore: 300 }, StillWater: { ore: 300, ice: 200 }, HollowhornGrounds: { glim: 1500, ice: 1500 }, Anchorage: { salvage: 1200, ice: 400 }, HullTown: { ore: 500, salvage: 300 }, SynodRefinery: { glim: 1500, spores: 300 }, GauntDen: { salvage: 1200 }, CinderHold: { ore: 1200, ice: 600 }, ChoirBloom: { glim: 1500, spores: 600 } };
  // objDays: how far the objective (the next drive part, or home) was when last planned, so a
  // supply run takes on water for the trip after it, not just for the way to the ice
  let visits = 0, stitches = 0, goal = null, objDays = 0;
  const visit = () => {
    const p = g.points[s.at], times = s.visited[p.id] | 0, rich = Math.max(+VY.RevisitFloor, 100 - times * +VY.RevisitPct);
    const stores = {};
    for (const [k, n] of Object.entries(s.stores)) stores[k] = { start: n, end: n + Math.trunc(((YIELD[p.type][k] || 0) * rich) / 100), changes: {} };
    const found = p.relic && !V.anchorDone(rules, s, p.relic) ? [p.relic] : [];
    V.returnFromMap(rules, s, { stores, forge: { hp: s.forge.hp }, ships: { aboard: s.fleet, destroyed: {}, leftBehind: {}, built: {} }, ticks: (+VY.DayTicks * 5) / 2, found, crew: { lost: {} }, kills: 0 });
    visits++;
  };
  // the nearest place (fewest days) that fits, which the Glim aboard can reach
  // (far goals need not be affordable in one go: the captain goes a stitch at a time and refuels)
  const nearest = (pred, far = false) => {
    let best = null;
    for (const p of g.points) {
      if (!pred(p)) continue;
      if (p.id === s.at) return { id: p.id, days: 0 };
      const pl = V.plan(rules, s, p.id);
      // places picked over yield less: count each earlier visit as two days further away
      const cost = pl.route ? pl.route.days + 2 * (s.visited[p.id] | 0) : 0;
      if ((pl.ok || (far && pl.route)) && (!best || cost < best.cost || (cost === best.cost && pl.route.glim < best.glim))) best = { id: p.id, days: pl.route.days, glim: pl.route.glim, cost };
    }
    return best;
  };
  // where water and Glim can be had
  const SUPPLY = { IceTail: ['IceTail'], LanternMist: ['LanternMist', 'SynodRefinery', 'ChoirBloom'] };
  const type = (t) => (p) => (SUPPLY[t] || [t]).includes(p.type);
  const settle = () => { if (events) resolveEvents(rules, s); else s.queue = []; };
  settle();
  for (let guard = 0; !s.over && guard < 600; guard++) {
    settle();
    if (giveUp && s.day >= giveUp) { V.letGo(rules, s); break; }
    // a damaged drive stitches shorter: mend it (and anything badly hurt) while there is water
    const sick = s.systems.drive < 100 ? 'drive' : V.SYSTEMS.find((k) => s.systems[k] < 70);
    if (sick && V.daysLeft(rules, s).ice > 8 && V.repairPlan(rules, s, sick).ok) { V.repair(rules, s, sick); settle(); continue; }
    const next = order.find((id) => !V.remembers(s, id));
    const left = V.daysLeft(rules, s), here = g.points[s.at];
    // supplies first, checked at every stop
    const lowGlim = s.stores.glim < (g.points[s.at].ri >= 2 ? 900 : 600) || (s.stores.food < 900 && s.stores.spores < 100);
    // keep a supply run going once started, unless water gets desperate
    // enough water for what is left of the trip to the objective, with a margin
    const trip = Math.max(goal && goal.days ? goal.days : 6, objDays) + 3;
    const urgent = left.ice < 5 ? 'IceTail' : goal && (goal.kind === 'IceTail' || goal.kind === 'LanternMist') ? goal.kind : left.ice < Math.max(10, trip) ? 'IceTail' : lowGlim ? 'LanternMist' : null;
    if (trace) trace(s, goal, urgent);
    // a crowded Forge is an unhappy one: build crew quarters when it can
    if (!urgent && B.berths(rules, s) < K.count(s.crew) && V.installPlan(rules, s, 'quarters').ok && left.ice > 10) { V.install(rules, s, 'quarters'); settle(); continue; }
    // already at the drive part's derelict: cut it open before running for supplies
    if (next && goal && goal.kind === next && s.at === goal.id && left.ice >= 3) { visit(); goal = null; continue; }
    if (urgent) {
      // at a supply place: stay (visit again) until the stores are well up
      if (type(urgent)(here)) { visit(); if (urgent !== 'IceTail' || V.daysLeft(rules, s).ice >= Math.max(20, trip + 3) || !type(urgent)(here)) goal = null; continue; }
      if (!goal || goal.kind !== urgent) { const n = nearest(type(urgent)); if (n) goal = { ...n, kind: urgent }; }
    }
    if (!goal) {
      const n = next ? nearest((p) => p.id === g.components[next], true) : nearest((p) => p.edge, true);
      if (n) { goal = { ...n, kind: next || 'home' }; objDays = n.days; }
      else { const m = nearest(type('LanternMist')) || nearest(type('IceTail')); if (!m) break; goal = { ...m, kind: 'any' }; }
    }
    if (s.at === goal.id) {
      if (!next && here.edge) { V.jumpHome(rules, s); settle(); break; }
      visit(); goal = null; continue;
    }
    const pl = V.plan(rules, s, goal.id);
    if (!pl.route || s.stores.glim < stitchGlim(VY, g.lanes[pl.route.lanes[0]].len)) { goal = null; if (!nearest(type('LanternMist'))) break; goal = { ...nearest(type('LanternMist')), kind: 'LanternMist' }; continue; }
    // how far the goal is now (not when it was picked)
    goal.days = pl.route.days;
    if (goal.kind === (next || 'home')) objDays = goal.days;
    // one stitch at a time
    V.stitch(rules, s, pl.route.hops[0]);
    stitches++;
  }
  return { s, visits, stitches };
}

// A campaign: lives played one after another in the same galaxy. giveUps: the day each early
// life is let go (one entry per life given up); the last life plays to the end.
export function campaign(rules, seed, { events = false, length = 'full', giveUps = [] } = {}) {
  const lives = [];
  let s = V.newVoyage(rules, { seed, length });
  for (let i = 0; ; i++) {
    const r = captain(rules, seed, { events, length, start: s, giveUp: giveUps[i] || 0 });
    lives.push(r);
    if (!V.lifeOver(r.s) || i >= giveUps.length + 3) break;
    s = V.newLife(rules, r.s);
  }
  const last = lives[lives.length - 1];
  return { s: last.s, lives, visits: lives.reduce((t, r) => t + r.visits, 0), stitches: lives.reduce((t, r) => t + r.stitches, 0) };
}

// Estimated play time of a captain's run, in minutes: a map visit (two and a half days of
// gathering, ten minutes, plus launching, building, recalling and spooling), and time on the
// chart for each stitch and each day of the voyage.
export function playMinutes(r) { return r.visits * 15 + r.stitches * 0.75 + r.s.day * 0.1; }
