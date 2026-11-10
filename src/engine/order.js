import { DockHangar } from '../activities/hangar.js';

// Orders are the only way input changes the simulation. The UI (or a bot) builds an Order,
// the OrderManager schedules it for a future frame on every client, and on that frame each
// client resolves it identically.
//
// Wire format (compact JSON):  { n: name, s: [actorIds], t: target, x: extra, q: 1 if queued }
//   target: { a: actorId } | { x, y, z } (world units, z = up) | undefined
//   orders with no subjects are player-level (PlaceBuilding, Surrender) and go to the player actor.
//   { w: 1 } marks a world order (developer commands, autopilot); it goes to the World actor and
//   may come from an observer with no player.

export function makeOrder(name, subjects, target, extra, queued) {
  const o = { n: name, s: subjects.map((a) => (typeof a === 'number' ? a : a.id)) };
  if (target) o.t = target.actor ? { a: target.actor.id } : target.a !== undefined ? { a: target.a } : { x: target.x | 0, y: target.y | 0, z: target.z | 0 };
  if (extra !== undefined && extra !== null) o.x = extra;
  if (queued) o.q = 1;
  return o;
}

const GROUP_MOVES = new Set(['Move', 'AttackMove']);

export function makeWorldOrder(name, extra) { return { n: name, s: [], w: 1, x: extra }; }

export function resolveOrder(world, player, o) {
  if (o.w) {
    const order = { name: o.n, target: null, extra: o.x, queued: false, player: player || null };
    for (const t of world.worldActor.traits) if (t.enabled && t.resolveOrder) t.resolveOrder(order);
    return;
  }
  if (!player || player.outcome === 'lost') return;
  let target = null;
  if (o.t) {
    if (o.t.a !== undefined) {
      const a = world.actorById.get(o.t.a);
      if (!a || a.dead) return;
      target = { actor: a, x: a.x, y: a.y, z: a.z };
    } else target = { x: o.t.x | 0, y: o.t.y | 0, z: o.t.z | 0 };
  }
  const order = { name: o.n, target, extra: o.x, queued: !!o.q, player };

  if (!o.s || o.s.length === 0) {
    for (const t of player.actor.traits) if (t.enabled && t.resolveOrder) t.resolveOrder(order);
    return;
  }
  const subjects = [];
  for (const id of o.s) {
    const a = world.actorById.get(id);
    if (a && !a.dead && a.owner === player && !subjects.includes(a)) subjects.push(a);
  }
  if (!subjects.length) return;

  const F = world.formations;
  if (o.n === 'SetFormation') { if (F) F.form(player, subjects, String(o.x)); return; }
  if (GROUP_MOVES.has(o.n) && target && !target.actor) {
    const movers = subjects.filter((a) => a.mobile);
    // a whole formation group moves as one
    const g = F && F.exactGroup(movers);
    if (g) {
      F.move(g, target, o.n === 'AttackMove');
      for (const a of subjects) if (!a.mobile) dispatch(a, order);
      return;
    }
    // anything else leaves its formation; a loose group keeps its shape around the new centre
    if (F) F.leave(movers);
    if (movers.length > 1) {
      const goals = world.groupOffsets(movers, target);
      movers.forEach((a, i) => dispatch(a, { ...order, target: goals[i] }));
      for (const a of subjects) if (!a.mobile) dispatch(a, order);
      return;
    }
  }
  if (F && o.n === 'Stop') { const g = F.exactGroup(subjects.filter((a) => a.mobile)); if (g) F.stop(g); }
  if (F && (o.n === 'Harvest' || o.n === 'Dock')) F.leave(subjects);
  if (o.n === 'Recall') {
    // the ships come home and go aboard the Forge's hangar
    const forge = world.actors.find((a) => a.owner === player && !a.dead && a.has('Hangar'));
    if (!forge) return;
    const ships = subjects.filter((a) => a.mobile && a !== forge);
    if (F) F.leave(ships);
    for (const a of ships) {
      if (a.collector) a.collector.auto = false;
      a.mobile.goal = null;
      a.queueActivity(new DockHangar(forge.id), false);
    }
    return;
  }
  for (const a of subjects) dispatch(a, order);
}

function dispatch(actor, order) {
  for (const t of actor.traits) if (t.enabled && t.resolveOrder) t.resolveOrder(order);
}
