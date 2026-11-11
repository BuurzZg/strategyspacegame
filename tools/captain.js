// The abstract captain: plays the galaxy layer to the end with simple rules, and visits that
// yield what a short stay at that kind of place would (no maps are played). Used by the voyage
// test (it shows the voyage can be won, and roughly how long it takes) and the event test (with
// events answered as they come: the first choice that can be taken, at every node).
import * as V from '../src/galaxy/voyage.js';
import { stitchGlim } from '../src/galaxy/galaxy.js';
import { nodeView, fleetPower, parseEffect } from '../src/galaxy/comms.js';
import * as Wd from '../src/galaxy/wound.js';
import * as B from '../src/galaxy/base.js';
import * as K from '../src/galaxy/crew.js';

// what the Forge's own guns are worth in a fight with the Wound; what the Mainspring is
const FORGE_WORTH = 1500, LAIR_WORTH = 6000;

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
// story: also go after every story memory (Milestone 22), act by act, before the last fight; so
// a campaign can reach the true ending. Without it, only the drive parts, then the Mainspring.
export function captain(rules, seed, { events = false, length = 'full', start = null, giveUp = 0, trace = null, story = false } = {}) {
  const VY = rules.content.voyage;
  const s = start || V.newVoyage(rules, { seed, length });
  const g = V.galaxyOf(rules, s);
  // the objectives, in order: drive parts (and story places and the Tallow Bell, in story mode)
  // region by region; then the Mainspring's lair
  const order = story ? ['anchorage', 'steward', 'coils', 'research', 'ledger', 'barge', 'bell', 'lens', 'reliquary', 'horologe', 'tithe', 'spindle', 'hall', 'heartstone'] : ['coils', 'lens', 'spindle', 'heartstone'];
  const lair = V.lairAt(rules, s);
  const done = (id) => (id === 'bell' ? V.remembers(s, 'oath') : rules.content.items[id]?.Kind === 'drive' ? V.remembers(s, id) : V.anchorDone(rules, s, id));
  const where = (id) => (id === 'bell' ? g.traders.bell : g.components[id]);
  const YIELD = { Steward: { salvage: 1200, ice: 300 }, ResearchHulk: { salvage: 1400, ore: 500 }, TallyHulk: { salvage: 1300, ore: 600 }, PrisonBarge: { salvage: 1300, ice: 400 }, Reliquary: { salvage: 1400, glim: 600 }, Horologe: { salvage: 1400, ice: 300 }, TitheBarge: { salvage: 1400 }, FoundingHall: { salvage: 1300, ore: 700 }, Lair: { salvage: 1500, ore: 600 }, Trader: {}, Wayhouse: {},
    IceTail: { ice: 3200, ore: 400 }, LanternMist: { glim: 2400, spores: 700, ore: 200 }, OreReef: { ore: 2000 }, ScrapShoal: { ore: 900, salvage: 700, ice: 300 }, Wreck: { salvage: 1600, ore: 300 }, StillWater: { ore: 300, ice: 200 }, HollowhornGrounds: { glim: 1500, ice: 1500 }, Anchorage: { salvage: 1200, ice: 400 }, HullTown: { ore: 500, salvage: 300 }, SynodRefinery: { glim: 1500, spores: 300 }, GauntDen: { salvage: 1200 }, CinderHold: { ore: 1200, ice: 600 }, ChoirBloom: { glim: 1500, spores: 600 } };
  // objDays: how far the objective (the next drive part, or home) was when last planned, so a
  // supply run takes on water for the trip after it, not just for the way to the ice
  let visits = 0, stitches = 0, goal = null, objDays = 0;
  const visit = () => {
    const p = g.points[s.at], times = s.visited[p.id] | 0, rich = Math.max(+VY.RevisitFloor, 100 - times * +VY.RevisitPct);
    const stores = {};
    for (const [k, n] of Object.entries(s.stores)) stores[k] = { start: n, end: n + Math.trunc(((YIELD[p.type][k] || 0) * rich) / 100), changes: {} };
    const found = p.relic && !V.isLair(rules, p.relic) && !V.anchorDone(rules, s, p.relic) ? [p.relic] : [];
    // the Wardens guard the Steward and the Reliquary: a fight with them shakes the registry loose
    const met = ['Steward', 'Reliquary'].includes(p.type) ? ['wardens'] : [];
    // the Wound here: fight it if the fleet (and the Forge's guns) outweigh it, losing ships worth
    // some of what it brought; otherwise spool out with the Hand shaken off and the hull hurt
    const wm = Wd.mapWound(rules, s, g, s.at);
    let wound = null, aboard = s.fleet, hp = s.forge.hp;
    // the Mainspring's lair: the player builds what the fight needs from the ore aboard, and wins
    // if the fleet, the Forge and the ore together outweigh it (LAIR_WORTH); every warship is lost
    if (p.relic && V.isLair(rules, p.relic)) {
      const short = Math.trunc((LAIR_WORTH * (s.length === 'short' ? +(rules.content.wound || {}).ShortLairPct || 60 : 100)) / 100) - fleetPower(rules, s.fleet) - FORGE_WORTH;
      if (short > (s.stores.ore | 0)) { wound = { lair: { dead: false, core: 60 }, hand: 0, hours: 0, burned: 0, nurseries: 1, planted: 1 }; hp = Math.max(1, hp - Math.trunc((hp * 15) / 100)); }
      else {
        if (short > 0) stores.ore.end -= short;
        wound = { lair: { dead: true, core: 0 }, hand: 0, hours: 1, burned: 1, nurseries: 0, planted: 1 };
        aboard = s.fleet.filter((e) => !rules.actor(e.type).traitInfo('Armament'));
      }
    } else if (wm && (wm.hand || wm.infested)) {
      const worth = (list) => list.reduce((t, x) => t + (+rules.actor(x).traitInfo('Valued').Cost || 0), 0);
      const theirs = wm.encounters.filter((e) => e.behaviour !== 'hunt').reduce((t, e) => t + worth(e.ships), 0), ours = fleetPower(rules, s.fleet) + FORGE_WORTH;
      const win = ours >= theirs;
      wound = { hand: wm.hand ? 1 : 0, hours: win && wm.hand ? 1 : 0, hourPct: 100, burned: win ? wm.slot.plant : 0, nurseries: win ? 0 : wm.slot.plant, planted: wm.slot.plant };
      if (win) {
        // the cheapest armed ships go first, until the losses come to 40% of what it brought
        const order = s.fleet.map((e, i) => [e, i]).filter(([e]) => rules.actor(e.type).traitInfo('Armament')).sort((a, b) => worth([a[0].type]) - worth([b[0].type]));
        const gone = new Set();
        let lost = 0;
        for (const [e, i] of order) { if (lost * 100 >= theirs * 40) break; gone.add(i); lost += worth([e.type]); }
        aboard = s.fleet.filter((_, i) => !gone.has(i));
      } else hp = Math.max(1, hp - Math.trunc((hp * 8) / 100));
    }
    V.returnFromMap(rules, s, { stores, forge: { hp }, ships: { aboard, destroyed: {}, leftBehind: {}, built: {} }, ticks: (+VY.DayTicks * 5) / 2, found, crew: { lost: {} }, kills: 0, wound, standing: { changes: {}, met } });
    visits++;
  };
  // at an objective: the Tallow Bell is hailed (the Deacon remembers you); anywhere else, go in
  const reach = () => {
    const p = g.points[s.at];
    if (p.trader === 'bell' && !V.remembers(s, 'oath')) { V.hailEffects(rules, s, 'synod', [parseEffect('item oath found')]); return; }
    if (p.trader || p.wayhouse) return;
    visit();
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
  // Out of Glim for any stitch: drift (sub-light, no Glim) one lane toward the nearest place it
  // can be had. Returns false if there is nowhere to drift.
  const driftToward = (pred) => {
    const dist = new Array(g.points.length).fill(1e9), q = [];
    for (const p of g.points) if (pred(p)) { dist[p.id] = 0; q.push(p.id); }
    while (q.length) { const i = q.shift(); for (const li of g.adj[i]) { const l = g.lanes[li], j = l.a === i ? l.b : l.a; if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); } } }
    // (nearest first; somewhere not drifted to yet, so it never goes back and forth)
    const opts = g.adj[s.at].map((li) => { const l = g.lanes[li]; return l.a === s.at ? l.b : l.a; }).filter((j) => !drifted.has(j) && V.driftPlan(rules, s, j).ok).sort((a, b) => dist[a] - dist[b] || a - b);
    if (!opts.length) return false;
    drifted.add(s.at);
    V.drift(rules, s, opts[0]);
    return true;
  };
  const drifted = new Set();
  // where water and Glim can be had
  const SUPPLY = { IceTail: ['IceTail'], LanternMist: ['LanternMist', 'SynodRefinery', 'ChoirBloom'] };
  const type = (t) => (p) => (SUPPLY[t] || [t]).includes(p.type);
  // events answered (or skipped); pilots at a perk level take the first perk on offer; a muster
  // keeps the best-levelled ships and scraps the rest
  const settle = () => {
    if (events) resolveEvents(rules, s); else s.queue = [];
    s.fleet.forEach((e, i) => { if (e.offer) V.choosePerk(rules, s, i, e.offer[0]); });
    if (s.muster) { const keep = new Set(s.fleet.map((e, i) => [e, i]).sort((a, b) => (b[0].xp | 0) - (a[0].xp | 0)).slice(0, V.berthsOf(rules, s)).map(([, i]) => i)); V.muster(rules, s, Object.fromEntries(s.fleet.map((_, i) => [i, keep.has(i) ? 'keep' : 'scrap']))); }
  };
  settle();
  for (let guard = 0; !s.over && guard < (story ? 2000 : 600); guard++) {
    settle();
    if (giveUp && s.day >= giveUp) { V.letGo(rules, s); break; }
    // the Mainspring is dead and the way is open: go now (the jump needs no stores)
    if (s.at === lair && V.canJumpHome(rules, s).ok && (!story || V.trueEnding(s))) { V.jumpHome(rules, s); settle(); break; }
    // a damaged drive stitches shorter: mend it (and anything badly hurt) while there is water
    const sick = s.systems.drive < 100 ? 'drive' : V.SYSTEMS.find((k) => s.systems[k] < 70);
    if (sick && V.daysLeft(rules, s).ice > 8 && V.repairPlan(rules, s, sick).ok) { V.repair(rules, s, sick); settle(); continue; }
    // the next objective; with them all done, the lair (and its fight), and then home
    const next = order.find((id) => !done(id) && where(id) !== undefined) || (lair >= 0 && !(s.flags || []).includes('mainspring') ? 'lair' : null);
    const left = V.daysLeft(rules, s), here = g.points[s.at];
    // supplies first, checked at every stop
    const lowGlim = s.stores.glim < (g.points[s.at].ri >= 2 ? 900 : 600) || (s.stores.food < 900 && s.stores.spores < 100);
    // keep a supply run going once started, unless water gets desperate
    // enough water for what is left of the trip to the objective, with a margin
    const trip = Math.max(goal && goal.days ? goal.days : 6, objDays) + 3;
    const urgent = left.ice < 5 ? 'IceTail' : goal && (goal.kind === 'IceTail' || goal.kind === 'LanternMist') ? goal.kind : left.ice < Math.max(10, trip) ? 'IceTail' : lowGlim ? 'LanternMist' : null;
    if (trace) trace(s, goal, urgent);
    // spare cogmarks: train navigation, which saves the most Glim and days
    if (!urgent && left.ice > 10) { const tr = ['navigation'].find((id) => V.trainPlan(rules, s, id).ok); if (tr) { V.train(rules, s, tr); settle(); continue; } }
    // a crowded Forge is an unhappy one: build crew quarters when it can
    if (!urgent && B.berths(rules, s) < K.count(s.crew) && V.installPlan(rules, s, 'quarters').ok && left.ice > 10) { V.install(rules, s, 'quarters'); settle(); continue; }
    // already at the objective: deal with it before running for supplies
    if (next && goal && goal.kind === next && s.at === goal.id && left.ice >= 3) { reach(); goal = null; continue; }
    if (urgent) {
      // at a supply place: stay (visit again) until the stores are well up
      if (type(urgent)(here)) { visit(); if (urgent !== 'IceTail' || V.daysLeft(rules, s).ice >= Math.max(20, trip + 3) || !type(urgent)(here)) goal = null; continue; }
      if (!goal || goal.kind !== urgent) { const n = nearest(type(urgent)); if (n) goal = { ...n, kind: urgent }; }
    }
    if (!goal) {
      const n = next ? nearest((p) => p.id === (next === 'lair' ? lair : where(next)), true) : nearest((p) => p.id === lair, true);
      if (n) { goal = { ...n, kind: next || 'home' }; objDays = n.days; }
      else { const m = nearest(type('LanternMist')) || nearest(type('IceTail')); if (!m) break; goal = { ...m, kind: 'any' }; }
    }
    if (s.at === goal.id) {
      if (!next && s.at === lair) {
        // in story mode, not without the whole truth: wake again and finish it (the campaign)
        if (story && !V.trueEnding(s)) { V.letGo(rules, s); break; }
        if (V.jumpHome(rules, s).ok) { settle(); break; }
      }
      reach(); goal = null; continue;
    }
    const pl = V.plan(rules, s, goal.id);
    if (!pl.route || s.stores.glim < stitchGlim(VY, g.lanes[pl.route.lanes[0]].len)) {
      goal = null;
      const m = nearest(type('LanternMist'));
      if (m) { goal = { ...m, kind: 'LanternMist' }; continue; }
      if (type('LanternMist')(here)) { visit(); continue; }
      if (!driftToward(type('LanternMist'))) break;
      continue;
    }
    // how far the goal is now (not when it was picked)
    goal.days = pl.route.days;
    if (goal.kind === (next || 'home')) objDays = goal.days;
    // one stitch at a time
    // (strain and the mood make a stitch dearer than its base cost: if it can't be paid, drift)
    if (!V.stitch(rules, s, pl.route.hops[0]).ok) { goal = null; if (!driftToward(type('LanternMist'))) break; continue; }
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
