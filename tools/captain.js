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
// mortal (Milestone 24): the captain can die. It plays like a decent player: it builds warships
// from the ore aboard, keeps the hull mended, tears free of a Hand it can't beat, and when a fight
// on a map goes against it, spools out with the hull loss a real map shows (MORTAL below), or is
// destroyed if the hull can't take it. strong: a strong player (sooner repairs, a bigger fleet,
// never stays in a fight it can't win). Without mortal the captain can't die (the reachability
// tests: every place and part can be had in a single life).
export function captain(rules, seed, { events = false, length = 'full', start = null, giveUp = 0, trace = null, story = false, mortal = false, strong = false } = {}) {
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
  let visits = 0, stitches = 0, goal = null, objDays = 0, fights = { won: 0, lost: 0, fled: 0 };
  const cost = (x) => +rules.actor(x).traitInfo('Valued').Cost || 0;
  const worth = (list) => list.reduce((t, x) => t + cost(x), 0);
  // what the Wound brings to a fight here: its ships, tougher in a long life (hpPct)
  const woundWorth = (wm) => (wm ? wm.encounters.filter((e) => e.behaviour !== 'hunt').reduce((t, e) => t + Math.trunc((worth(e.ships) * (e.hpPct || 100)) / 100), 0) : 0);
  const ours = (fleet = s.fleet) => fleetPower(rules, fleet) + FORGE_WORTH;
  // every Hand still alive comes home to defend the lair (Milestone 24): what they bring to it
  const homeWorth = () => Wd.handsHome(rules, s).reduce((t, h) => { const pk = Wd.homePack(rules, s, h); return t + Math.trunc((worth(pk.ships) * pk.hpPct) / 100); }, 0);
  // a decent player builds warships from the ore aboard: Halberds where it can, then Pickets and
  // Darts, keeping some ore for repairs, as many as there are berths and time for in a visit
  const build = (ore) => {
    const out = [], last = mortal && lair >= 0 && order.every((id) => done(id) || where(id) === undefined), reserve = strong || last ? 300 : 600, budget = strong || last ? 2400 : 1500;
    let spent = 0;
    while (s.fleet.length + out.length < V.berthsOf(rules, s)) {
      const x = ['halberd', 'picket', 'dart'].find((y) => (s.blueprints || []).includes(y) && cost(y) <= ore - reserve && spent + cost(y) <= budget);
      if (!x) break;
      out.push({ type: x, hp: rules.actor(x).traitInfo('Health').HP, xp: 0 }); ore -= cost(x); spent += cost(x);
    }
    return { ships: out, ore };
  };
  // armed ships lost, the cheapest first, until the losses come to `value`
  const losses = (fleet, value) => {
    const order = fleet.map((e, i) => [e, i]).filter(([e]) => rules.actor(e.type).traitInfo('Armament')).sort((a, b) => cost(a[0].type) - cost(b[0].type));
    const gone = new Set();
    let lost = 0;
    for (const [e, i] of order) { if (lost >= value) break; gone.add(i); lost += cost(e.type); }
    return fleet.filter((_, i) => !gone.has(i));
  };
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
    let wound = null, aboard = s.fleet, hp = s.forge.hp, destroyed = false;
    if (mortal) { const b = build(stores.ore.end); stores.ore.end = b.ore; aboard = [...s.fleet, ...b.ships]; }
    // the Mainspring's lair: the player builds what the fight needs from the ore aboard, and wins
    // if the fleet, the Forge and the ore together outweigh it (LAIR_WORTH); every warship is lost
    if (p.relic && V.isLair(rules, p.relic)) {
      const short = Math.trunc((LAIR_WORTH * (s.length === 'short' ? +(rules.content.wound || {}).ShortLairPct || 60 : 100)) / 100) + homeWorth() - fleetPower(rules, aboard) - FORGE_WORTH;
      if (short > (mortal ? stores.ore.end : s.stores.ore | 0)) { wound = { lair: { dead: false, core: 60 }, hand: 0, hours: 0, burned: 0, nurseries: 1, planted: 1 }; hp = mortal ? hp - Math.trunc((V.forgeMaxHp(rules, s) * 15) / 100) : Math.max(1, hp - Math.trunc((hp * 15) / 100)); destroyed = hp <= 0; }
      else {
        if (short > 0) stores.ore.end -= short;
        wound = { lair: { dead: true, core: 0 }, hand: 0, hours: 1 + Wd.handsHome(rules, s).length, burned: 1, nurseries: 0, planted: 1 };
        aboard = s.fleet.filter((e) => !rules.actor(e.type).traitInfo('Armament'));
      }
    } else if (wm && (wm.hand || wm.infested)) {
      // (a strong captain outfights its weight: tactics are worth a fifth more than the ships)
      const theirs = woundWorth(wm), mine = Math.trunc((ours(aboard) * (strong ? 125 : 100)) / 100);
      const win = mine >= theirs;
      wound = { hand: wm.hand ? 1 : 0, hours: win && wm.hand ? 1 : 0, hourPct: 100, burned: win ? wm.slot.plant : 0, nurseries: win ? 0 : wm.slot.plant, planted: wm.slot.plant };
      // the cheapest armed ships go first, until the losses come to 40% of what it brought
      if (win) { aboard = losses(aboard, Math.trunc((theirs * 40) / 100)); fights.won++; }
      else if (mortal) {
        // MORTAL: losing, the captain spools out: the Hour's pack has the Forge for the minute the
        // Skein takes, and the hull loss grows with how badly it is outmatched, 5% to 45% of the
        // hull (on a real map, left to fight, a Hand of power 300 takes 15 to 40% in two minutes
        // and destroys the Forge in five); the escorts fight and most are lost; half of what was
        // gathered is left behind. A hull that can't take it is destroyed.
        const pct = Math.max(5, Math.min(45, Math.round(5 + 45 * (1 - mine / Math.max(1, theirs)))));
        hp -= Math.trunc((V.forgeMaxHp(rules, s) * pct) / 100);
        destroyed = hp <= 0;
        aboard = losses(aboard, Math.trunc((fleetPower(rules, aboard) * 60) / 100));
        for (const st of Object.values(stores)) if (st.end > st.start) st.end = st.start + ((st.end - st.start) >> 1);
        fights.lost++;
      } else hp = Math.max(1, hp - Math.trunc((hp * 8) / 100));
    }
    V.returnFromMap(rules, s, { stores, forge: destroyed ? null : { hp: Math.max(1, hp) }, ships: { aboard, destroyed: {}, leftBehind: {}, built: {} }, ticks: (+VY.DayTicks * 5) / 2, found, crew: { lost: {} }, kills: 0, wound, standing: { changes: {}, met } });
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
  // nowhere to go (mortal): mend the drive or the hull if it can, else let the life go, as a
  // player would; returns true to keep playing
  const stuck = () => {
    if (!mortal) return false;
    for (const k of ['drive', 'hull', ...V.SYSTEMS]) if ((k === 'hull' ? s.forge.hp < V.forgeMaxHp(rules, s) : s.systems[k] < 100) && V.repairPlan(rules, s, k).ok) { V.repair(rules, s, k); settle(); return !s.over; }
    V.letGo(rules, s);
    return false;
  };
  // where water and Glim can be had
  const SUPPLY = { IceTail: ['IceTail'], LanternMist: ['LanternMist', 'SynodRefinery', 'ChoirBloom'], OreReef: ['OreReef', 'CinderHold', 'ScrapShoal'] };
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
    // caught by a Hand it can beat: go in and kill its Hour (the Hand is gone for the life). On the
    // last stretch to the lair, where every Hand alive would come home to defend it, even a decent
    // captain takes them on at even odds
    const finale = mortal && !order.some((id) => !done(id) && where(id) !== undefined) && lair >= 0 && !(s.flags || []).includes('mainspring');
    const nerve = strong || finale ? 1 : 1.3;
    if (mortal && Wd.caughtBy(rules, s) && ours() * (strong ? 1.25 : 1) >= woundWorth(Wd.mapWound(rules, s, g, s.at)) * nerve && V.daysLeft(rules, s).ice >= 3) { visit(); goal = null; continue; }
    // caught by a Hand it can't beat: tear free (it costs hull) toward the goal, or anywhere
    // (not if the hull can't take the tearing free: then it fights)
    // (a decent captain only takes on a Hand it clearly outguns; a strong one fights any it can beat)
    if (mortal && Wd.caughtBy(rules, s) && ours() * (strong ? 1.25 : 1) < woundWorth(Wd.mapWound(rules, s, g, s.at)) * nerve && s.forge.hp * 100 > V.forgeMaxHp(rules, s) * ((Wd.escapePlan(rules, s) || { hull: 0 }).hull + 1)) {
      const to = (goal && goal.id !== s.at && V.plan(rules, s, goal.id).ok ? [V.plan(rules, s, goal.id).route.hops[0]] : []).concat(g.adj[s.at].map((li) => { const l = g.lanes[li]; return l.a === s.at ? l.b : l.a; }));
      const hop = to.find((j) => V.plan(rules, s, j).ok);
      if (hop !== undefined && V.stitch(rules, s, hop).ok) { stitches++; fights.fled++; continue; }
    }
    // caught with too little hull to tear free: stand and fight
    // (the captain that can't die mends the hull under the Hand's pickets instead, until it can)
    if (Wd.caughtBy(rules, s) && s.forge.hp * 100 <= V.forgeMaxHp(rules, s) * ((Wd.escapePlan(rules, s) || { hull: 0 }).hull + 1)) {
      if (!mortal && V.repairPlan(rules, s, 'hull').ok) { V.repair(rules, s, 'hull'); settle(); continue; }
      visit(); goal = null; continue;
    }
    // a hurt hull: mend it while there is water (a strong player sooner)
    if (mortal && !Wd.caughtBy(rules, s) && s.forge.hp * 100 < V.forgeMaxHp(rules, s) * (strong ? 80 : 60) && V.daysLeft(rules, s).ice > 6 && V.repairPlan(rules, s, 'hull').ok) { V.repair(rules, s, 'hull'); settle(); continue; }
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
    // before the last fight, a sensible captain gathers the ore it needs (mortal: a failed attack
    // costs hull, and can cost the life)
    const lairShort = mortal && next === 'lair' ? Math.trunc((LAIR_WORTH * (s.length === 'short' ? +(rules.content.wound || {}).ShortLairPct || 60 : 100)) / 100) + homeWorth() - fleetPower(rules, s.fleet) - FORGE_WORTH + 300 : 0;
    // a strong captain arms ahead of the Hands: a fleet to beat one, growing with the life
    const armUp = strong && fleetPower(rules, s.fleet) + FORGE_WORTH < 3200 + 45 * s.day && fleetPower(rules, s.fleet) + 450 <= 450 * (V.berthsOf(rules, s) - 4) && (s.stores.ore | 0) < 1200;
    const urgent = left.ice < 5 ? 'IceTail' : goal && (goal.kind === 'IceTail' || goal.kind === 'LanternMist' || goal.kind === 'OreReef') ? goal.kind : left.ice < Math.max(10, trip) ? 'IceTail' : lowGlim ? 'LanternMist' : lairShort > (s.stores.ore | 0) || armUp ? 'OreReef' : null;
    if (trace) trace(s, goal, urgent);
    // spare cogmarks: train navigation, which saves the most Glim and days
    if (!urgent && left.ice > 10) { const tr = ['navigation'].find((id) => V.trainPlan(rules, s, id).ok); if (tr) { V.train(rules, s, tr); settle(); continue; } }
    // a strong captain makes room for a bigger fleet
    if (strong && !urgent && left.ice > 10 && V.installPlan(rules, s, 'hangar').ok) { V.install(rules, s, 'hangar'); settle(); continue; }
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
      else { const m = nearest(type('LanternMist')) || nearest(type('IceTail')); if (!m) { if (stuck()) continue; break; } goal = { ...m, kind: 'any' }; }
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
    // (what the route really costs: charted lanes are cheaper, strain makes them dearer)
    if (!pl.route || (mortal ? !pl.ok && s.stores.glim < pl.route.glim : s.stores.glim < stitchGlim(VY, g.lanes[pl.route.lanes[0]].len))) {
      goal = null;
      const m = nearest(type('LanternMist'));
      if (m) { goal = { ...m, kind: 'LanternMist' }; continue; }
      if (type('LanternMist')(here)) { visit(); continue; }
      if (!driftToward(type('LanternMist')) && !stuck()) break;
      continue;
    }
    // how far the goal is now (not when it was picked)
    goal.days = pl.route.days;
    if (goal.kind === (next || 'home')) objDays = goal.days;
    // through charted space (Milestone 24) the whole route in one order, as a player would plot
    // it; elsewhere one stitch at a time, looking again at every stop
    // (strain and the mood make a stitch dearer than its base cost: if it can't be paid, drift)
    const known = mortal && pl.ok && pl.route.lanes.every((li) => V.charted(s, li));
    if (!V.stitch(rules, s, known ? goal.id : pl.route.hops[0]).ok) { goal = null; if (!driftToward(type('LanternMist')) && !stuck()) break; continue; }
    stitches++;
  }
  return { s, visits, stitches, fights };
}

// A campaign: lives played one after another in the same galaxy. giveUps: the day each early
// life is let go (one entry per life given up); the last life plays to the end. mortal: the real
// loop (Milestone 24): each life plays until the Forge is destroyed or the ending, and on waking
// the captain spends its echoes on the Loom; up to maxLives lives.
export function campaign(rules, seed, { events = false, length = 'full', giveUps = [], mortal = false, story = false, strong = false, maxLives = 14 } = {}) {
  const lives = [];
  let s = V.newVoyage(rules, { seed, length });
  for (let i = 0; ; i++) {
    const r = captain(rules, seed, { events, length, start: s, giveUp: giveUps[i] || 0, mortal, story, strong });
    lives.push(r);
    if (!V.lifeOver(r.s) || i + 1 >= (mortal ? maxLives : giveUps.length + 4)) break;
    s = V.newLife(rules, r.s);
    if (mortal) wake(rules, s);
  }
  const last = lives[lives.length - 1];
  return { s: last.s, lives, visits: lives.reduce((t, r) => t + r.visits, 0), stitches: lives.reduce((t, r) => t + r.stitches, 0) };
}

// Waking: the echoes go on the Loom. Silent running first (the Hands hear less), then what gets
// the Forge through the hazards it has met, then whatever else is cheapest.
export function wake(rules, s) {
  const M = rules.content.memories;
  const rank = (id) => (id === 'silent' ? 0 : M[id].Seen ? 1 : 2 + (+M[id].Cost || 9));
  for (let n = 0; n < 20; n++) {
    const can = Object.keys(M).filter((id) => V.recallPlan(rules, s, id).ok).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
    if (!can.length) break;
    V.recall(rules, s, can[0]);
  }
}

// Estimated play time of a captain's run, in minutes: a map visit (two and a half days of
// gathering, ten minutes, plus launching, building, recalling and spooling), and time on the
// chart for each stitch and each day of the voyage.
export function playMinutes(r) { return r.visits * 15 + r.stitches * 0.75 + r.s.day * 0.1; }
